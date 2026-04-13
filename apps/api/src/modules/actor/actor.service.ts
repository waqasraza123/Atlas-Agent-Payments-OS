import { atlasLocalSessionHeaderName, type AtlasActorContext } from "@atlas/auth";
import { verifyAtlasSignedSessionToken } from "@atlas/auth/server";
import {
  appRuntime,
  authRuntime,
  canAtlasUseLocalDevelopmentSessions,
  requiresAtlasExternalOidcForReleaseStage,
  requiresAtlasProviderBackedAuthForEnvironment
} from "@atlas/config";
import { loadAuthSessionById, prisma, touchAuthSession } from "@atlas/database";
import { Injectable } from "@nestjs/common";
import type { MembershipRole, OrganizationKind } from "@atlas/types";
import type { ActorResolutionResult } from "./actor.types";

type MembershipWithRelations = Awaited<ReturnType<ActorResolutionService["loadMembership"]>>;

@Injectable()
export class ActorResolutionService {
  private isSupportAccessAllowedEmail(userEmail: string) {
    return (
      authRuntime.supportAccessAllowedEmails.length === 0 ||
      authRuntime.supportAccessAllowedEmails.includes(userEmail.trim().toLowerCase())
    );
  }

  private async loadMembership(input: {
    role: MembershipRole;
    userEmail: string;
    organizationSlug: string;
    workspace: OrganizationKind;
  }) {
    return prisma.membership.findFirst({
      where: {
        role: input.role,
        user: {
          email: input.userEmail
        },
        organization: {
          slug: input.organizationSlug,
          kind: input.workspace
        }
      },
      include: {
        user: true,
        organization: true
      }
    });
  }

  private async loadSupportAccessGrant(grantId: string) {
    const grant = await prisma.supportAccessGrant.findUnique({
      where: {
        id: grantId
      },
      include: {
        issuedByUser: true,
        issuedByOrganization: true,
        targetOrganization: true
      }
    });

    if (!grant) {
      return null;
    }

    if (
      (grant.status === "ACTIVE" || grant.status === "RECERTIFICATION_REQUIRED") &&
      grant.expiresAt.getTime() <= Date.now()
    ) {
      return prisma.supportAccessGrant.update({
        where: {
          id: grant.id
        },
        data: {
          status: "EXPIRED"
        },
        include: {
          issuedByUser: true,
          issuedByOrganization: true,
          targetOrganization: true
        }
      });
    }

    if (grant.status === "ACTIVE" && grant.reviewExpiresAt && grant.reviewExpiresAt.getTime() <= Date.now()) {
      return prisma.supportAccessGrant.update({
        where: {
          id: grant.id
        },
        data: {
          status: "RECERTIFICATION_REQUIRED"
        },
        include: {
          issuedByUser: true,
          issuedByOrganization: true,
          targetOrganization: true
        }
      });
    }

    return grant;
  }

  private createBaseActor(
    membership: NonNullable<MembershipWithRelations>,
    input: {
      source: AtlasActorContext["source"];
      providerMode: AtlasActorContext["providerMode"];
      agentId: string | null;
      issuedAt: string;
      expiresAt: string;
      sessionId: string | null;
    }
  ) {
    return {
      user: {
        id: membership.user.id,
        email: membership.user.email,
        name: membership.user.name ?? null
      },
      organization: {
        id: membership.organization.id,
        slug: membership.organization.slug,
        name: membership.organization.name,
        kind: membership.organization.kind
      },
      membership: {
        id: membership.id,
        role: membership.role
      },
      workspace: membership.organization.kind,
      agentId: input.agentId,
      source: input.source,
      providerMode: input.providerMode,
      sessionId: input.sessionId,
      principalOrganization: null,
      supportAccess: null,
      sessionIssuedAt: input.issuedAt,
      sessionExpiresAt: input.expiresAt
    } satisfies AtlasActorContext;
  }

