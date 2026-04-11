import { listAtlasQueueDefinitions } from "@atlas/domain";

export function listAtlasWorkerQueueCatalog() {
  return listAtlasQueueDefinitions().map((definition) => ({
    key: definition.key,
    family: definition.family,
    name: definition.name,
    defaultAttempts: definition.defaultAttempts,
    backoffDelayMs: definition.backoffDelayMs
  }));
}
