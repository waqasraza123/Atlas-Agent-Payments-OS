import { describe, expect, it } from "vitest";
import {
  atlasPaymentExecutionSchema,
  determineAtlasSimulatedPaymentScenario,
  formatAtlasPaymentRailLabel,
  formatAtlasPaymentStatusLabel,
  formatAtlasReceiptStatusLabel,
  isAtlasPaymentExecutionEligible,
  isAtlasPaymentRetryEligible,
  resolveAtlasReceiptStatus
} from "./payments-workflow";

describe("atlas payments workflow contracts", () => {
  it("validates payment execution inputs", () => {
    expect(atlasPaymentExecutionSchema.parse({ rail: "INTERNAL_SIMULATED" })).toEqual({
      rail: "INTERNAL_SIMULATED"
    });
  });

  it("derives deterministic simulated outcomes from seeded scenarios", () => {
    expect(
      determineAtlasSimulatedPaymentScenario({
        scenarioKey: "payment-failed",
        serviceCategory: "digital-service",
        amountMinor: 4200
      }).outcome
    ).toBe("FAILED");

    expect(
      determineAtlasSimulatedPaymentScenario({
        scenarioKey: "approved-awaiting-execution",
        serviceCategory: "api-access",
        amountMinor: 2400
      }).outcome
    ).toBe("PENDING");

    expect(
      determineAtlasSimulatedPaymentScenario({
        scenarioKey: "executing-with-seller-confirmation-pending",
        serviceCategory: "digital-service",
        amountMinor: 6200
      }).outcome
    ).toBe("AUTHORIZED");
  });

  it("resolves receipt truth from payment and fulfillment state", () => {
    expect(resolveAtlasReceiptStatus({ paymentStatus: "CAPTURED", sellerFulfillmentStatus: "DELIVERED" })).toBe("AVAILABLE");
    expect(resolveAtlasReceiptStatus({ paymentStatus: "FAILED", sellerFulfillmentStatus: null })).toBe("FAILED");
    expect(resolveAtlasReceiptStatus({ paymentStatus: "AUTHORIZED", sellerFulfillmentStatus: null })).toBe("PENDING");
  });

  it("formats labels and eligibility helpers", () => {
    expect(formatAtlasPaymentRailLabel("INTERNAL_SIMULATED")).toBe("Internal Simulated");
    expect(formatAtlasPaymentStatusLabel("CAPTURED")).toBe("Captured");
    expect(formatAtlasReceiptStatusLabel("AVAILABLE")).toBe("Available");
    expect(isAtlasPaymentExecutionEligible("APPROVED")).toBe(true);
    expect(isAtlasPaymentRetryEligible("FAILED")).toBe(true);
    expect(isAtlasPaymentRetryEligible("CAPTURED")).toBe(false);
  });
});
