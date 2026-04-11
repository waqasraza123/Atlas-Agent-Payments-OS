import type { AtlasActorContext } from "@atlas/auth";
import { prisma } from "@atlas/database";
import {
  formatAtlasPaymentRailLabel,
  formatAtlasPaymentReconciliationStateLabel,
  formatAtlasPaymentStatusLabel,
  formatAtlasPolicyEvaluationOutcomeLabel,
  formatAtlasReceiptStatusLabel,
  formatAtlasSellerFulfillmentStatusLabel,
  formatAtlasServicePricingModelLabel,
  formatAtlasServiceStatusLabel,
  formatAtlasServiceVisibilityLabel,
  parseAtlasPolicyEvaluationResult,
  summarizeAtlasPolicyEvaluation,
  type AtlasWorkspaceSurfaceKey
} from "@atlas/domain";
import type { OrganizationKind } from "@atlas/types";
import type { DetailGridItem, RecordListPanelItem, TimelinePanelItem } from "@atlas/ui";
import type { WorkspaceMetric } from "./workspace-data";
import { getAtlasWorkspaceDetailHref } from "@/lib/detail-hrefs";
import { createAtlasFocusedDemoScenarioCards, type AtlasDemoScenarioCard } from "@/lib/demo-scenarios";
import { buildAtlasLifecycleTimeline } from "@/lib/workspace-timeline";

export type WorkspaceDetailModel = {
  eyebrow: string;
  title: string;
  description: string;
  statusLabel: string;
  statusTone: "default" | "success" | "warning" | "critical";
  metrics: WorkspaceMetric[];
  facts: DetailGridItem[];
  preview: {
    eyebrow: string;
    title: string;
    description: string;
    items: DetailGridItem[];
    emptyTitle: string;
    emptyDescription: string;
  };
  analysis?: {
    eyebrow: string;
    title: string;
    description: string;
    items: DetailGridItem[];
    emptyTitle: string;
    emptyDescription: string;
  } | null;
  timeline: {
    eyebrow: string;
    title: string;
    description: string;
    items: TimelinePanelItem[];
    emptyTitle: string;
    emptyDescription: string;
  };
  related: {
    eyebrow: string;
    title: string;
    description: string;
    items: RecordListPanelItem[];
    emptyTitle: string;
    emptyDescription: string;
  };
  demoJourney: {
    eyebrow: string;
    title: string;
    description: string;
    items: AtlasDemoScenarioCard[];
  };
};

