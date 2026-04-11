import {
  atlasLocalSessionHeaderName,
  canAtlasActorAccessWorkspace,
  parseAtlasLocalSessionSelection,
  type AtlasActorContext
} from "@atlas/auth";
import { prisma } from "@atlas/database";
import type { MembershipRole, OrganizationKind } from "@atlas/types";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { actorRequestProperty, requiredRolesMetadataKey, requiredWorkspaceMetadataKey } from "./actor.constants";
import type { ActorRequest } from "./actor.types";

@Injectable()
export class ActorGuard implements CanActivate {
  private readMetadata<T>(metadataKey: string, context: ExecutionContext) {
    return (
      Reflect.getMetadata(metadataKey, context.getHandler()) ??
      Reflect.getMetadata(metadataKey, context.getClass())
    ) as T | undefined;
  }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ActorRequest>();
    const token = request.headers[atlasLocalSessionHeaderName];
    const rawToken = Array.isArray(token) ? token[0] : token;
    const selection = parseAtlasLocalSessionSelection(rawToken);

    if (!selection) {
      throw new UnauthorizedException("Missing or invalid local actor session header");
    }

    let actor: AtlasActorContext | null = null;

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

      if (membership) {
        actor = {
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
        };
      }
    } catch (error) {
      throw new ServiceUnavailableException(
        error instanceof Error ? error.message : "Actor resolution is temporarily unavailable"
      );
    }

    if (!actor) {
      throw new UnauthorizedException("Local actor session could not be resolved");
    }

    request[actorRequestProperty] = actor;

    const requiredWorkspace = this.readMetadata<OrganizationKind>(requiredWorkspaceMetadataKey, context);
    if (requiredWorkspace && !canAtlasActorAccessWorkspace(actor.membership.role, requiredWorkspace, actor.organization.kind)) {
      throw new ForbiddenException("Actor does not have access to this workspace");
    }

    const requiredRoles = this.readMetadata<MembershipRole[]>(requiredRolesMetadataKey, context);
    if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(actor.membership.role)) {
      throw new ForbiddenException("Actor does not have the required role");
    }

    return true;
  }
}
