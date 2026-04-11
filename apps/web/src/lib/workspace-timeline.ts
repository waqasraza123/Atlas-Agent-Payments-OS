import { formatAtlasPolicyEvaluationOutcomeLabel, type AtlasPolicyEvaluationResult } from "@atlas/domain";
import type { TimelinePanelItem } from "@atlas/ui";

export type LifecycleRequestRecord = {
  id: string;
  title: string;
  status: string;
  amountMinor: number;
  currency: string;
  serviceCategory: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type LifecycleEvaluationRecord = {
  outcome: AtlasPolicyEvaluationResult["outcome"];
  matchedPolicyLabel: string | null;
  matchedPolicyVersion: number | null;
  reasons: string[];
  requiresApproval: boolean;
  autoApproved: boolean;
  occurredAt: Date | string;
};

export type LifecycleApprovalRecord = {
  id: string;
  status: string;
  decisionReason: string | null;
  approverLabel: string | null;
  updatedAt: Date | string;
};

export type LifecyclePaymentRecord = {
  id: string;
  status: string;
  provider: string;
  reference: string | null;
  amountMinor: number;
  currency: string;
  updatedAt: Date | string;
};

export type LifecycleReceiptRecord = {
  id: string;
  status: string;
  storageKey: string | null;
  contentType: string | null;
  updatedAt: Date | string;
};

export type LifecycleAuditRecord = {
  id: string;
  eventType: string;
  actorType: string;
  targetType: string;
  targetId: string;
  occurredAt: Date | string;
};

export type LifecycleSource = {
  request: LifecycleRequestRecord;
  evaluation?: LifecycleEvaluationRecord | null;
  approval?: LifecycleApprovalRecord | null;
  payment?: LifecyclePaymentRecord | null;
  receipt?: LifecycleReceiptRecord | null;
  auditEvents: LifecycleAuditRecord[];
};

function formatCurrencyMinor(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(amountMinor / 100);
}

function formatTimestamp(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatTokenLabel(value: string) {
  return value
    .split(/[\W_]+/g)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

function resolveTone(value: string): TimelinePanelItem["tone"] {
  const normalized = value.toUpperCase();

  if (["COMPLETED", "APPROVED", "CAPTURED", "AVAILABLE"].includes(normalized)) {
    return "success";
  }

  if (["FAILED", "REJECTED", "VOIDED", "CANCELED", "EXPIRED"].includes(normalized)) {
    return "critical";
  }

  if (["SUBMITTED", "PENDING", "AUTHORIZED", "EXECUTING"].includes(normalized)) {
    return "warning";
  }

  return "default";
}

function resolveEvaluationTone(value: LifecycleEvaluationRecord["outcome"]): TimelinePanelItem["tone"] {
  if (value.startsWith("allow_")) {
    return value === "allow_auto_approved" ? "success" : "warning";
  }

  return "critical";
}

function summarizeEvaluationReasons(source: LifecycleEvaluationRecord) {
  return source.reasons[0] ?? formatAtlasPolicyEvaluationOutcomeLabel(source.outcome);
}

export function buildAtlasLifecycleTimeline(source: LifecycleSource): TimelinePanelItem[] {
  const entries: Array<TimelinePanelItem & { timestamp: number }> = [
    {
      id: `${source.request.id}:created`,
      label: "Request",
      title: source.request.title,
      description: `${formatCurrencyMinor(source.request.amountMinor, source.request.currency)} · ${source.request.serviceCategory}`,
      detail: formatTimestamp(source.request.createdAt),
      statusLabel: formatTokenLabel(source.request.status),
      tone: resolveTone(source.request.status),
      timestamp: new Date(source.request.createdAt).getTime()
    }
  ];

  if (source.evaluation) {
    entries.push({
      id: `${source.request.id}:evaluation`,
      label: "Policy",
      title: source.evaluation.matchedPolicyLabel ?? "Policy evaluation",
      description: summarizeEvaluationReasons(source.evaluation),
      detail: formatTimestamp(source.evaluation.occurredAt),
      statusLabel: formatAtlasPolicyEvaluationOutcomeLabel(source.evaluation.outcome),
      tone: resolveEvaluationTone(source.evaluation.outcome),
      timestamp: new Date(source.evaluation.occurredAt).getTime()
    });
  }

  if (source.approval) {
    entries.push({
      id: `${source.approval.id}:approval`,
      label: "Approval",
      title: source.approval.approverLabel ?? "Approval path",
      description: source.approval.decisionReason ?? "Decision reason not captured yet",
      detail: formatTimestamp(source.approval.updatedAt),
      statusLabel: formatTokenLabel(source.approval.status),
      tone: resolveTone(source.approval.status),
      timestamp: new Date(source.approval.updatedAt).getTime()
    });
  }

  if (source.payment) {
    entries.push({
      id: `${source.payment.id}:payment`,
      label: "Payment",
      title: `${formatTokenLabel(source.payment.provider)} rail`,
      description: source.payment.reference ?? "No payment reference captured yet",
      detail: formatTimestamp(source.payment.updatedAt),
      statusLabel: formatTokenLabel(source.payment.status),
      tone: resolveTone(source.payment.status),
      timestamp: new Date(source.payment.updatedAt).getTime()
    });
  }

  if (source.receipt) {
    entries.push({
      id: `${source.receipt.id}:receipt`,
      label: "Receipt",
      title: source.receipt.storageKey ?? "Receipt artifact",
      description: source.receipt.contentType ?? "Receipt content type not captured yet",
      detail: formatTimestamp(source.receipt.updatedAt),
      statusLabel: formatTokenLabel(source.receipt.status),
      tone: resolveTone(source.receipt.status),
      timestamp: new Date(source.receipt.updatedAt).getTime()
    });
  }

  for (const event of source.auditEvents) {
    entries.push({
      id: event.id,
      label: "Audit",
      title: formatTokenLabel(event.eventType),
      description: `${event.targetType} · ${event.targetId}`,
      detail: formatTimestamp(event.occurredAt),
      statusLabel: formatTokenLabel(event.actorType),
      tone: "default",
      timestamp: new Date(event.occurredAt).getTime()
    });
  }

  return entries
    .sort((left, right) => left.timestamp - right.timestamp)
    .map(({ timestamp: _timestamp, ...entry }) => entry);
}
