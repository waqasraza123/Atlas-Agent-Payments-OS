import { z } from "zod";
import {
  operatorCaseStatuses,
  paymentRails,
  paymentStatuses,
  receiptStatuses,
  spendRequestStatuses,
  type OrganizationKind,
  type OperatorCaseStatus,
  type PaymentRail,
  type PaymentStatus,
  type ReceiptStatus,
  type SpendRequestStatus
} from "@atlas/types";

type AtlasSearchParamValue = string | string[] | undefined;

const atlasAnalyticsRiskLevels = ["healthy", "attention"] as const;
export type AtlasAnalyticsRiskLevel = (typeof atlasAnalyticsRiskLevels)[number];

const amountField = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return typeof value === "string" ? Number.parseInt(value, 10) : value;
}, z.number().int().min(0).optional());

const optionalTrimmedString = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}, z.string().min(1).max(120).optional());

const optionalDateString = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional());

export const atlasAnalyticsFiltersSchema = z
  .object({
    query: optionalTrimmedString,
    requestStatus: z.enum(spendRequestStatuses).optional(),
    paymentStatus: z.enum(paymentStatuses).optional(),
    receiptStatus: z.enum(receiptStatuses).optional(),
    paymentRail: z.enum(paymentRails).optional(),
    operatorCaseStatus: z.enum(operatorCaseStatuses).optional(),
    serviceCategory: optionalTrimmedString,
    eventType: optionalTrimmedString,
    targetType: optionalTrimmedString,
    riskLevel: z.enum(atlasAnalyticsRiskLevels).optional(),
    startDate: optionalDateString,
    endDate: optionalDateString,
    minAmountMinor: amountField,
    maxAmountMinor: amountField
  })
  .superRefine((value, context) => {
    if (
      value.minAmountMinor !== undefined &&
      value.maxAmountMinor !== undefined &&
      value.minAmountMinor > value.maxAmountMinor
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minAmountMinor"],
        message: "Minimum amount cannot exceed the maximum amount."
      });
    }

    if (value.startDate && value.endDate && value.startDate > value.endDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "Start date cannot be after end date."
      });
    }
  });

export type AtlasAnalyticsFilters = z.infer<typeof atlasAnalyticsFiltersSchema>;

export type AtlasAnalyticsTimelinePoint = {
  label: string;
  count: number;
  amountMinor: number;
};

export type AtlasAnalyticsBreakdownRecord = {
  key: string;
  label: string;
  count: number;
  amountMinor: number;
  share: number;
};

export type AtlasBuyerAnalyticsRecord = {
  totalSpendMinor: number;
  requestCount: number;
  completedRequestCount: number;
  pendingApprovalCount: number;
  autoApprovedCount: number;
  manualApprovedCount: number;
  exceptionRate: number;
  budgetUtilizationRate: number;
  averageApprovalTurnaroundHours: number | null;
  spendTimeline: AtlasAnalyticsTimelinePoint[];
  topAgents: AtlasAnalyticsBreakdownRecord[];
  topSellers: AtlasAnalyticsBreakdownRecord[];
  topServices: AtlasAnalyticsBreakdownRecord[];
  statusMix: AtlasAnalyticsBreakdownRecord[];
};

export type AtlasBuyerRequestAnalyticsRecord = {
  id: string;
  title: string;
  purpose: string;
  agentName: string;
  sellerOrganizationName: string | null;
  amountMinor: number;
  currency: string;
  serviceCategory: string;
  serviceKey: string | null;
  requestStatus: SpendRequestStatus;
  approvalStatus: string | null;
  paymentStatus: PaymentStatus | null;
  receiptStatus: ReceiptStatus | null;
  paymentRail: PaymentRail | null;
  evaluationOutcome: string | null;
  reconciliationState: string;
  createdAt: string;
};

export type AtlasActivityAnalyticsRecord = {
  id: string;
  eventType: string;
  targetType: string;
  targetId: string;
  actorType: string;
  actorLabel: string;
  requestTitle: string | null;
  occurredAt: string;
};

export type AtlasSellerRevenueAnalyticsRecord = {
  totalRevenueMinor: number;
  requestCount: number;
  completedRequestCount: number;
  pendingFulfillmentCount: number;
  repeatBuyerCount: number;
  revenueTimeline: AtlasAnalyticsTimelinePoint[];
  topServices: AtlasAnalyticsBreakdownRecord[];
  topBuyers: AtlasAnalyticsBreakdownRecord[];
  statusMix: AtlasAnalyticsBreakdownRecord[];
};