function formatCurrencyMinor(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(amountMinor / 100);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

function formatTokenLabel(value: string) {
  return value
    .split(/[\W_]+/g)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

function resolveStatusTone(value: string): WorkspaceDetailModel["statusTone"] {
  const normalized = value.toUpperCase();

  if (["COMPLETED", "APPROVED", "CAPTURED", "AVAILABLE", "ACTIVE", "PUBLISHED"].includes(normalized)) {
    return "success";
  }

  if (["FAILED", "REJECTED", "VOIDED", "CANCELED", "EXPIRED", "DISABLED", "ARCHIVED"].includes(normalized)) {
    return "critical";
  }

  if (["SUBMITTED", "PENDING", "AUTHORIZED", "EXECUTING", "PAUSED"].includes(normalized)) {
    return "warning";
  }

  return "default";
}

function formatJsonMetadataValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "Structured metadata available";
}

function formatBooleanLabel(value: boolean) {
  return value ? "Yes" : "No";
}

function formatReasonList(reasons: string[]) {
  return reasons.length > 0 ? reasons.join(" ") : "No policy reasoning recorded";
}

function formatOptionalValue(value: string | null | undefined, fallback: string) {
  return value && value.trim().length > 0 ? value : fallback;
}

function extractSellerFulfillment(metadata: Record<string, unknown> | null) {
  const value =
    metadata?.sellerFulfillment && typeof metadata.sellerFulfillment === "object" && !Array.isArray(metadata.sellerFulfillment)
      ? (metadata.sellerFulfillment as Record<string, unknown>)
      : null;

  if (!value) {
    return null;
  }

  const fulfillmentStatus = value.fulfillmentStatus;
  const note = value.note;
  const recordedAt = value.recordedAt;

  if (
    (fulfillmentStatus === "DELIVERED" || fulfillmentStatus === "FAILED") &&
    typeof note === "string" &&
    note.trim().length > 0 &&
    typeof recordedAt === "string" &&
    recordedAt.trim().length > 0
  ) {
    return {
      fulfillmentStatus,
      note,
      recordedAt
    } as const;
  }

  return null;
}

function createRelatedItem(
  id: string,
  title: string,
  description: string,
  detail: string,
  statusLabel?: string,
  statusTone?: RecordListPanelItem["statusTone"],
  href?: string | null
): RecordListPanelItem {
  return {
    id,
    title,
    description,
    detail,
    statusLabel,
    statusTone,
    href: href ?? undefined
  };
}

function canAccessRequest(actor: AtlasActorContext, request: { organizationId: string; sellerOrganizationId: string | null }) {
  if (actor.workspace === "BUYER") {
    return request.organizationId === actor.organization.id;
  }

  if (actor.workspace === "SELLER") {
    return request.sellerOrganizationId === actor.organization.id;
  }

  return true;
}

function canAccessAuditEvent(actor: AtlasActorContext, event: { organizationId: string | null; request: { organizationId: string; sellerOrganizationId: string | null } | null }) {
  if (actor.workspace === "BUYER") {
    return event.organizationId === actor.organization.id || event.request?.organizationId === actor.organization.id;
  }

  if (actor.workspace === "SELLER") {
    return event.request?.sellerOrganizationId === actor.organization.id;
  }

  return true;
}

async function loadRequestDetailModel(
  actor: AtlasActorContext,
  surfaceKey: Extract<AtlasWorkspaceSurfaceKey, "requests" | "transactions">,
  recordId: string
): Promise<WorkspaceDetailModel | null> {
  const request = await prisma.spendRequest.findUnique({
    where: {
      id: recordId
    },
    include: {
      organization: true,
      sellerOrganization: true,
      agent: true,
      policy: true,
      approval: {
        include: {
          approver: true
        }
      },
      payment: true,
      receipt: true,
      auditEvents: {
        orderBy: {
          occurredAt: "asc"
        }
      }
    }
  });

  if (!request || !canAccessRequest(actor, request)) {
    return null;
  }

  const payload = typeof request.requestPayload === "object" && request.requestPayload !== null ? request.requestPayload : null;
  const metadata =
    request.metadata && typeof request.metadata === "object" && !Array.isArray(request.metadata)
      ? (request.metadata as Record<string, unknown>)
      : null;
  const evaluationResult = parseAtlasPolicyEvaluationResult(request.evaluationResult);
  const sellerFulfillment = extractSellerFulfillment(metadata);
  const policyEvaluatedEvent = request.auditEvents.find((event) => event.eventType === "policy_evaluated");
  const matchedSellerService =
    request.sellerOrganizationId && request.serviceKey
      ? await prisma.service.findFirst({
          where: {
            organizationId: request.sellerOrganizationId,
            key: request.serviceKey
          }
        })
      : null;
  const scenarioLabel =
    metadata && "scenarioLabel" in metadata && typeof metadata.scenarioLabel === "string"
      ? metadata.scenarioLabel
      : "Seeded lifecycle scenario";

  const timeline = buildAtlasLifecycleTimeline({
    request: {
      id: request.id,
      title: request.title,
      status: request.status,
      amountMinor: request.amountMinor,
      currency: request.currency,
      serviceCategory: request.serviceCategory,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt
    },
    evaluation: evaluationResult
      ? {
          outcome: evaluationResult.outcome,
          matchedPolicyLabel: request.policy?.name ?? null,
          matchedPolicyVersion: evaluationResult.matchedPolicyVersion,
          reasons: evaluationResult.reasons,
          requiresApproval: evaluationResult.requiresApproval,
          autoApproved: evaluationResult.autoApproved,
          occurredAt: policyEvaluatedEvent?.occurredAt ?? request.createdAt
        }
      : null,
    approval: request.approval
      ? {
          id: request.approval.id,
          status: request.approval.status,
          decisionReason: request.approval.decisionReason,
          approverLabel: request.approval.approver?.name ?? request.approval.approver?.email ?? null,
          updatedAt: request.approval.updatedAt
        }
      : null,
    fulfillment: sellerFulfillment
      ? {
          fulfillmentStatus: sellerFulfillment.fulfillmentStatus,
          note: sellerFulfillment.note,
          recordedAt: sellerFulfillment.recordedAt
        }
      : null,
    payment: request.payment
      ? {
          id: request.payment.id,
          status: request.payment.status,
          provider: request.payment.provider,
          reference: request.payment.reference,
          amountMinor: request.payment.amountMinor,
          currency: request.payment.currency,
          updatedAt: request.payment.updatedAt
        }
      : null,
    receipt: request.receipt
      ? {
          id: request.receipt.id,
          status: request.receipt.status,
          storageKey: request.receipt.storageKey,
          contentType: request.receipt.contentType,
          updatedAt: request.receipt.updatedAt
        }
      : null,
    auditEvents: request.auditEvents.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      actorType: event.actorType,
      targetType: event.targetType,
      targetId: event.targetId,
      occurredAt: event.occurredAt
    }))
  });

  const buyerRequestHref =
    actor.workspace === "BUYER" ? getAtlasWorkspaceDetailHref("BUYER", "requests", request.id) : null;
  const sellerRequestHref =
    actor.workspace === "SELLER" ? getAtlasWorkspaceDetailHref("SELLER", "requests", request.id) : null;
  const operatorRequestHref =
    actor.workspace === "OPERATOR" ? getAtlasWorkspaceDetailHref("OPERATOR", "transactions", request.id) : null;

  return {
    eyebrow: surfaceKey === "transactions" ? "Transaction detail" : "Request detail",
    title: request.title,
    description: `${request.organization.name} → ${request.sellerOrganization?.name ?? "No seller linked"} · ${scenarioLabel}`,
    statusLabel: formatTokenLabel(request.status),
    statusTone: resolveStatusTone(request.status),
    metrics: [
      {
        label: "Amount",
        value: formatCurrencyMinor(request.amountMinor, request.currency),
        detail: "Persisted request amount currently attached to this lifecycle."
      },
      {
        label: "Service category",
        value: request.serviceCategory,
        detail: "Current purchasable service class for the request."
      },
      {
        label: "Policy outcome",
        value: evaluationResult ? formatAtlasPolicyEvaluationOutcomeLabel(evaluationResult.outcome) : "Not evaluated",
        detail: evaluationResult
          ? summarizeAtlasPolicyEvaluation(evaluationResult)
          : "Policy evaluation posture has not been captured yet."
      },
      {
        label: "Approval posture",
        value: request.approval ? formatTokenLabel(request.approval.status) : "Not created",
        detail: request.approval?.decisionReason ?? "Approval remains a distinct lifecycle from the request and payment records."
      },
      {
        label: "Seller fulfillment",
        value: sellerFulfillment ? formatAtlasSellerFulfillmentStatusLabel(sellerFulfillment.fulfillmentStatus) : "Not recorded",
        detail: sellerFulfillment?.note ?? "Seller-side delivery posture has not been recorded yet."
      }
    ],
    facts: [
      {
        label: "Buyer organization",
        value: request.organization.name,
        detail: request.organization.slug
      },
      {
        label: "Seller organization",
        value: request.sellerOrganization?.name ?? "Not assigned",
        detail: request.sellerOrganization?.slug ?? "Seller relationship not attached yet"
      },
      {
        label: "Agent",
        value: request.agent.name,
        detail: request.agent.externalRef ?? "No external reference recorded"
      },
      {
        label: "Purpose",
        value: request.purpose,
        detail: "Buyer-provided business context captured at request creation."
      },
      {
        label: "Policy",
        value: request.policy?.name ?? "No policy linked",
        detail: request.policy
          ? `Version ${evaluationResult?.matchedPolicyVersion ?? request.policy.version} · ${formatTokenLabel(request.policy.status)}`
          : "Policy linkage arrives in later phases"
      },
      {
        label: "Service key",
        value: formatOptionalValue(request.serviceKey, "Not attached"),
        detail: matchedSellerService?.name ?? "No seller service is currently matched to this request."
      },
      {
        label: "Created",
        value: formatDateTime(request.createdAt),
        detail: `Updated ${formatDateTime(request.updatedAt)}`
      },
      {
        label: "Idempotency key",
        value: formatOptionalValue(request.idempotencyKey, "Not provided"),
        detail: "Repeat-safe request creation remains explicit in the persisted request record."
      },
      {
        label: "Scenario",
        value: scenarioLabel,
        detail: metadata && "scenarioKey" in metadata ? formatJsonMetadataValue(metadata.scenarioKey) : "Phase 1 demo seed"
      }
    ],
    analysis: {
      eyebrow: "Policy and approval posture",
      title: "Evaluation and human decision context",
      description:
        "The buyer control loop is only trustworthy when the matched policy outcome, approval requirement, and recorded reasoning stay explicit on the request detail itself.",
      items: [
        {
          label: "Evaluation outcome",
          value: evaluationResult ? formatAtlasPolicyEvaluationOutcomeLabel(evaluationResult.outcome) : "Not captured",
          detail: evaluationResult ? formatReasonList(evaluationResult.reasons) : "No evaluation result was stored on this request."
        },
        {
          label: "Requires approval",
          value: evaluationResult ? formatBooleanLabel(evaluationResult.requiresApproval) : "Unknown",
          detail: evaluationResult
            ? evaluationResult.autoApproved
              ? "The matched policy auto-approved the request."
              : "The matched policy required a human approval step."
            : "Approval posture is unavailable because the policy evaluation record is missing."
        },
        {
          label: "Auto-approved",
          value: evaluationResult ? formatBooleanLabel(evaluationResult.autoApproved) : "Unknown",
          detail: request.approval?.decisionReason ?? "No approval decision has been recorded yet."
        },
        {
          label: "Approval decision",
          value: request.approval ? formatTokenLabel(request.approval.status) : "Not created",
          detail: request.approval
            ? `${formatOptionalValue(request.approval.approver?.name ?? request.approval.approver?.email, "Unknown approver")} · ${formatOptionalValue(
                request.approval.decisionReason,
                "Decision reason not captured yet"
              )}`
            : "The request has not generated a distinct approval record yet."
        },
        {
          label: actor.workspace === "SELLER" ? "Seller delivery note" : "Seller fulfillment",
          value: sellerFulfillment ? formatAtlasSellerFulfillmentStatusLabel(sellerFulfillment.fulfillmentStatus) : "Not recorded",
          detail: sellerFulfillment?.note ?? "Seller delivery evidence will appear here once the seller records an outcome."
        }
      ],
      emptyTitle: "No evaluation context available",
      emptyDescription: "Atlas will render policy and approval reasoning here once the request captures it."
    },
    preview: {
      eyebrow: "Execution evidence",
      title: "Receipt and fulfillment preview",
      description:
        "This detail view ties together request, approval, payment, receipt, and audit evidence in one place without collapsing those lifecycles into a single record.",
      items: [
        {
          label: "Service",
          value: matchedSellerService?.name ?? (payload && "service" in payload && typeof payload.service === "string" ? payload.service : request.title),
          detail: formatOptionalValue(
            request.serviceKey ?? (payload && "serviceKey" in payload && typeof payload.serviceKey === "string" ? payload.serviceKey : null),
            "Requested service or endpoint name from the request payload."
          )
        },
        {
          label: "Receipt status",
          value: request.receipt ? formatTokenLabel(request.receipt.status) : "Not generated",
          detail: request.receipt?.storageKey ?? "Receipt preview appears once a receipt record exists"
        },
        {
          label: "Payment reference",
          value: request.payment?.reference ?? "Not issued",
          detail: request.payment?.provider ?? "No payment rail attached yet"
        },
        {
          label: "Decision reason",
          value: request.approval?.decisionReason ?? (evaluationResult ? summarizeAtlasPolicyEvaluation(evaluationResult) : "Awaiting decision context"),
          detail: request.approval?.approver?.email ?? request.approval?.approver?.name ?? "No approver captured yet"
        },
        {
          label: "Fulfillment note",
          value: sellerFulfillment?.note ?? "Not recorded",
          detail: sellerFulfillment
            ? `${formatAtlasSellerFulfillmentStatusLabel(sellerFulfillment.fulfillmentStatus)} · ${formatDateTime(new Date(sellerFulfillment.recordedAt))}`
            : "Seller fulfillment arrives after approval and before richer receipt handling."
        }
      ],
      emptyTitle: "No execution evidence available",
      emptyDescription: "Atlas will show payment, receipt, and fulfillment evidence here when those records exist."
    },
    timeline: {
      eyebrow: "Lifecycle timeline",
      title: "Request to evidence narrative",
      description: "The timeline keeps every important lifecycle step legible for demos, support, and later audit workflows.",
      items: timeline,
      emptyTitle: "No lifecycle timeline available",
      emptyDescription: "Atlas will render request events here once the lifecycle begins."
    },
    related: {
      eyebrow: "Cross-linked records",
      title: "Related lifecycle records",
      description: "Atlas keeps approvals, payments, receipts, and audit history directly reachable from the current record.",
      items: [
        createRelatedItem(
          request.id,
          "Request record",
          request.organization.name,
          formatTokenLabel(request.status),
          "request",
          resolveStatusTone(request.status),
          buyerRequestHref ?? sellerRequestHref ?? operatorRequestHref
        ),
        request.approval
          ? createRelatedItem(
              request.approval.id,
              "Approval record",
              request.approval.approver?.name ?? request.approval.approver?.email ?? "Approval chain",
              request.approval.decisionReason ?? "Decision reason not captured yet",
              formatTokenLabel(request.approval.status),
              resolveStatusTone(request.approval.status),
              actor.workspace === "BUYER"
                ? getAtlasWorkspaceDetailHref("BUYER", "approvals", request.approval.id)
                : null
            )
          : null,
        matchedSellerService
          ? createRelatedItem(
              matchedSellerService.id,
              "Matched seller service",
              matchedSellerService.name,
              matchedSellerService.key,
              formatAtlasServiceStatusLabel(matchedSellerService.status),
              resolveStatusTone(matchedSellerService.status),
              actor.workspace === "SELLER"
                ? getAtlasWorkspaceDetailHref("SELLER", "services", matchedSellerService.id)
                : null
            )
          : null,
        request.payment
          ? createRelatedItem(
              request.payment.id,
              "Payment record",
              request.payment.provider,
              request.payment.reference ?? "No reference captured yet",
              formatTokenLabel(request.payment.status),
              resolveStatusTone(request.payment.status),
              actor.workspace === "SELLER"
                ? getAtlasWorkspaceDetailHref("SELLER", "payments", request.payment.id)
                : null
            )
          : null,
        request.receipt
          ? createRelatedItem(
              request.receipt.id,
              "Receipt artifact",
              request.receipt.contentType ?? "Receipt content type not captured",
              request.receipt.storageKey ?? "Storage key not captured",
              formatTokenLabel(request.receipt.status),
              resolveStatusTone(request.receipt.status)
            )
          : null
      ].filter(Boolean) as RecordListPanelItem[],
      emptyTitle: "No related records available",
      emptyDescription: "Linked approval, payment, receipt, and audit records will appear here as the lifecycle deepens."
    },
    demoJourney: {
      eyebrow: "Replayable demo flow",
      title: "Related seeded scenarios",
      description:
        "Atlas now keeps the seeded walkthrough coherent by linking this detail view to the surrounding lifecycle scenarios in the buyer journey.",
      items: createAtlasFocusedDemoScenarioCards(request.id)
    }
  };
}

