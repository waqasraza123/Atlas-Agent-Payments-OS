import { z } from "zod";
import {
  notificationStatuses,
  operatorActionTypes,
  operatorCaseCategories,
  operatorCaseSeverities,
  operatorCaseStatuses,
  type NotificationStatus,
  type OperatorActionType,
  type OperatorCaseCategory,
  type OperatorCaseSeverity,
  type OperatorCaseStatus,
  type PaymentRail,
  type PaymentStatus,
  type ReceiptStatus
} from "@atlas/types";
import {
  atlasPaymentMaximumAttemptCount,
  deriveAtlasPaymentReconciliationState,
  type AtlasPaymentReconciliationState
} from "./payments-workflow";

export const atlasOperatorCaseFiltersSchema = z.object({
  query: z.string().trim().max(120).nullish(),
  category: z.enum(operatorCaseCategories).nullish(),
  severity: z.enum(operatorCaseSeverities).nullish(),
  status: z.enum(operatorCaseStatuses).nullish()
});

export type AtlasOperatorCaseFilters = z.infer<typeof atlasOperatorCaseFiltersSchema>;

export const atlasOperatorAuditFiltersSchema = z.object({
  query: z.string().trim().max(120).nullish(),
  eventType: z.string().trim().max(120).nullish(),
  targetType: z.string().trim().max(120).nullish()
});

export type AtlasOperatorAuditFilters = z.infer<typeof atlasOperatorAuditFiltersSchema>;

export const atlasOperatorCaseActionSchema = z.object({
  actionType: z.enum(operatorActionTypes),
  reason: z.string().trim().min(8).max(500)
});

export type AtlasOperatorCaseActionInput = z.infer<typeof atlasOperatorCaseActionSchema>;

export type AtlasOperatorCaseClassification = {
  category: OperatorCaseCategory;
  severity: OperatorCaseSeverity;
  status: OperatorCaseStatus;
  title: string;
  summary: string;
};

export type AtlasOperatorCaseRecord = {
  id: string;
  caseKey: string;
  category: OperatorCaseCategory;
  severity: OperatorCaseSeverity;
  status: OperatorCaseStatus;
  title: string;
  summary: string;
  requestId: string | null;
  paymentId: string | null;
  paymentRail: PaymentRail | null;
  receiptId: string | null;
  buyerOrganizationId: string | null;
  buyerOrganizationName: string | null;
  sellerOrganizationId: string | null;
  sellerOrganizationName: string | null;
  requestTitle: string | null;
  requestStatus: string | null;
  paymentStatus: PaymentStatus | null;
  receiptStatus: ReceiptStatus | null;
  providerStatus: string | null;
  reconciliationState: AtlasPaymentReconciliationState | null;
  attemptCount: number;
  paused: boolean;
  resolutionReason: string | null;
  availableActions: OperatorActionType[];
  createdAt: string;
  updatedAt: string;
};

export type AtlasOperatorActionRecord = {
  id: string;
  caseId: string;
  actionType: OperatorActionType;
  reason: string;
  actorUserId: string;
  actorUserName: string | null;
  actorUserEmail: string;
  createdAt: string;
};

export type AtlasOperatorNotificationRecord = {
  id: string;
  dedupeKey: string;
  caseId: string | null;
  category: string;
  title: string;
  description: string;
  status: NotificationStatus;
  createdAt: string;
  updatedAt: string;
};

export type AtlasOperatorAuditEventRecord = {
  id: string;
  eventType: string;
  targetType: string;
  targetId: string;
  actorType: string;
  actorLabel: string;
  organizationName: string | null;
  requestTitle: string | null;
  occurredAt: string;
};

export type AtlasOperatorOverviewRecord = {
  openCaseCount: number;
  criticalCaseCount: number;
  actionRequiredCount: number;
  unreadNotificationCount: number;
  delayedCaseCount: number;
  failedCaseCount: number;
  recentCases: AtlasOperatorCaseRecord[];
  recentNotifications: AtlasOperatorNotificationRecord[];
  recentAuditEvents: AtlasOperatorAuditEventRecord[];
};

export type AtlasOperatorExceptionSignal = {
  requestId: string;
  requestTitle: string;
  buyerOrganizationId: string;
  buyerOrganizationName: string;
  sellerOrganizationId: string | null;
  sellerOrganizationName: string | null;
  requestStatus: string;
  paymentId: string | null;
  paymentStatus: PaymentStatus | null;
  receiptId: string | null;
  receiptStatus: ReceiptStatus | null;
  paymentAttemptCount: number;
  providerStatus: string | null;
  sellerFulfillmentStatus: "DELIVERED" | "FAILED" | null;
  paused: boolean;
};

export function formatAtlasOperatorCaseCategoryLabel(category: OperatorCaseCategory) {
  return category.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\w/g, (character) => character.toUpperCase());
}

export function formatAtlasOperatorCaseSeverityLabel(severity: OperatorCaseSeverity) {
  return severity.charAt(0) + severity.slice(1).toLowerCase();
}

