import { createAtlasQueueSnapshot, listAtlasQueueDefinitions, type AtlasQueueKey } from "@atlas/domain";

export function createQueueSummary(key: AtlasQueueKey) {
  return {
    queue: createAtlasQueueSnapshot(key)
  };
}

export function listQueueSummaries() {
  return listAtlasQueueDefinitions().map((definition) => ({
    queue: createAtlasQueueSnapshot(definition.key)
  }));
}