async function loadServiceDetailModel(actor: AtlasActorContext, recordId: string): Promise<WorkspaceDetailModel | null> {
  if (actor.workspace !== "SELLER") {
    return null;
  }

  const service = await prisma.service.findFirst({
    where: {
      id: recordId,
      organizationId: actor.organization.id
    }
  });

  if (!service) {
    return null;
  }

  const [requests, auditEvents] = await Promise.all([
    prisma.spendRequest.findMany({
      where: {
        sellerOrganizationId: actor.organization.id,
        serviceKey: service.key
      },
      include: {
        organization: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 8
    }),
    prisma.auditEvent.findMany({
      where: {
        organizationId: actor.organization.id,
        targetType: "Service",
        targetId: service.id
      },
      orderBy: {
        occurredAt: "asc"
      }
    })
  ]);

  const distinctBuyerCount = new Set(requests.map((request) => request.organizationId)).size;

  return {
    eyebrow: "Service detail",
    title: service.name,
    description: `${actor.organization.name} service catalog · ${service.key}`,
    statusLabel: formatAtlasServiceStatusLabel(service.status),
    statusTone: resolveStatusTone(service.status),
    metrics: [
      {
        label: "Price",
        value: formatCurrencyMinor(service.priceMinor, service.currency),
        detail: `${formatAtlasServicePricingModelLabel(service.pricingModel)} pricing baseline`
      },
      {
        label: "Visibility",
        value: formatAtlasServiceVisibilityLabel(service.visibility),
        detail: "Current seller publication boundary for buyer access."
      },
      {
        label: "Inbound requests",
        value: String(requests.length),
        detail: "Buyer requests currently aligned to this seller service key."
      },
      {
        label: "Buyer organizations",
        value: String(distinctBuyerCount),
        detail: "Distinct buyer organizations already visible on this service."
      }
    ],
    facts: [
      {
        label: "Service key",
        value: service.key,
        detail: "Stable service identifier used across seller routing and buyer request targeting."
      },
      {
        label: "Category",
        value: service.category,
        detail: "Seller-defined service class used for cataloging and matching."
      },
      {
        label: "Pricing model",
        value: formatAtlasServicePricingModelLabel(service.pricingModel),
        detail: `${formatCurrencyMinor(service.priceMinor, service.currency)} fixed price baseline`
      },
      {
        label: "Visibility",
        value: formatAtlasServiceVisibilityLabel(service.visibility),
        detail: formatAtlasServiceStatusLabel(service.status)
      },
      {
        label: "Created",
        value: formatDateTime(service.createdAt),
        detail: `Updated ${formatDateTime(service.updatedAt)}`
      },
      {
        label: "Seller organization",
        value: actor.organization.name,
        detail: actor.organization.slug
      }
    ],
    analysis: {
      eyebrow: "Service publication posture",
      title: "Catalog and demand posture",
      description:
        "Seller services need explicit publication, pricing, and buyer-demand context so the seller workflow can become operational before payout and webhook depth arrive.",
      items: [
        {
          label: "Status",
          value: formatAtlasServiceStatusLabel(service.status),
          detail: "Publication state drives whether buyers should treat the service as live, draft, or archived."
        },
        {
          label: "Description",
          value: service.description,
          detail: "Seller-defined service narrative used for catalog understanding and later API productization."
        },
        {
          label: "Recent demand",
          value: requests[0]?.title ?? "No inbound requests yet",
          detail: requests[0]?.organization.name ?? "The service has not been targeted by buyer traffic yet."
        },
        {
          label: "Request coverage",
          value: `${requests.length} linked requests`,
          detail: `${distinctBuyerCount} distinct buyer organizations currently reference this service key.`
        }
      ],
      emptyTitle: "No service posture available",
      emptyDescription: "Atlas will render seller catalog posture here once the service exists."
    },
    preview: {
      eyebrow: "Request preview",
      title: "Buyer demand linked to this service",
      description:
        "This preview keeps the service record connected to the buyer-side demand already flowing through the current seller organization.",
      items: [
        {
          label: "Latest request",
          value: requests[0]?.title ?? "No linked request yet",
          detail: requests[0]?.organization.name ?? "No buyer organization has targeted this service yet."
        },
        {
          label: "Latest amount",
          value: requests[0] ? formatCurrencyMinor(requests[0].amountMinor, requests[0].currency) : "No demand yet",
          detail: requests[0]?.serviceCategory ?? "No service category linked yet"
        },
        {
          label: "Current status",
          value: requests[0] ? formatTokenLabel(requests[0].status) : "No request lifecycle yet",
          detail: requests[0]?.purpose ?? "Buyer request purpose will appear here when available."
        },
        {
          label: "Pricing posture",
          value: formatCurrencyMinor(service.priceMinor, service.currency),
          detail: `${formatAtlasServiceVisibilityLabel(service.visibility)} · ${formatAtlasServiceStatusLabel(service.status)}`
        }
      ],
      emptyTitle: "No service preview available",
      emptyDescription: "Atlas will render linked buyer-demand context here once requests exist."
    },
    timeline: {
      eyebrow: "Service timeline",
      title: "Service and request activity",
      description: "Seller services stay legible by keeping catalog updates and inbound buyer demand visible in one timeline.",
      items: [
        {
          id: `${service.id}:created`,
          label: "Service",
          title: service.name,
          description: service.description,
          detail: formatDateTime(service.createdAt),
          statusLabel: formatAtlasServiceStatusLabel(service.status),
          tone: resolveStatusTone(service.status)
        },
        ...auditEvents.map((event) => ({
          id: event.id,
          label: "Audit",
          title: formatTokenLabel(event.eventType),
          description: `${event.targetType} · ${event.targetId}`,
          detail: formatDateTime(event.occurredAt),
          statusLabel: formatTokenLabel(event.actorType),
          tone: "default" as const
        })),
        ...requests.map((request) => ({
          id: `${request.id}:request`,
          label: "Request",
          title: request.title,
          description: `${request.organization.name} · ${formatCurrencyMinor(request.amountMinor, request.currency)}`,
          detail: formatDateTime(request.createdAt),
          statusLabel: formatTokenLabel(request.status),
          tone: resolveStatusTone(request.status)
        }))
      ],
      emptyTitle: "No service activity available",
      emptyDescription: "Atlas will render service and request activity here once linked records exist."
    },
    related: {
      eyebrow: "Related records",
      title: "Linked buyer demand",
      description: "Seller services stay actionable when linked buyer requests remain directly reachable.",
      items: requests.map((request) =>
        createRelatedItem(
          request.id,
          request.title,
          request.organization.name,
          request.purpose,
          formatTokenLabel(request.status),
          resolveStatusTone(request.status),
          getAtlasWorkspaceDetailHref("SELLER", "requests", request.id)
        )
      ),
      emptyTitle: "No linked requests available",
      emptyDescription: "Buyer requests that target this service will appear here."
    },
    demoJourney: {
      eyebrow: "Replayable demo flow",
      title: "Related seeded scenarios",
      description: "Seller service detail stays connected to the broader seeded demo flow so two-sided lifecycle storytelling remains coherent.",
      items: createAtlasFocusedDemoScenarioCards(requests[0]?.id ?? null)
    }
  };
}

async function loadApprovalDetailModel(actor: AtlasActorContext, recordId: string): Promise<WorkspaceDetailModel | null> {
  const include = {
    approver: true,
    request: {
      include: {
        organization: true,
        sellerOrganization: true,
        agent: true,
        policy: true,
        payment: true,
        receipt: true,
        auditEvents: {
          orderBy: {
            occurredAt: "asc" as const
          }
        }
      }
    }
  };
  const approval =
    (await prisma.approval.findUnique({
      where: {
        id: recordId
      },
      include
    })) ??
    (await prisma.approval.findUnique({
      where: {
        requestId: recordId
      },
      include
    }));

  if (!approval || !canAccessRequest(actor, approval.request)) {
    return null;
  }

  const requestDetail = await loadRequestDetailModel(actor, "requests", approval.request.id);

  if (!requestDetail) {
    return null;
  }

  return {
    ...requestDetail,
    eyebrow: "Approval detail",
    title: `${approval.request.title} approval`,
    description: `${approval.request.organization.name} approval path · ${approval.approver?.email ?? "No approver recorded"}`,
    statusLabel: formatTokenLabel(approval.status),
    statusTone: resolveStatusTone(approval.status),
    metrics: [
      {
        label: "Approval status",
        value: formatTokenLabel(approval.status),
        detail: "Current approval posture for the request."
      },
      {
        label: "Approver",
        value: approval.approver?.name ?? approval.approver?.email ?? "Unassigned",
        detail: "Human approval identity recorded in the lifecycle."
      },
      {
        label: "Request amount",
        value: formatCurrencyMinor(approval.request.amountMinor, approval.request.currency),
        detail: "Amount under review by the approval record."
      },
      {
        label: "Payment follow-on",
        value: approval.request.payment ? formatTokenLabel(approval.request.payment.status) : "Not created",
        detail: "Payment remains a distinct lifecycle after the approval decision."
      }
    ],
    analysis: {
      eyebrow: "Decision reasoning",
      title: "Approval outcome and rationale",
      description:
        "Approval detail must preserve the human decision, the approver identity, and the matched request context without forcing operators to reconstruct it from the broader timeline.",
      items: [
        {
          label: "Decision reason",
          value: formatOptionalValue(approval.decisionReason, "No reason captured yet"),
          detail: "Approval decision reasons remain first-class records for later audit and export."
        },
        {
          label: "Approver identity",
          value: approval.approver?.email ?? "No approver assigned",
          detail: approval.approver?.name ?? "Approver display name not recorded"
        },
        {
          label: "Request status after decision",
          value: formatTokenLabel(approval.request.status),
          detail: "The related request lifecycle advances immediately after the approval decision."
        },
        {
          label: "Seller context",
          value: approval.request.sellerOrganization?.name ?? "Not assigned",
          detail: approval.request.sellerOrganization?.slug ?? "Seller not attached yet"
        }
      ],
      emptyTitle: "No approval reasoning available",
      emptyDescription: "Atlas will render approval-specific reasoning here when the record is available."
    },
    preview: {
      eyebrow: "Decision posture",
      title: "Approval decision summary",
      description: "This surface makes the human control step legible before deeper approval routing ships in Phase 2.",
      items: [
        {
          label: "Decision reason",
          value: approval.decisionReason ?? "No reason captured yet",
          detail: "Decision reason is preserved as a first-class lifecycle record."
        },
        {
          label: "Approver",
          value: approval.approver?.email ?? "No approver assigned",
          detail: approval.approver?.name ?? "Approver display name not recorded"
        },
        {
          label: "Buyer organization",
          value: approval.request.organization.name,
          detail: approval.request.organization.slug
        },
        {
          label: "Seller organization",
          value: approval.request.sellerOrganization?.name ?? "Not assigned",
          detail: approval.request.sellerOrganization?.slug ?? "Seller not attached yet"
        }
      ],
      emptyTitle: "No approval summary available",
      emptyDescription: "Atlas will render approval-specific context here when the record is available."
    },
    demoJourney: requestDetail.demoJourney
  };
}

async function loadPaymentDetailModel(actor: AtlasActorContext, recordId: string): Promise<WorkspaceDetailModel | null> {
  const include = {
    organization: true,
    sellerOrganization: true,
    attempts: {
      orderBy: {
        attemptNumber: "desc" as const
      }
    },
    request: {
      include: {
        organization: true,
        sellerOrganization: true,
        agent: true,
        policy: true,
        approval: {
          include: {
            approver: true
          }
        },
        receipt: true,
        auditEvents: {
          orderBy: {
            occurredAt: "asc" as const
          }
        }
      }
    }
  };
  const payment =
    (await prisma.payment.findUnique({
      where: {
        id: recordId
      },
      include
    })) ??
    (await prisma.payment.findUnique({
      where: {
        requestId: recordId
      },
      include
    }));

  if (!payment) {
    return null;
  }

  if (actor.workspace === "SELLER" && payment.sellerOrganizationId !== actor.organization.id) {
    return null;
  }

  const paymentMetadata =
    payment.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata)
      ? (payment.metadata as Record<string, unknown>)
      : null;
  const receiptMetadata =
    payment.request.receipt?.metadata &&
    typeof payment.request.receipt.metadata === "object" &&
    !Array.isArray(payment.request.receipt.metadata)
      ? (payment.request.receipt.metadata as Record<string, unknown>)
      : null;
  const sellerFulfillment = extractSellerFulfillment(
    payment.request.metadata && typeof payment.request.metadata === "object" && !Array.isArray(payment.request.metadata)
      ? (payment.request.metadata as Record<string, unknown>)
      : null
  );
  const reconciliationState =
    payment.status === "CAPTURED" && payment.request.receipt?.status === "AVAILABLE"
      ? "RECEIPT_AVAILABLE"
      : payment.status === "CAPTURED" && sellerFulfillment?.fulfillmentStatus !== "DELIVERED"
        ? "AWAITING_SELLER_CONFIRMATION"
        : payment.status === "AUTHORIZED"
          ? "AWAITING_SETTLEMENT"
          : payment.status === "FAILED"
            ? "FAILED"
            : payment.status === "VOIDED"
              ? "CANCELED"
              : payment.request.status === "APPROVED"
                ? "READY_TO_EXECUTE"
                : "AWAITING_PAYMENT_METHOD";

  const requestDetail = await loadRequestDetailModel(actor, actor.workspace === "SELLER" ? "requests" : "transactions", payment.request.id);

  if (!requestDetail) {
    return null;
  }

  return {
    ...requestDetail,
    eyebrow: "Payment detail",
    title: `${payment.request.title} payment`,
    description: `${payment.organization.name} → ${payment.sellerOrganization?.name ?? "No seller linked"} · ${formatAtlasPaymentRailLabel(payment.rail)}`,
    statusLabel: formatAtlasPaymentStatusLabel(payment.status),
    statusTone: resolveStatusTone(payment.status),
    metrics: [
      {
        label: "Payment status",
        value: formatAtlasPaymentStatusLabel(payment.status),
        detail: "Current seeded settlement posture for the payment record."
      },
      {
        label: "Rail",
        value: formatAtlasPaymentRailLabel(payment.rail),
        detail: payment.reference ?? "No external payment reference recorded"
      },
      {
        label: "Reconciliation",
        value: formatAtlasPaymentReconciliationStateLabel(reconciliationState),
        detail: payment.request.receipt?.status
          ? `Receipt ${formatAtlasReceiptStatusLabel(payment.request.receipt.status)}`
          : "Receipt record not available yet"
      },
      {
        label: "Amount",
        value: formatCurrencyMinor(payment.amountMinor, payment.currency),
        detail: "Captured amount remains distinct from request and receipt state."
      },
      {
        label: "Receipt",
        value: payment.request.receipt ? formatAtlasReceiptStatusLabel(payment.request.receipt.status) : "Not generated",
        detail: payment.request.receipt?.storageKey ?? "Receipt evidence not attached yet"
      }
    ],
    preview: {
      eyebrow: "Settlement evidence",
      title: "Payment evidence summary",
      description: "Atlas keeps payment evidence explicit so later rail integrations can extend the same record shape.",
      items: [
        {
          label: "Reference",
          value: payment.reference ?? "No external reference",
          detail: "Current seeded reference used for demo evidence."
        },
        {
          label: "Latest attempt",
          value: payment.attempts[0] ? `Attempt ${payment.attempts[0].attemptNumber}` : "No attempts recorded",
          detail: payment.attempts[0]?.reference ?? "Atlas will append immutable attempts here during execution."
        },
        {
          label: "Provider status",
          value:
            (typeof paymentMetadata?.latestProviderStatus === "string" && paymentMetadata.latestProviderStatus) ||
            (typeof receiptMetadata?.providerStatus === "string" && receiptMetadata.providerStatus) ||
            "Not captured",
          detail: "Atlas keeps the normalized payment status separate from the provider-native status."
        },
        {
          label: "Buyer organization",
          value: payment.organization.name,
          detail: payment.organization.slug
        },
        {
          label: "Seller organization",
          value: payment.sellerOrganization?.name ?? "Not assigned",
          detail: payment.sellerOrganization?.slug ?? "Seller relationship not attached"
        },
        {
          label: "Request status",
          value: formatTokenLabel(payment.request.status),
          detail: "Request and payment lifecycles remain intentionally separate."
        }
      ],
      emptyTitle: "No payment evidence available",
      emptyDescription: "Atlas will render settlement evidence here when the payment record exists."
    },
    analysis: {
      eyebrow: "Attempt history",
      title: "Immutable payment attempts",
      description: "Each payment attempt stays append-only so retries, failures, and later rail evidence remain auditable.",
      items: payment.attempts.slice(0, 4).map((attempt) => ({
        label: `Attempt ${attempt.attemptNumber}`,
        value: formatAtlasPaymentStatusLabel(attempt.status),
        detail:
          attempt.errorMessage ??
          (attempt.evidence &&
          typeof attempt.evidence === "object" &&
          !Array.isArray(attempt.evidence) &&
          typeof (attempt.evidence as Record<string, unknown>).providerStatus === "string"
            ? ((attempt.evidence as Record<string, unknown>).providerStatus as string)
            : attempt.reference ?? "No attempt evidence captured")
      })),
      emptyTitle: "No payment attempts recorded",
      emptyDescription: "Atlas will render immutable payment attempts here once execution begins."
    },
    demoJourney: requestDetail.demoJourney
  };
}

