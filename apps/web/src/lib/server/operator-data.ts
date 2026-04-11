import type { AtlasActorContext } from "@atlas/auth";
import {
  getOperatorCase,
  getOperatorOverview,
  listOperatorAuditEvents,
  listOperatorCases,
  listOperatorNotifications,
  type AtlasOperatorCaseDetailRecord
} from "@atlas/database";
import {
  formatAtlasNotificationStatusLabel,
  formatAtlasOperatorActionTypeLabel,
  formatAtlasOperatorCaseCategoryLabel,
  formatAtlasOperatorCaseSeverityLabel,
  formatAtlasOperatorCaseStatusLabel,
  formatAtlasPaymentReconciliationStateLabel
} from "@atlas/domain";
import type { DetailGridItem, RecordListPanelItem, TimelinePanelItem } from "@atlas/ui";
import { getAtlasWorkspaceDetailHref } from "@/lib/detail-hrefs";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export async function loadOperatorOverviewData(actor: AtlasActorContext) {
  return getOperatorOverview(actor);
}

export async function loadOperatorCaseListData(
  actor: AtlasActorContext,
  filters: Record<string, string | string[] | undefined>
) {
  return listOperatorCases(actor, filters);
}

export async function loadOperatorNotificationsData(actor: AtlasActorContext) {
  return listOperatorNotifications(actor);
}

export async function loadOperatorAuditData(
  actor: AtlasActorContext,
  filters: Record<string, string | string[] | undefined>
) {
  return listOperatorAuditEvents(actor, filters);
}

export async function loadOperatorCaseDetailData(actor: AtlasActorContext, caseId: string) {
  return getOperatorCase(actor, caseId);
}

export function createOperatorCaseListItems(
  items: Awaited<ReturnType<typeof loadOperatorCaseListData>>
): RecordListPanelItem[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    description: `${item.buyerOrganizationName ?? "No buyer"} → ${item.sellerOrganizationName ?? "No seller"}`,
    detail: `${formatAtlasOperatorCaseCategoryLabel(item.category)} · ${item.requestTitle ?? "No request title"}`,
    href: getAtlasWorkspaceDetailHref("OPERATOR", "exceptions", item.id) ?? undefined,
    statusLabel: formatAtlasOperatorCaseSeverityLabel(item.severity),
    statusTone:
      item.severity === "CRITICAL" ? "critical" : item.severity === "HIGH" ? "warning" : item.severity === "MEDIUM" ? "warning" : "default"
  }));
}

export function createOperatorNotificationItems(
  items: Awaited<ReturnType<typeof loadOperatorNotificationsData>>
): RecordListPanelItem[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    detail: formatDateTime(item.updatedAt),
    href: item.caseId ? getAtlasWorkspaceDetailHref("OPERATOR", "exceptions", item.caseId) ?? undefined : undefined,
    statusLabel: formatAtlasNotificationStatusLabel(item.status),
    statusTone: item.status === "UNREAD" ? "warning" : "default"
  }));
}

export function createOperatorAuditItems(
  items: Awaited<ReturnType<typeof loadOperatorAuditData>>
): RecordListPanelItem[] {
  return items.map((item) => ({
    id: item.id,
    title: item.eventType,
    description: `${item.targetType} · ${item.actorLabel}`,
    detail: `${item.organizationName ?? "No organization"} · ${formatDateTime(item.occurredAt)}`,
    href: getAtlasWorkspaceDetailHref("OPERATOR", "audit", item.id) ?? undefined,
    statusLabel: item.targetType
  }));
}

export function createOperatorCaseFacts(detail: AtlasOperatorCaseDetailRecord): DetailGridItem[] {
  const item = detail.item;

  return [
    {
      label: "Status",
      value: formatAtlasOperatorCaseStatusLabel(item.status)
    },
    {
      label: "Category",
      value: formatAtlasOperatorCaseCategoryLabel(item.category)
    },
    {
      label: "Severity",
      value: formatAtlasOperatorCaseSeverityLabel(item.severity)
    },
    {
      label: "Buyer organization",
      value: item.buyerOrganizationName ?? "Not available"
    },
    {
      label: "Seller organization",
      value: item.sellerOrganizationName ?? "Not available"
    },
    {
      label: "Request status",
      value: item.requestStatus ?? "Not available"
    },
    {
      label: "Payment status",
      value: item.paymentStatus ?? "Not available"
    },
    {
      label: "Receipt status",
      value: item.receiptStatus ?? "Not available"
    },
    {
      label: "Reconciliation posture",
      value: item.reconciliationState ? formatAtlasPaymentReconciliationStateLabel(item.reconciliationState) : "Not available"
    },
    {
      label: "Available actions",
      value: item.availableActions.map(formatAtlasOperatorActionTypeLabel).join(", ")
    }
  ];
}

export function createOperatorCaseTimeline(detail: AtlasOperatorCaseDetailRecord): TimelinePanelItem[] {
  return [
    ...detail.actions.map((action) => ({
      occurredAt: action.createdAt,
      item: {
        id: action.id,
        label: "Operator action",
        title: formatAtlasOperatorActionTypeLabel(action.actionType),
        description: action.reason,
        detail: `${action.actorUserName ?? action.actorUserEmail} · ${formatDateTime(action.createdAt)}`,
        statusLabel: "Action",
        tone:
          action.actionType === "RESOLVE_CASE" ? "success" : action.actionType === "ANNOTATE_CASE" ? "default" : "warning"
      } satisfies TimelinePanelItem
    })),
    ...detail.auditEvents.map((event) => ({
      occurredAt: event.occurredAt,
      item: {
        id: event.id,
        label: "Audit event",
        title: event.eventType,
        description: `${event.targetType} · ${event.targetId}`,
        detail: `${event.actorLabel} · ${formatDateTime(event.occurredAt)}`,
        statusLabel: event.actorType,
        tone: event.actorType === "SYSTEM" ? "default" : "warning"
      } satisfies TimelinePanelItem
    }))
  ]
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
    .map((entry) => entry.item);
}

export function createOperatorCaseRelatedItems(detail: AtlasOperatorCaseDetailRecord): RecordListPanelItem[] {
  const items: RecordListPanelItem[] = [];

  if (detail.item.requestId) {
    items.push({
      id: `request:${detail.item.requestId}`,
      title: detail.item.requestTitle ?? "Request detail",
      description: "Open the related transaction detail",
      detail: detail.item.requestStatus ?? "Unknown request status",
      href: getAtlasWorkspaceDetailHref("OPERATOR", "transactions", detail.item.requestId) ?? undefined,
      statusLabel: "Request"
    });
  }

  if (detail.item.receiptId) {
    items.push({
      id: `receipt:${detail.item.receiptId}`,
      title: "Linked receipt",
      description: "Open the related receipt evidence view",
      detail: detail.item.receiptStatus ?? "Unknown receipt status",
      href: getAtlasWorkspaceDetailHref("OPERATOR", "receipts", detail.item.receiptId) ?? undefined,
      statusLabel: "Receipt"
    });
  }

  return items;
}
