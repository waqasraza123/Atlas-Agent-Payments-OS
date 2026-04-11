import { describe, expect, it } from "vitest";
import {
  atlasPaymentMaximumAttemptCount,
  atlasPaymentExecutionSchema,
  deriveAtlasPaymentReconciliationState,
  determineAtlasSimulatedPaymentScenario,
  formatAtlasPaymentRailLabel,
  formatAtlasPaymentReconciliationStateLabel,
  formatAtlasPaymentStatusLabel,
  formatAtlasReceiptStatusLabel,
  isAtlasPaymentAttemptLimitReached,
  isAtlasPaymentExecutionEligible,
  isAtlasPaymentRetryEligible,
  isAtlasStripePaymentIntentStatus,
  normalizeAtlasStripePaymentStatus,
  resolveAtlasReceiptStatus,
  summarizeAtlasReceiptEvidence
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
    expect(formatAtlasPaymentReconciliationStateLabel("AWAITING_SELLER_CONFIRMATION")).toBe("Awaiting Seller Confirmation");
    expect(isAtlasPaymentExecutionEligible("APPROVED")).toBe(true);
    expect(isAtlasPaymentRetryEligible("FAILED")).toBe(true);
    expect(isAtlasPaymentRetryEligible("CAPTURED")).toBe(false);
  });

  it("normalizes stripe payment intent statuses", () => {
    expect(normalizeAtlasStripePaymentStatus("requires_payment_method")).toBe("PENDING");
    expect(normalizeAtlasStripePaymentStatus("requires_capture")).toBe("AUTHORIZED");
    expect(normalizeAtlasStripePaymentStatus("succeeded")).toBe("CAPTURED");
    expect(normalizeAtlasStripePaymentStatus("canceled")).toBe("VOIDED");
    expect(isAtlasStripePaymentIntentStatus("processing")).toBe(true);
    expect(isAtlasStripePaymentIntentStatus("unknown")).toBe(false);
  });

  it("derives reconciliation posture and retry caps", () => {
    expect(
      deriveAtlasPaymentReconciliationState({
        requestStatus: "APPROVED",
        paymentStatus: null,
        receiptStatus: null,
        sellerFulfillmentStatus: null
      })
    ).toBe("READY_TO_EXECUTE");
    expect(
      deriveAtlasPaymentReconciliationState({
        requestStatus: "EXECUTING",
        paymentStatus: "CAPTURED",
        receiptStatus: "PENDING",
        sellerFulfillmentStatus: null
      })
    ).toBe("AWAITING_SELLER_CONFIRMATION");
    expect(isAtlasPaymentAttemptLimitReached(atlasPaymentMaximumAttemptCount)).toBe(true);
    expect(isAtlasPaymentAttemptLimitReached(atlasPaymentMaximumAttemptCount - 1)).toBe(false);
  });

  it("summarizes receipt evidence for detail and list surfaces", () => {
    expect(
      summarizeAtlasReceiptEvidence({
        reconciliationState: "RECEIPT_AVAILABLE",
        paymentReference: "pi_123",
        providerStatus: "succeeded",
        paymentStatus: "CAPTURED",
        sellerFulfillmentStatus: "DELIVERED",
        storageKey: "receipts/request-1.json",
        attemptCount: 2
      })
    ).toEqual([
      "Reconciliation Receipt Available",
      "Payment Captured",
      "Provider succeeded",
      "Reference pi_123",
      "Artifact receipts/request-1.json",
      "Attempts 2",
      "Seller Delivered"
    ]);
  });
});
