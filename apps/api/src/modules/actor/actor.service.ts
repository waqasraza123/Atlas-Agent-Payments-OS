import {
  atlasLocalSessionHeaderName,
  type AtlasActorContext,
  type AtlasSupportAccessRecord
} from "@atlas/auth";
import { verifyAtlasSignedSessionToken } from "@atlas/auth/server";
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

  private async loadTargetOrganization(supportAccess: AtlasSupportAccessRecord) {
    return prisma.organization.findFirst({
      where: {
        slug: supportAccess.targetOrganizationSlug,
        kind: supportAccess.targetWorkspace
      }
    });
  }

  private createBaseActor(
    membership: NonNullable<MembershipWithRelations>,
    input: {
      source: AtlasActorContext["source"];
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
      principalOrganization: null,
      supportAccess: null,
      sessionIssuedAt: input.issuedAt,
      sessionExpiresAt: input.expiresAt
    } satisfies AtlasActorContext;
  }

  async resolveFromHeader(headerValue: string | string[] | undefined): Promise<ActorResolutionResult> {
    const rawToken = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!rawToken) {
      return {
        status: "missing",
        message: "Missing signed actor session header"
      };
    }

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

      const targetOrganization = await this.loadTargetOrganization(payload.supportAccess);
      if (!targetOrganization) {
        return {
          status: "invalid",
          message: "Support-access target organization could not be resolved"
        };
      }

      return {
        status: "ready",
        selection: payload.selection,
        actor: {
          ...actor,
          organization: {
            id: targetOrganization.id,
            slug: targetOrganization.slug,
            name: targetOrganization.name,
            kind: targetOrganization.kind
          },
          workspace: targetOrganization.kind,
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

  readSessionHeader(headers: Record<string, string | string[] | undefined>) {
    return headers[atlasLocalSessionHeaderName];
  }
}