export type AtlasSellerRequestAnalyticsRecord = {
  id: string;
  title: string;
  buyerOrganizationName: string;
  amountMinor: number;
  currency: string;
  serviceCategory: string;
  serviceKey: string | null;
  matchedServiceName: string | null;
  requestStatus: SpendRequestStatus;
  paymentStatus: PaymentStatus | null;
  receiptStatus: ReceiptStatus | null;
  fulfillmentStatus: "DELIVERED" | "FAILED" | null;
  reconciliationState: string;
  createdAt: string;
};

export type AtlasPlatformAnalyticsRecord = {
  activeOrganizationCount: number;
  activeAgentCount: number;
  totalRequestCount: number;
  totalApprovalCount: number;
  successfulPaymentCount: number;
  openExceptionCount: number;
  averageRequestCompletionHours: number | null;
  requestTimeline: AtlasAnalyticsTimelinePoint[];
  railMix: AtlasAnalyticsBreakdownRecord[];
  categoryMix: AtlasAnalyticsBreakdownRecord[];
};

export type AtlasPlatformTransactionRecord = {
  id: string;
  requestTitle: string;
  buyerOrganizationName: string;
  sellerOrganizationName: string | null;
  amountMinor: number;
  currency: string;
  requestStatus: SpendRequestStatus;
  paymentStatus: PaymentStatus | null;
  receiptStatus: ReceiptStatus | null;
  paymentRail: PaymentRail | null;
  providerStatus: string | null;
  reconciliationState: string;
  attemptCount: number;
  createdAt: string;
};

export type AtlasOrganizationHealthRecord = {
  organizationId: string;
  organizationName: string;
  organizationKind: OrganizationKind;
  requestCount: number;
  paymentCount: number;
  receiptAvailableCount: number;
  openCaseCount: number;
  lastActivityAt: string | null;
};

export type AtlasCsvColumn = {
  key: string;
  label: string;
};

function readSingleSearchParam(value: AtlasSearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function serializeCsvValue(value: string | number | null | undefined) {
  if (value === undefined || value === null) {
    return "";
  }

  const stringValue = String(value);
  if (!/[",\n]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replaceAll('"', '""')}"`;
}

export function parseAtlasAnalyticsFilters(rawInput: Record<string, AtlasSearchParamValue>) {
  return atlasAnalyticsFiltersSchema.parse({
    query: readSingleSearchParam(rawInput.query),
    requestStatus: readSingleSearchParam(rawInput.requestStatus),
    paymentStatus: readSingleSearchParam(rawInput.paymentStatus),
    receiptStatus: readSingleSearchParam(rawInput.receiptStatus),
    paymentRail: readSingleSearchParam(rawInput.paymentRail),
    operatorCaseStatus: readSingleSearchParam(rawInput.operatorCaseStatus),
    serviceCategory: readSingleSearchParam(rawInput.serviceCategory),
    eventType: readSingleSearchParam(rawInput.eventType),
    targetType: readSingleSearchParam(rawInput.targetType),
    riskLevel: readSingleSearchParam(rawInput.riskLevel),
    startDate: readSingleSearchParam(rawInput.startDate),
    endDate: readSingleSearchParam(rawInput.endDate),
    minAmountMinor: readSingleSearchParam(rawInput.minAmountMinor),
    maxAmountMinor: readSingleSearchParam(rawInput.maxAmountMinor)
  });
}

export function matchesAtlasAnalyticsTextFilter(values: Array<string | null | undefined>, query: string | undefined) {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery.length === 0) {
    return true;
  }

  return values.some((value) => value?.toLowerCase().includes(normalizedQuery));
}

export function formatAtlasPercentLabel(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function formatAtlasTimelineLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

export function createAtlasCsv(columns: AtlasCsvColumn[], rows: Array<Record<string, string | number | null | undefined>>) {
  const headerRow = columns.map((column) => serializeCsvValue(column.label)).join(",");
  const dataRows = rows.map((row) =>
    columns.map((column) => serializeCsvValue(row[column.key])).join(",")
  );

  return [headerRow, ...dataRows].join("\n");
}
