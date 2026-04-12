import {
  atlasIdentityAssertionHeaderName,
  atlasLocalSessionHeaderName,
  type AtlasActorContext
} from "@atlas/auth";
import { verifyAtlasIdentityAssertionToken, verifyAtlasSignedSessionToken } from "@atlas/auth/server";
import { appRuntime, authRuntime } from "@atlas/config";
import { prisma } from "@atlas/database";
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

    if (grant.status === "ACTIVE" && grant.expiresAt.getTime() <= Date.now()) {
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

    if (appRuntime.appEnv === "production") {
      return {
        status: "invalid",
        message: "Signed local-development and support sessions are disabled in production"
      };
    }

    try {
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
        providerMode: authRuntime.providerMode === "identity-bridge" ? "identity-bridge" : "local-signed",
        agentId: payload.selection.agentId,
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt
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
        supportGrant.targetWorkspace !== payload.supportAccess.targetWorkspace
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

  private async resolveFromIdentityAssertion(rawAssertion: string): Promise<ActorResolutionResult> {
    const verification = verifyAtlasIdentityAssertionToken(authRuntime.identityBridgeSecret, rawAssertion);
    if (verification.status !== "ready") {
      return {
        status: "invalid",
        message: verification.message
      };
    }

    const { payload } = verification;

    try {
      const membership = await this.loadMembership({
        role: payload.selection.role,
        userEmail: payload.selection.userEmail,
        organizationSlug: payload.selection.organizationSlug,
        workspace: payload.selection.workspace
      });

      if (!membership) {
        return {
          status: "invalid",
          message: "Identity assertion could not be resolved"
        };
      }

      return {
        status: "ready",
        actor: this.createBaseActor(membership, {
          source: "identity-bridge",
          providerMode: "identity-bridge",
          agentId: payload.selection.agentId,
          issuedAt: payload.issuedAt,
          expiresAt: payload.expiresAt
        }),
        selection: payload.selection
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

    const rawIdentityAssertion = this.readIdentityAssertionHeader(headers);
    const identityAssertionToken = Array.isArray(rawIdentityAssertion) ? rawIdentityAssertion[0] : rawIdentityAssertion;

    if (identityAssertionToken) {
      return this.resolveFromIdentityAssertion(identityAssertionToken);
    }

    return {
      status: "missing",
      message:
        authRuntime.providerMode === "identity-bridge"
          ? "Missing identity assertion header"
          : "Missing signed actor session header"
    };
  }

  readSessionHeader(headers: Record<string, string | string[] | undefined>) {
    return headers[atlasLocalSessionHeaderName];
  }

  readIdentityAssertionHeader(headers: Record<string, string | string[] | undefined>) {
    return headers[atlasIdentityAssertionHeaderName];
  }
}