  private async resolveFromSignedSessionToken(rawToken: string): Promise<ActorResolutionResult> {
    const verification = verifyAtlasSignedSessionToken(authRuntime.sessionSigningSecret, rawToken);
    if (verification.status !== "ready") {
      return {
        status: "invalid",
        message: verification.message
      };
    }

    const { payload } = verification;

    try {
      if (
        payload.source === "local-development" &&
        !canAtlasUseLocalDevelopmentSessions(appRuntime.appEnv, authRuntime.providerMode)
      ) {
        return {
          status: "invalid",
          message: "Signed local-development sessions are disabled for the current runtime boundary"
        };
      }

      if (payload.source === "identity-provider") {
        const persistedSession = await loadAuthSessionById(payload.sessionId ?? "");

        if (
          !persistedSession ||
          persistedSession.provider !== (payload.provider ?? "") ||
          persistedSession.userEmail.toLowerCase() !== payload.selection.userEmail.toLowerCase() ||
          persistedSession.organizationSlug !== payload.selection.organizationSlug ||
          persistedSession.role !== payload.selection.role
        ) {
          return {
            status: "invalid",
            message: "Identity-provider session could not be matched to a persisted Atlas session"
          };
        }

        await touchAuthSession(persistedSession.id).catch(() => null);

        return {
          status: "ready",
          actor: {
            user: {
              id: persistedSession.userId,
              email: persistedSession.userEmail,
              name: persistedSession.userName
            },
            organization: {
              id: persistedSession.organizationId,
              slug: persistedSession.organizationSlug,
              name: persistedSession.organizationName,
              kind: payload.selection.workspace
            },
            membership: {
              id: persistedSession.membershipId,
              role: payload.selection.role
            },
            workspace: payload.selection.workspace,
            agentId: payload.selection.agentId,
            source: "identity-provider",
            providerMode: persistedSession.authProviderMode === "EXTERNAL_OIDC" ? "external-oidc" : "identity-bridge",
            sessionId: persistedSession.id,
            principalOrganization: null,
            supportAccess: null,
            sessionIssuedAt: payload.issuedAt,
            sessionExpiresAt: payload.expiresAt
          },
          selection: payload.selection
        };
      }

      const membership = await this.loadMembership({
        role: payload.selection.role,
        userEmail: payload.selection.userEmail,
        organizationSlug: payload.selection.organizationSlug,
        workspace: payload.selection.workspace
      });

      if (!membership) {
        return {
          status: "invalid",
          message: "Signed actor session could not be resolved"
        };
      }

      const actor = this.createBaseActor(membership, {
        source: payload.source,
        providerMode:
          authRuntime.providerMode === "external-oidc"
            ? "external-oidc"
            : authRuntime.providerMode === "identity-bridge"
              ? "identity-bridge"
              : "local-signed",
        agentId: payload.selection.agentId,
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt,
        sessionId: null
      });

      if (!payload.supportAccess) {
        return {
          status: "ready",
          actor,
          selection: payload.selection
        };
      }

      if (
        payload.supportAccess.grantedByUserEmail !== payload.selection.userEmail.toLowerCase() ||
        !this.isSupportAccessAllowedEmail(payload.selection.userEmail)
      ) {
        return {
          status: "invalid",
          message: "Support-access session is not allowed for this operator identity"
        };
      }

      const supportGrant = await this.loadSupportAccessGrant(payload.supportAccess.grantId);
      if (
        !supportGrant ||
        supportGrant.status !== "ACTIVE" ||
        supportGrant.issuedByUser.email.toLowerCase() !== payload.selection.userEmail.toLowerCase() ||
        supportGrant.issuedByOrganization.slug !== payload.selection.organizationSlug ||
        supportGrant.targetOrganization.slug !== payload.supportAccess.targetOrganizationSlug ||
        supportGrant.targetWorkspace !== payload.supportAccess.targetWorkspace ||
        (requiresAtlasProviderBackedAuthForEnvironment(appRuntime.appEnv) && supportGrant.authProviderMode === "LOCAL_SIGNED") ||
        (requiresAtlasExternalOidcForReleaseStage(appRuntime.releaseStage) &&
          supportGrant.authProviderMode !== "EXTERNAL_OIDC")
      ) {
        return {
          status: "invalid",
          message: "Support-access grant is no longer valid for this session"
        };
      }

      return {
        status: "ready",
        selection: payload.selection,
        actor: {
          ...actor,
          organization: {
            id: supportGrant.targetOrganization.id,
            slug: supportGrant.targetOrganization.slug,
            name: supportGrant.targetOrganization.name,
            kind: supportGrant.targetOrganization.kind
          },
          workspace: supportGrant.targetOrganization.kind,
          agentId: null,
          source: "internal-support",
          principalOrganization: actor.organization,
          supportAccess: payload.supportAccess
        }
      };
    } catch (error) {
      return {
        status: "unavailable",
        message: error instanceof Error ? error.message : "Actor resolution is temporarily unavailable"
      };
    }
  }

  async resolveFromHeaders(headers: Record<string, string | string[] | undefined>): Promise<ActorResolutionResult> {
    const rawSignedSession = this.readSessionHeader(headers);
    const signedSessionToken = Array.isArray(rawSignedSession) ? rawSignedSession[0] : rawSignedSession;

    if (signedSessionToken) {
      return this.resolveFromSignedSessionToken(signedSessionToken);
    }

    return {
      status: "missing",
      message: "Missing signed actor session header"
    };
  }

  readSessionHeader(headers: Record<string, string | string[] | undefined>) {
    return headers[atlasLocalSessionHeaderName];
  }
}
