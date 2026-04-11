import { z } from "zod";
import { paymentRails, paymentStatuses, receiptStatuses, type PaymentRail, type PaymentStatus, type ReceiptStatus } from "@atlas/types";

export const atlasPaymentExecutionSchema = z.object({
  rail: z.enum(paymentRails).default("INTERNAL_SIMULATED")
});

export type AtlasPaymentExecutionInput = z.infer<typeof atlasPaymentExecutionSchema>;

export const atlasPaymentMaximumAttemptCount = 3 as const;

export const atlasStripePaymentIntentStatuses = [
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
  "requires_capture",
  "succeeded",
  "canceled"
] as const;
export type AtlasStripePaymentIntentStatus = (typeof atlasStripePaymentIntentStatuses)[number];

export const atlasPaymentReconciliationStates = [
  "READY_TO_EXECUTE",
  "AWAITING_PAYMENT_METHOD",
  "AWAITING_SETTLEMENT",
  "AWAITING_SELLER_CONFIRMATION",
  "RECEIPT_AVAILABLE",
  "FAILED",
  "CANCELED"
] as const;
export type AtlasPaymentReconciliationState = (typeof atlasPaymentReconciliationStates)[number];

type AtlasPaymentSellerFulfillmentStatus = "DELIVERED" | "FAILED" | null;

export type AtlasPaymentAttemptRecord = {
  id: string;
  paymentId: string;
  attemptNumber: number;
  rail: PaymentRail;
  status: PaymentStatus;
  reference: string | null;
  providerStatus: string | null;
  evidence: Record<string, unknown> | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export type AtlasPaymentIntentRecord = {
  id: string;
  requestId: string;
  buyerOrganizationId: string;
  buyerOrganizationName: string;
  sellerOrganizationId: string | null;
  sellerOrganizationName: string | null;
  rail: PaymentRail;
  status: PaymentStatus;
  provider: string;
  reference: string | null;
  amountMinor: number;
  currency: string;
  latestAttemptNumber: number;
  latestAttemptStatus: PaymentStatus | null;
  requestStatus: string;
  receiptStatus: ReceiptStatus | null;
  sellerFulfillmentStatus: AtlasPaymentSellerFulfillmentStatus;
  retryEligible: boolean;
  reconciliationState: AtlasPaymentReconciliationState;
  createdAt: string;
  updatedAt: string;
  attempts: AtlasPaymentAttemptRecord[];
};

export type AtlasReceiptRecord = {
  id: string;
  requestId: string;
  buyerOrganizationId: string;
  buyerOrganizationName: string;
  sellerOrganizationId: string | null;
  sellerOrganizationName: string | null;
  requestTitle: string;
  requestStatus: string;
  serviceCategory: string;
  status: ReceiptStatus;
  amountMinor: number;
  currency: string;
  storageKey: string | null;
  contentType: string | null;
  paymentReference: string | null;
  paymentStatus: PaymentStatus | null;
  sellerFulfillmentStatus: AtlasPaymentSellerFulfillmentStatus;
  rail: PaymentRail | null;
  providerStatus: string | null;
  attemptCount: number;
  reconciliationState: AtlasPaymentReconciliationState;
  evidenceSummary: string[];
  createdAt: string;
  updatedAt: string;
};

export const atlasSimulatedPaymentOutcomes = ["PENDING", "AUTHORIZED", "CAPTURED", "FAILED", "VOIDED"] as const;
export type AtlasSimulatedPaymentOutcome = (typeof atlasSimulatedPaymentOutcomes)[number];

export type AtlasSimulatedPaymentScenario = {
  outcome: AtlasSimulatedPaymentOutcome;
  referenceSuffix: string;
  evidence: Record<string, unknown>;
};

export function formatAtlasPaymentRailLabel(rail: PaymentRail) {
  return rail === "INTERNAL_SIMULATED" ? "Internal Simulated" : "Stripe";
}

export function formatAtlasPaymentStatusLabel(status: PaymentStatus) {
  return status.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\w/g, (character) => character.toUpperCase());
}

export function formatAtlasReceiptStatusLabel(status: ReceiptStatus) {
  return status.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\w/g, (character) => character.toUpperCase());
}

export function formatAtlasPaymentReconciliationStateLabel(state: AtlasPaymentReconciliationState) {
  return state.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\w/g, (character) => character.toUpperCase());
}

function formatAtlasPaymentSellerFulfillmentLabel(status: AtlasPaymentSellerFulfillmentStatus) {
  if (!status) {
    return "Not recorded";
  }

  return status === "DELIVERED" ? "Delivered" : "Failed";
}

export function isAtlasPaymentExecutionEligible(requestStatus: string) {
  return ["APPROVED", "EXECUTING"].includes(requestStatus);
}

export function isAtlasPaymentRetryEligible(paymentStatus: PaymentStatus) {
  return ["FAILED", "VOIDED"].includes(paymentStatus);
}

export function isAtlasPaymentTerminalStatus(paymentStatus: PaymentStatus) {
  return ["CAPTURED", "FAILED", "VOIDED"].includes(paymentStatus);
}

export function isAtlasPaymentAttemptLimitReached(attemptCount: number) {
  return attemptCount >= atlasPaymentMaximumAttemptCount;
}

