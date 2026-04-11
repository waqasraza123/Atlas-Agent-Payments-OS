import type { AtlasActorContext } from "@atlas/auth";
import type { MembershipRole, OrganizationKind } from "@atlas/types";
import type { ExecutionContext } from "@nestjs/common";
import { createParamDecorator, SetMetadata } from "@nestjs/common";
import { actorRequestProperty, requiredRolesMetadataKey, requiredWorkspacesMetadataKey } from "./actor.constants";
import type { ActorRequest } from "./actor.types";

export const CurrentActor = createParamDecorator((_: unknown, context: ExecutionContext): AtlasActorContext | undefined => {
  const request = context.switchToHttp().getRequest<ActorRequest>();
  return request[actorRequestProperty];
});

export function RequireRoles(...roles: MembershipRole[]) {
  return SetMetadata(requiredRolesMetadataKey, roles);
}

export function RequireWorkspace(workspace: OrganizationKind) {
  return SetMetadata(requiredWorkspacesMetadataKey, [workspace]);
}

export function RequireWorkspaces(...workspaces: OrganizationKind[]) {
  return SetMetadata(requiredWorkspacesMetadataKey, workspaces);
}
