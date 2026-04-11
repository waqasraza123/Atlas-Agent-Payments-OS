import { listAtlasQueueDefinitions } from "@atlas/domain";
import { describe, expect, it } from "vitest";
import { getAtlasQueueProcessor } from "./index";

describe("worker processor registry", () => {
  it("provides a processor for every defined queue", async () => {
    for (const definition of listAtlasQueueDefinitions()) {
      const processor = getAtlasQueueProcessor(definition.key);

      expect(typeof processor).toBe("function");

      const result = await processor({
        id: `${definition.key}-job`,
        queueName: definition.name
      } as never);

      expect(result).toMatchObject({
        queue: definition.name,
        jobId: `${definition.key}-job`
      });
    }
  });
});
