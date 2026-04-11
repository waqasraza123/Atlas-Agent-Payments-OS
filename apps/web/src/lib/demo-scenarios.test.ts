import { describe, expect, it } from "vitest";
import { createAtlasDemoScenarioCards, createAtlasFocusedDemoScenarioCards } from "./demo-scenarios";

describe("demo scenarios", () => {
  it("creates stable buyer-facing demo scenario cards", () => {
    const cards = createAtlasDemoScenarioCards();

    expect(cards.length).toBeGreaterThanOrEqual(6);
    expect(cards[0]?.key).toBe("awaiting-approval");
    expect(cards.some((card) => card.key === "completed-success")).toBe(true);
  });

  it("focuses the demo journey around the current request", () => {
    const cards = createAtlasFocusedDemoScenarioCards("phase-0-request-completed", 3);

    expect(cards).toHaveLength(3);
    expect(cards.some((card) => card.href.endsWith("/phase-0-request-completed"))).toBe(true);
  });
});