export function normalizeAtlasStripePaymentStatus(status: AtlasStripePaymentIntentStatus): PaymentStatus {
  if (status === "requires_capture") {
    return "AUTHORIZED";
  }

  if (status === "succeeded") {
    return "CAPTURED";
  }

  if (status === "canceled") {
    return "VOIDED";
  }

  return "PENDING";
}

export function determineAtlasSimulatedPaymentScenario(input: {
  scenarioKey: string | null;
  serviceCategory: string;
  amountMinor: number;
}): AtlasSimulatedPaymentScenario {
  if (input.scenarioKey === "payment-failed") {
    return {
      outcome: "FAILED",
      referenceSuffix: "failed",
      evidence: {
        scenarioKey: input.scenarioKey,
        failureReason: "Simulated payment rail rejection"
      }
    };
  }

  if (input.scenarioKey === "approved-awaiting-execution") {
    return {
      outcome: "PENDING",
      referenceSuffix: "pending",
      evidence: {
        scenarioKey: input.scenarioKey,
        note: "Simulated payment intent created and awaiting settlement."
      }
    };
  }

  if (input.scenarioKey === "executing-with-seller-confirmation-pending") {
    return {
      outcome: "AUTHORIZED",
      referenceSuffix: "authorized",
      evidence: {
        scenarioKey: input.scenarioKey,
        note: "Simulated payment authorized while seller confirmation remains pending."
      }
    };
  }

  if (input.amountMinor >= 10000 && input.serviceCategory !== "api-access") {
    return {
      outcome: "AUTHORIZED",
      referenceSuffix: "managed",
      evidence: {
        reason: "High-value managed service stays authorized until seller completion."
      }
    };
  }

  return {
    outcome: "CAPTURED",
    referenceSuffix: "captured",
    evidence: {
      note: "Simulated payment captured successfully."
    }
  };
}

export function resolveAtlasReceiptStatus(input: {
  paymentStatus: PaymentStatus;
  sellerFulfillmentStatus: AtlasPaymentSellerFulfillmentStatus;
}): ReceiptStatus {
  if (input.paymentStatus === "FAILED" || input.paymentStatus === "VOIDED" || input.sellerFulfillmentStatus === "FAILED") {
    return "FAILED";
  }

  if (input.paymentStatus === "CAPTURED" && input.sellerFulfillmentStatus === "DELIVERED") {
    return "AVAILABLE";
  }

  return "PENDING";
}

export function deriveAtlasPaymentReconciliationState(input: {
  requestStatus: string;
  paymentStatus: PaymentStatus | null;
  receiptStatus: ReceiptStatus | null;
  sellerFulfillmentStatus: AtlasPaymentSellerFulfillmentStatus;
}) : AtlasPaymentReconciliationState {
  if (input.requestStatus === "APPROVED" && !input.paymentStatus) {
    return "READY_TO_EXECUTE";
  }

  if (input.requestStatus === "CANCELED" || input.paymentStatus === "VOIDED") {
    return "CANCELED";
  }

  if (input.requestStatus === "FAILED" || input.paymentStatus === "FAILED" || input.receiptStatus === "FAILED") {
    return "FAILED";
  }

  if (input.receiptStatus === "AVAILABLE") {
    return "RECEIPT_AVAILABLE";
  }

  if (input.paymentStatus === "CAPTURED" && input.sellerFulfillmentStatus !== "DELIVERED") {
    return "AWAITING_SELLER_CONFIRMATION";
  }

  if (input.paymentStatus === "AUTHORIZED") {
    return "AWAITING_SETTLEMENT";
  }

  return "AWAITING_PAYMENT_METHOD";
}

export function isAtlasPaymentStatus(value: string): value is PaymentStatus {
  return paymentStatuses.includes(value as PaymentStatus);
}

export function isAtlasReceiptStatus(value: string): value is ReceiptStatus {
  return receiptStatuses.includes(value as ReceiptStatus);
}

export function summarizeAtlasReceiptEvidence(input: {
  reconciliationState: AtlasPaymentReconciliationState;
  paymentReference: string | null;
  providerStatus: string | null;
  paymentStatus: PaymentStatus | null;
  sellerFulfillmentStatus: AtlasPaymentSellerFulfillmentStatus;
  storageKey: string | null;
  attemptCount: number;
}) {
  const summary = [
    `Reconciliation ${formatAtlasPaymentReconciliationStateLabel(input.reconciliationState)}`,
    input.paymentStatus ? `Payment ${formatAtlasPaymentStatusLabel(input.paymentStatus)}` : null,
    input.providerStatus ? `Provider ${input.providerStatus}` : null,
    input.paymentReference ? `Reference ${input.paymentReference}` : null,
    input.storageKey ? `Artifact ${input.storageKey}` : null,
    input.attemptCount > 0 ? `Attempts ${input.attemptCount}` : null,
    input.sellerFulfillmentStatus ? `Seller ${formatAtlasPaymentSellerFulfillmentLabel(input.sellerFulfillmentStatus)}` : null
  ];

  return summary.filter((value): value is string => Boolean(value));
}

export function isAtlasStripePaymentIntentStatus(value: string): value is AtlasStripePaymentIntentStatus {
  return atlasStripePaymentIntentStatuses.includes(value as AtlasStripePaymentIntentStatus);
}