async function loadAuditDetailModel(
  actor: AtlasActorContext,
  surfaceKey: Extract<AtlasWorkspaceSurfaceKey, "activity" | "audit">,
  recordId: string
): Promise<WorkspaceDetailModel | null> {
  const event = await prisma.auditEvent.findUnique({
    where: {
      id: recordId
    },
    include: {
      organization: true,
      user: true,
      agent: true,
      request: {
        include: {
          organization: true,
          sellerOrganization: true,
          agent: true,
          policy: true,
          approval: {
            include: {
              approver: true
            }
          },
          payment: true,
          receipt: true,
          auditEvents: {
            orderBy: {
              occurredAt: "asc"
            }
          }
        }
      }
    }
  });

  if (!event || !canAccessAuditEvent(actor, event)) {
    return null;
  }

  const requestTimeline = event.request
    ? buildAtlasLifecycleTimeline({
        request: {
          id: event.request.id,
          title: event.request.title,
          status: event.request.status,
          amountMinor: event.request.amountMinor,
          currency: event.request.currency,
          serviceCategory: event.request.serviceCategory,
          createdAt: event.request.createdAt,
          updatedAt: event.request.updatedAt
        },
        approval: event.request.approval
          ? {
              id: event.request.approval.id,
              status: event.request.approval.status,
              decisionReason: event.request.approval.decisionReason,
              approverLabel: event.request.approval.approver?.name ?? event.request.approval.approver?.email ?? null,
              updatedAt: event.request.approval.updatedAt
            }
          : null,
        payment: event.request.payment
          ? {
              id: event.request.payment.id,
              status: event.request.payment.status,
              provider: event.request.payment.provider,
              reference: event.request.payment.reference,
              amountMinor: event.request.payment.amountMinor,
              currency: event.request.payment.currency,
              updatedAt: event.request.payment.updatedAt
            }
          : null,
        receipt: event.request.receipt
          ? {
              id: event.request.receipt.id,
              status: event.request.receipt.status,
              storageKey: event.request.receipt.storageKey,
              contentType: event.request.receipt.contentType,
              updatedAt: event.request.receipt.updatedAt
            }
          : null,
        auditEvents: event.request.auditEvents.map((auditEvent) => ({
          id: auditEvent.id,
          eventType: auditEvent.eventType,
          actorType: auditEvent.actorType,
          targetType: auditEvent.targetType,
          targetId: auditEvent.targetId,
          occurredAt: auditEvent.occurredAt
        }))
      })
    : [
        {
          id: event.id,
          label: "Audit",
          title: formatTokenLabel(event.eventType),
          description: `${event.targetType} · ${event.targetId}`,
          detail: formatDateTime(event.occurredAt),
          statusLabel: formatTokenLabel(event.actorType),
          tone: "default" as const
        }
      ];

  return {
    eyebrow: surfaceKey === "audit" ? "Platform audit detail" : "Buyer activity detail",
    title: formatTokenLabel(event.eventType),
    description: `${event.organization?.name ?? "Platform scope"} · ${event.targetType} ${event.targetId}`,
    statusLabel: formatTokenLabel(event.actorType),
    statusTone: "default",
    metrics: [
      {
        label: "Occurred",
        value: formatDateTime(event.occurredAt),
        detail: "Timestamp recorded on the audit event."
      },
      {
        label: "Actor type",
        value: formatTokenLabel(event.actorType),
        detail: "Current audit actor classification."
      },
      {
        label: "Target",
        value: `${event.targetType} ${event.targetId}`,
        detail: "Cross-entity target captured by the audit record."
      },
      {
        label: "Request",
        value: event.request?.title ?? "No request linked",
        detail: event.request ? formatTokenLabel(event.request.status) : "This event is not linked to a request lifecycle"
      }
    ],
    facts: [
      {
        label: "Organization",
        value: event.organization?.name ?? "Platform scope",
        detail: event.organization?.slug ?? "No organization attached"
      },
      {
        label: "User",
        value: event.user?.name ?? event.user?.email ?? "No user attached",
        detail: event.user?.email ?? "Audit event may have been generated system-side"
      },
      {
        label: "Agent",
        value: event.agent?.name ?? "No agent attached",
        detail: event.agent?.externalRef ?? "No agent reference available"
      },
      {
        label: "Target type",
        value: event.targetType,
        detail: event.targetId
      }
    ],
    preview: {
      eyebrow: "Audit payload",
      title: "Audit evidence summary",
      description: "Audit detail stays concise here while preserving the full lifecycle context through linked request records.",
      items: [
        {
          label: "Event type",
          value: formatTokenLabel(event.eventType),
          detail: "Current seeded audit event label."
        },
        {
          label: "Actor type",
          value: formatTokenLabel(event.actorType),
          detail: "Audit actor classification at the time of event capture."
        },
        {
          label: "Request",
          value: event.request?.title ?? "Not linked",
          detail: event.request?.id ?? "No request id captured"
        },
        {
          label: "Payload",
          value: formatJsonMetadataValue(event.payload),
          detail: "Payload is stored on the audit event and remains available for export later."
        }
      ],
      emptyTitle: "No audit summary available",
      emptyDescription: "Atlas will render audit evidence here when an event exists."
    },
    timeline: {
      eyebrow: "Audit-linked timeline",
      title: "Lifecycle around this event",
      description: "Audit records stay legible because they remain connected to the request lifecycle rather than floating as isolated logs.",
      items: requestTimeline,
      emptyTitle: "No lifecycle available",
      emptyDescription: "Atlas will render request-linked lifecycle history here when related records exist."
    },
    related: {
      eyebrow: "Cross-linked records",
      title: "Related records",
      description: "Atlas keeps the event connected to the request, actor, and platform oversight records around it.",
      items: [
        event.request
          ? createRelatedItem(
              event.request.id,
              "Related request",
              `${event.request.organization.name} → ${event.request.sellerOrganization?.name ?? "No seller linked"}`,
              formatTokenLabel(event.request.status),
              "request",
              resolveStatusTone(event.request.status),
              actor.workspace === "BUYER"
                ? getAtlasWorkspaceDetailHref("BUYER", "requests", event.request.id)
                : actor.workspace === "OPERATOR"
                  ? getAtlasWorkspaceDetailHref("OPERATOR", "transactions", event.request.id)
                  : null
            )
          : null
      ].filter(Boolean) as RecordListPanelItem[],
      emptyTitle: "No related records available",
      emptyDescription: "Related request and oversight records will appear here when they exist."
    },
    demoJourney: {
      eyebrow: "Replayable demo flow",
      title: "Related seeded scenarios",
      description:
        "Audit detail now remains anchored to the same seeded buyer-side walkthrough so the demo story stays coherent from overview to evidence.",
      items: createAtlasFocusedDemoScenarioCards(event.request?.id ?? null)
    }
  };
}

export async function loadWorkspaceDetailModel(
  actor: AtlasActorContext,
  surfaceKey: AtlasWorkspaceSurfaceKey,
  recordId: string
): Promise<WorkspaceDetailModel | null> {
  if (surfaceKey === "requests" || surfaceKey === "transactions") {
    return loadRequestDetailModel(actor, surfaceKey, recordId);
  }

  if (surfaceKey === "approvals") {
    return loadApprovalDetailModel(actor, recordId);
  }

  if (surfaceKey === "services") {
    return loadServiceDetailModel(actor, recordId);
  }

  if (surfaceKey === "payments") {
    return loadPaymentDetailModel(actor, recordId);
  }

  if (surfaceKey === "activity" || surfaceKey === "audit") {
    return loadAuditDetailModel(actor, surfaceKey, recordId);
  }

  return null;
}
