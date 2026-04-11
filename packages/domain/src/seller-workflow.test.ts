import { describe, expect, it } from "vitest";
import {
  atlasSellerServiceCreateSchema,
  atlasSellerServiceUpdateSchema,
  formatAtlasServicePricingModelLabel,
  formatAtlasServiceStatusLabel,
  formatAtlasServiceVisibilityLabel
} from "./seller-workflow";

describe("atlas seller workflow contracts", () => {
  it("validates seller service creation payloads", () => {
    expect(() =>
      atlasSellerServiceCreateSchema.parse({
        key: "premium-dataset-access",
        name: "Premium Dataset Access",
        description: "Provide a curated paid dataset unlock for buyer-side research and agent-driven analysis flows.",
        category: "dataset-access",
        status: "PUBLISHED",
        visibility: "TRUSTED_BUYERS",
        pricingModel: "FIXED",
        priceMinor: 2400,
        currency: "usd"
      })
    ).not.toThrow();
  });

  it("rejects invalid service keys and short descriptions", () => {
    expect(() =>
      atlasSellerServiceCreateSchema.parse({
        key: "Premium Dataset",
        name: "Premium Dataset Access",
        description: "Too short",
        category: "dataset-access",
        priceMinor: 2400,
        currency: "USD"
      })
    ).toThrow();
  });

  it("supports partial seller service updates", () => {
    expect(() =>
      atlasSellerServiceUpdateSchema.parse({
        status: "ARCHIVED",
        visibility: "PRIVATE",
        priceMinor: 4800
      })
    ).not.toThrow();
  });

  it("formats service labels for UI detail", () => {
    expect(formatAtlasServiceStatusLabel("PUBLISHED")).toBe("Published");
    expect(formatAtlasServiceVisibilityLabel("TRUSTED_BUYERS")).toBe("Trusted Buyers");
    expect(formatAtlasServicePricingModelLabel("FIXED")).toBe("Fixed");
  });
});
