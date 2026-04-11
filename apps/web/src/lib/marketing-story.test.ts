import { describe, expect, it } from "vitest";
import { createMarketingStoryModel } from "./marketing-story";

describe("marketing story model", () => {
  it("builds a durable demo narrative from shared seed and queue contracts", () => {
    const model = createMarketingStoryModel();

    expect(model.heroMetrics).toHaveLength(5);
    expect(model.heroMetrics.some((metric) => metric.label === "Queue families")).toBe(true);
    expect(model.workflow).toHaveLength(3);
    expect(model.demoScenarioCards.length).toBeGreaterThanOrEqual(4);
    expect(model.workspacePreviews.map((workspace) => workspace.href)).toEqual([
      "/buyer",
      "/seller",
      "/operator"
    ]);
  });
});
