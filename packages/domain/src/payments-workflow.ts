import { z } from "zod";
import { paymentRails, paymentStatuses, receiptStatuses, type PaymentRail, type PaymentStatus, type ReceiptStatus } from "@atlas/types";

export const atlasPaymentExecutionSchema = z.object({
  rail: z.enum(paymentRails).default("INTERNAL_SIMULATED")
});

export type AtlasPaymentExecutionInput = z.infer<typeof atlasPaymentExecutionSchema>;

export type AtlasPaymentAttemptRecord = {
  id: string;
  paymentId: string;
  attemptNumber: number;
  rail: PaymentRail;
  status: PaymentStatus;
  reference: string | null;
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
  createdAt: string;
  updatedAt: string;
  attempts: AtlasPaymentAttemptRecord[];
};

export type AtlasReceiptRecord = {
  id: string;
  requestId: string;
  buyerOrganizationId: string;
  buyerOrganizationName: string;
  status: ReceiptStatus;
  storageKey: string | null;
  contentType: string | null;
  paymentReference: string | null;
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

export function isAtlasPaymentExecutionEligible(requestStatus: string) {
  return ["APPROVED", "EXECUTING"].includes(requestStatus);
}

export function isAtlasPaymentRetryEligible(paymentStatus: PaymentStatus) {
  return ["FAILED", "VOIDED"].includes(paymentStatus);
}

export function isAtlasPaymentTerminalStatus(paymentStatus: PaymentStatus) {
  return ["CAPTURED", "FAILED", "VOIDED"].includes(paymentStatus);
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
  sellerFulfillmentStatus: "DELIVERED" | "FAILED" | null;
}): ReceiptStatus {
  if (input.paymentStatus === "FAILED" || input.paymentStatus === "VOIDED" || input.sellerFulfillmentStatus === "FAILED") {
    return "FAILED";
  }

  if (input.paymentStatus === "CAPTURED" && input.sellerFulfillmentStatus === "DELIVERED") {
    return "AVAILABLE";
  }

  return "PENDING";
}

export function isAtlasPaymentStatus(value: string): value is PaymentStatus {
  return paymentStatuses.includes(value as PaymentStatus);
}

export function isAtlasReceiptStatus(value: string): value is ReceiptStatus {
  return receiptStatuses.includes(value as ReceiptStatus);
}
