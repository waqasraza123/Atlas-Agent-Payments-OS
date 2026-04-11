import {
  atlasLocalSessionHeaderName,
  parseAtlasLocalSessionSelection,
  type AtlasActorContext
} from "@atlas/auth";
import { prisma } from "@atlas/database";
import { Injectable } from "@nestjs/common";
import type { ActorResolutionResult } from "./actor.types";

@Injectable()
export class ActorResolutionService {
  async resolveFromHeader(headerValue: string | string[] | undefined): Promise<ActorResolutionResult> {
    const rawToken = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!rawToken) {
      return {
        status: "missing",
        message: "Missing local actor session header"
      };
    }

    const selection = parseAtlasLocalSessionSelection(rawToken);

    if (!selection) {
      return {
        status: "invalid",
        message: "Missing or invalid local actor session header"
      };
    }

    try {
      const membership = await prisma.membership.findFirst({
        where: {
          role: selection.role,
          user: {
            email: selection.userEmail
          },
          organization: {
            slug: selection.organizationSlug,
            kind: selection.workspace
          }
        },
        include: {
          user: true,
          organization: true
        }
      });

      if (!membership) {
        return {
          status: "invalid",
          message: "Local actor session could not be resolved"
        };
      }

      const actor = {
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
        agentId: selection.agentId,
        source: "local-development"
      } satisfies AtlasActorContext;

      return {
        status: "ready",
        actor,
        selection
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
