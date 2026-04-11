import { describe, expect, it } from "vitest";
import {
  buildAtlasOperatorCaseKey,
  classifyAtlasOperatorException,
  deriveAtlasOperatorAvailableActions,
  deriveAtlasOperatorReconciliationState,
  isAtlasOperatorActionAllowed
} from "./operator-workflow";

describe("atlas operator workflow", () => {
  it("classifies payment failures and retry exhaustion into operator cases", () => {
    expect(
      classifyAtlasOperatorException({
        requestId: "request-1",
        requestTitle: "Failed request",
        buyerOrganizationId: "buyer-1",
        buyerOrganizationName: "Buyer",
        sellerOrganizationId: "seller-1",
        sellerOrganizationName: "Seller",
        requestStatus: "FAILED",
        paymentId: "payment-1",
        paymentStatus: "FAILED",
        receiptId: "receipt-1",
        receiptStatus: "FAILED",
        paymentAttemptCount: 1,
        providerStatus: "failed",
        sellerFulfillmentStatus: null,
        paused: false
      })
    ).toMatchObject({
      category: "RECEIPT_FAILURE",
      severity: "CRITICAL"
    });

    expect(
      classifyAtlasOperatorException({
        requestId: "request-2",
        requestTitle: "Retry exhausted request",
        buyerOrganizationId: "buyer-1",
        buyerOrganizationName: "Buyer",
        sellerOrganizationId: "seller-1",
        sellerOrganizationName: "Seller",
        requestStatus: "FAILED",
        paymentId: "payment-1",
        paymentStatus: "FAILED",
        receiptId: null,
        receiptStatus: null,
        paymentAttemptCount: 3,
        providerStatus: "failed",
        sellerFulfillmentStatus: null,
        paused: false
      })
    ).toMatchObject({
      category: "PAYMENT_RETRY_EXHAUSTED",
      status: "ACTION_REQUIRED"
    });
  });

  it("derives delayed and paused cases from reconciliation posture", () => {
    expect(
      deriveAtlasOperatorReconciliationState({
        requestId: "request-3",
        requestTitle: "Awaiting seller confirmation",
        buyerOrganizationId: "buyer-1",
        buyerOrganizationName: "Buyer",
        sellerOrganizationId: "seller-1",
        sellerOrganizationName: "Seller",
        requestStatus: "EXECUTING",
        paymentId: "payment-1",
        paymentStatus: "CAPTURED",
        receiptId: "receipt-1",
        receiptStatus: "PENDING",
        paymentAttemptCount: 1,
        providerStatus: "captured",
        sellerFulfillmentStatus: null,
        paused: false
      })
    ).toBe("AWAITING_SELLER_CONFIRMATION");

    expect(
      classifyAtlasOperatorException({
        requestId: "request-4",
        requestTitle: "Paused request",
        buyerOrganizationId: "buyer-1",
        buyerOrganizationName: "Buyer",
        sellerOrganizationId: "seller-1",
        sellerOrganizationName: "Seller",
        requestStatus: "EXECUTING",
        paymentId: "payment-1",
        paymentStatus: "AUTHORIZED",
        receiptId: "receipt-1",
        receiptStatus: "PENDING",
        paymentAttemptCount: 1,
        providerStatus: "authorized",
        sellerFulfillmentStatus: null,
        paused: true
      })
    ).toMatchObject({
      category: "REQUEST_PAUSED",
      status: "ACTION_REQUIRED"
    });
  });

  it("derives safe operator actions from paused and retry posture", () => {
    const retryActions = deriveAtlasOperatorAvailableActions({
      status: "OPEN",
      paused: false,
      retryEligible: true,
      requestStatus: "FAILED"
    });

    expect(retryActions).toContain("REQUEUE_PAYMENT");
    expect(retryActions).toContain("PAUSE_REQUEST");

    const pausedActions = deriveAtlasOperatorAvailableActions({
      status: "ACTION_REQUIRED",
      paused: true,
      retryEligible: false,
      requestStatus: "EXECUTING"
    });

    expect(pausedActions).toContain("RELEASE_REQUEST");
    expect(isAtlasOperatorActionAllowed({
      actionType: "RELEASE_REQUEST",
      status: "ACTION_REQUIRED",
      paused: true,
      retryEligible: false,
      requestStatus: "EXECUTING"
    })).toBe(true);
    expect(isAtlasOperatorActionAllowed({
      actionType: "REQUEUE_PAYMENT",
      status: "ACTION_REQUIRED",
      paused: true,
      retryEligible: false,
      requestStatus: "EXECUTING"
    })).toBe(false);
  });

  it("creates stable operator case keys", () => {
    expect(buildAtlasOperatorCaseKey("PAYMENT_FAILURE", "request-1")).toBe("PAYMENT_FAILURE:request-1");
  });
});