export function formatAtlasOperatorCaseStatusLabel(status: OperatorCaseStatus) {
  return status.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\w/g, (character) => character.toUpperCase());
}

export function formatAtlasOperatorActionTypeLabel(actionType: OperatorActionType) {
  return actionType.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\w/g, (character) => character.toUpperCase());
}

export function formatAtlasNotificationStatusLabel(status: NotificationStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function buildAtlasOperatorCaseKey(category: OperatorCaseCategory, requestId: string) {
  return `${category}:${requestId}`;
}

export function deriveAtlasOperatorReconciliationState(signal: AtlasOperatorExceptionSignal) {
  return deriveAtlasPaymentReconciliationState({
    requestStatus: signal.requestStatus,
    paymentStatus: signal.paymentStatus,
    receiptStatus: signal.receiptStatus,
    sellerFulfillmentStatus: signal.sellerFulfillmentStatus
  });
}

export function classifyAtlasOperatorException(signal: AtlasOperatorExceptionSignal): AtlasOperatorCaseClassification | null {
  const reconciliationState = deriveAtlasOperatorReconciliationState(signal);

  if (signal.paused) {
    return {
      category: "REQUEST_PAUSED",
      severity: "HIGH",
      status: "ACTION_REQUIRED",
      title: `Paused request · ${signal.requestTitle}`,
      summary: "Operator controls currently prevent this request from progressing until it is explicitly released."
    };
  }

  if (signal.receiptStatus === "FAILED") {
    return {
      category: "RECEIPT_FAILURE",
      severity: "CRITICAL",
      status: "OPEN",
      title: `Receipt failure · ${signal.requestTitle}`,
      summary: "Receipt generation failed after payment lifecycle activity. This request needs operator investigation."
    };
  }

  if (signal.paymentStatus === "FAILED" || signal.paymentStatus === "VOIDED") {
    if (signal.paymentAttemptCount >= atlasPaymentMaximumAttemptCount) {
      return {
        category: "PAYMENT_RETRY_EXHAUSTED",
        severity: "CRITICAL",
        status: "ACTION_REQUIRED",
        title: `Payment retries exhausted · ${signal.requestTitle}`,
        summary: "The payment lifecycle reached the current attempt cap and now needs explicit operator intervention."
      };
    }

    return {
      category: "PAYMENT_FAILURE",
      severity: "HIGH",
      status: "OPEN",
      title: `Payment failure · ${signal.requestTitle}`,
      summary: "A payment attempt failed or was voided before the request reached a final usable receipt state."
    };
  }

  if (reconciliationState === "AWAITING_SETTLEMENT") {
    return {
      category: "SETTLEMENT_DELAY",
      severity: "HIGH",
      status: "OPEN",
      title: `Settlement delay · ${signal.requestTitle}`,
      summary: "Payment execution is still awaiting settlement and now needs operator visibility."
    };
  }

  if (reconciliationState === "AWAITING_SELLER_CONFIRMATION") {
    return {
      category: "SELLER_CONFIRMATION_DELAY",
      severity: "MEDIUM",
      status: "OPEN",
      title: `Seller confirmation delay · ${signal.requestTitle}`,
      summary: "Payment is ahead of seller confirmation. Delivery posture needs operator attention."
    };
  }

  if (signal.receiptStatus === "PENDING" && signal.paymentStatus === "CAPTURED") {
    return {
      category: "RECEIPT_PENDING",
      severity: "MEDIUM",
      status: "OPEN",
      title: `Receipt pending · ${signal.requestTitle}`,
      summary: "Payment captured successfully but durable receipt evidence is still pending."
    };
  }

  return null;
}

export function deriveAtlasOperatorAvailableActions(input: {
  status: OperatorCaseStatus;
  paused: boolean;
  retryEligible: boolean;
  requestStatus: string | null;
}) {
  const actions = new Set<OperatorActionType>(["ANNOTATE_CASE"]);
  const isClosed = input.status === "RESOLVED" || input.status === "CLOSED";

  if (!isClosed) {
    actions.add("RESOLVE_CASE");
  }

  if (input.paused) {
    actions.add("RELEASE_REQUEST");
  } else if (input.requestStatus !== "COMPLETED" && input.requestStatus !== "CANCELED") {
    actions.add("PAUSE_REQUEST");
  }

  if (input.retryEligible && !input.paused) {
    actions.add("REQUEUE_PAYMENT");
  }

  return [...actions];
}

export function isAtlasOperatorActionAllowed(input: {
  actionType: OperatorActionType;
  status: OperatorCaseStatus;
  paused: boolean;
  retryEligible: boolean;
  requestStatus: string | null;
}) {
  return deriveAtlasOperatorAvailableActions(input).includes(input.actionType);
}

export function matchesAtlasOperatorTextFilter(value: string | null | undefined, query: string | null | undefined) {
  if (!query || query.trim().length === 0) {
    return true;
  }

  if (!value) {
    return false;
  }

  return value.toLowerCase().includes(query.trim().toLowerCase());
}
