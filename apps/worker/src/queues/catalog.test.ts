import { listAtlasQueueDefinitions } from "@atlas/domain";
import { describe, expect, it } from "vitest";
import { listAtlasWorkerQueueCatalog } from "./catalog";

describe("worker queue catalog", () => {
  it("matches the shared queue registry", () => {
    const catalog = listAtlasWorkerQueueCatalog();

    expect(catalog).toHaveLength(listAtlasQueueDefinitions().length);
    expect(catalog.map((entry) => entry.name)).toEqual(
      listAtlasQueueDefinitions().map((definition) => definition.name)
    );
  });

  it("keeps queue names unique and retry-aware", () => {
    const catalog = listAtlasWorkerQueueCatalog();

    expect(new Set(catalog.map((entry) => entry.name)).size).toBe(catalog.length);
    expect(catalog.every((entry) => entry.defaultAttempts > 1)).toBe(true);
    expect(catalog.every((entry) => entry.backoffDelayMs >= 5000)).toBe(true);
  });
});
