import { describe, expect, it } from "vitest";
import { createAtlasCsv, matchesAtlasAnalyticsTextFilter, parseAtlasAnalyticsFilters } from "./analytics-reporting";

describe("atlas analytics reporting", () => {
  it("parses analytics filters from query-shape input", () => {
    const filters = parseAtlasAnalyticsFilters({
      query: "dataset",
      requestStatus: "APPROVED",
      minAmountMinor: "1200",
      maxAmountMinor: "4500",
      startDate: "2026-04-01",
      endDate: "2026-04-11"
    });

    expect(filters).toMatchObject({
      query: "dataset",
      requestStatus: "APPROVED",
      minAmountMinor: 1200,
      maxAmountMinor: 4500,
      startDate: "2026-04-01",
      endDate: "2026-04-11"
    });
  });

  it("matches text filters across multiple optional fields", () => {
    expect(matchesAtlasAnalyticsTextFilter(["Atlas Demo Buyer", "Premium dataset unlock"], "dataset")).toBe(true);
    expect(matchesAtlasAnalyticsTextFilter(["Atlas Demo Buyer", undefined], "seller")).toBe(false);
  });

  it("creates escaped csv payloads", () => {
    const csv = createAtlasCsv(
      [
        {
          key: "name",
          label: "Name"
        },
        {
          key: "note",
          label: "Note"
        }
      ],
      [
        {
          name: "Atlas Demo Buyer",
          note: 'Needs "priority" follow-up'
        }
      ]
    );

    expect(csv).toBe('Name,Note\nAtlas Demo Buyer,"Needs ""priority"" follow-up"');
  });
});

