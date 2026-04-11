import { createAtlasApiDomainSnapshot, listAtlasApiDomainDefinitions, type AtlasApiDomainKey } from "@atlas/domain";
import type { AtlasActorContext } from "@atlas/auth";

export function createDomainSummary(key: AtlasApiDomainKey, actor?: AtlasActorContext) {
  return {
    module: createAtlasApiDomainSnapshot(key, {
      actorRole: actor?.membership.role,
      workspace: actor?.workspace
    }),
    actor: actor
      ? {
          userId: actor.user.id,
          organizationId: actor.organization.id,
          workspace: actor.workspace,
          role: actor.membership.role
        }
      : null
  };
}

export function listDomainSummaries() {
  return listAtlasApiDomainDefinitions().map((definition) => ({
    module: createAtlasApiDomainSnapshot(definition.key),
    actor: null
  }));
}
