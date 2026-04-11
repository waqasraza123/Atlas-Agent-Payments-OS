import {
  canAtlasActorAccessWorkspace,
  type AtlasActorContext
} from "@atlas/auth";
import type { MembershipRole, OrganizationKind } from "@atlas/types";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { actorRequestProperty, requiredRolesMetadataKey, requiredWorkspacesMetadataKey } from "./actor.constants";
import { ActorResolutionService } from "./actor.service";
import type { ActorRequest } from "./actor.types";

@Injectable()
export class ActorGuard implements CanActivate {
  constructor(private readonly actorResolutionService: ActorResolutionService) {}

  private readMetadata<T>(metadataKey: string, context: ExecutionContext) {
    return (
      Reflect.getMetadata(metadataKey, context.getHandler()) ??
      Reflect.getMetadata(metadataKey, context.getClass())
    ) as T | undefined;
  }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ActorRequest>();
    const resolution = await this.actorResolutionService.resolveFromHeader(
      this.actorResolutionService.readSessionHeader(request.headers)
    );

    if (resolution.status === "missing" || resolution.status === "invalid") {
      throw new UnauthorizedException(resolution.message);
    }

    if (resolution.status === "unavailable") {
      throw new ServiceUnavailableException(resolution.message);
    }

    const actor: AtlasActorContext = resolution.actor;
    request[actorRequestProperty] = actor;

    const requiredWorkspaces = this.readMetadata<OrganizationKind[]>(requiredWorkspacesMetadataKey, context);
    if (
      requiredWorkspaces &&
      requiredWorkspaces.length > 0 &&
      !requiredWorkspaces.some((workspace) =>
        canAtlasActorAccessWorkspace(actor.membership.role, workspace, actor.organization.kind)
      )
    ) {
      throw new ForbiddenException("Actor does not have access to this workspace");
    }

    const requiredRoles = this.readMetadata<MembershipRole[]>(requiredRolesMetadataKey, context);
    if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(actor.membership.role)) {
      throw new ForbiddenException("Actor does not have the required role");
    }

    return true;
  }
}
