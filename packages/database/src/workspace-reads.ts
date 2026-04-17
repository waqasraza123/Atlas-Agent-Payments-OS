import type { AtlasActorContext } from "@atlas/auth";
import {
  deriveAtlasPaymentReconciliationState,
  formatAtlasPaymentReconciliationStateLabel,
  listAtlasQueueDefinitions,
  listAtlasQueueDefinitionsForFamily,
  type AtlasSellerRequestRecord,
  type AtlasSellerServiceRecord,
  type AtlasWorkspaceSurfaceKey
} from "@atlas/domain";
import { Prisma, type PrismaClient } from "./generated/client/index.js";
import { prisma } from "./client";
import {
  listBuyerAgents,
  listBuyerApprovals,
  listBuyerPolicies,
  listBuyerRequests,
  type AtlasBuyerAgentRecord,
  type AtlasBuyerApprovalRecord,
  type AtlasBuyerPolicyRecord,
  type AtlasBuyerRequestRecord
} from "./buyer-workflow";
import { listPaymentIntents, listReceiptRecords } from "./payments-workflow";
import {
  listSellerRequests,
  listSellerServices
} from "./seller-workflow";
import { createAtlasTenantAccessAuditEvent } from "./tenant-access-audit";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export type AtlasWorkspaceListTone = "default" | "success" | "warning" | "critical";

export type AtlasWorkspaceMetricRecord = {
  label: string;
  value: string;
  detail: string;
};

export type AtlasWorkspaceListItemRecord = {
  id: string;
  title: string;
  description: string;
  detail: string;
  statusLabel?: string;
  statusTone?: AtlasWorkspaceListTone;
  detailSurfaceKey?: AtlasWorkspaceSurfaceKey | null;
};

export type AtlasWorkspaceOverviewRecord = {
  metrics: AtlasWorkspaceMetricRecord[];
  activity: AtlasWorkspaceListItemRecord[];
};

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCurrencyMinor(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(amountMinor / 100);
}

function resolveRequestStatusTone(status: string): AtlasWorkspaceListTone {
  if (status === "COMPLETED" || status === "APPROVED") {
    return "success";
  }

  if (status === "FAILED" || status === "REJECTED" || status === "CANCELED") {
    return "critical";
  }

  if (status === "SUBMITTED" || status === "EXECUTING") {
    return "warning";
  }

  return "default";
}

function resolvePaymentStatusTone(status: string): AtlasWorkspaceListTone {
  if (status === "CAPTURED") {
    return "success";
  }

  if (status === "FAILED" || status === "VOIDED") {
    return "critical";
  }

  if (status === "AUTHORIZED" || status === "PENDING") {
    return "warning";
  }

  return "default";
}

function resolveReceiptStatusTone(status: string): AtlasWorkspaceListTone {
  if (status === "AVAILABLE") {
    return "success";
  }

  if (status === "FAILED") {
    return "critical";
  }

  return "warning";
}

function extractSellerFulfillmentStatus(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const sellerFulfillment = (metadata as Record<string, unknown>).sellerFulfillment;

  if (!sellerFulfillment || typeof sellerFulfillment !== "object" || Array.isArray(sellerFulfillment)) {
    return null;
  }

  const fulfillmentStatus = (sellerFulfillment as Record<string, unknown>).fulfillmentStatus;
  return fulfillmentStatus === "DELIVERED" || fulfillmentStatus === "FAILED" ? fulfillmentStatus : null;
}

function derivePaymentReconciliationLabel(input: {
  requestStatus: string;
  paymentStatus: string;
  receiptStatus: string | null;
  sellerFulfillmentStatus: "DELIVERED" | "FAILED" | null;
}) {
  return formatAtlasPaymentReconciliationStateLabel(
    deriveAtlasPaymentReconciliationState({
      requestStatus: input.requestStatus,
      paymentStatus: input.paymentStatus as Parameters<typeof deriveAtlasPaymentReconciliationState>[0]["paymentStatus"],
      receiptStatus: input.receiptStatus as Parameters<typeof deriveAtlasPaymentReconciliationState>[0]["receiptStatus"],
      sellerFulfillmentStatus: input.sellerFulfillmentStatus
    })
  );
}

function isSupportTenantReadActor(actor: AtlasActorContext) {
  return actor.source === "internal-support" && actor.supportAccess !== null && actor.principalOrganization !== null;
}

async function auditWorkspaceOverviewRead(
  actor: AtlasActorContext,
  overview: AtlasWorkspaceOverviewRecord,
  client: DatabaseClient
) {
  if (!isSupportTenantReadActor(actor)) {
    return;
  }

  if (actor.workspace !== "BUYER" && actor.workspace !== "SELLER") {
    return;
  }

  await createAtlasTenantAccessAuditEvent(client, actor, {
    eventType:
      actor.workspace === "BUYER"
        ? "support_access.buyer_overview_inspected"
        : "support_access.seller_overview_inspected",
    targetType:
      actor.workspace === "BUYER"
        ? "buyer_overview_scope"
        : "seller_overview_scope",
    targetId: actor.organization.id,
    payload: {
      metricCount: overview.metrics.length,
      activityCount: overview.activity.length,
      activityIds: overview.activity.slice(0, 10).map((item) => item.id)
    }
  });
}

async function auditWorkspaceSurfaceRead(
  actor: AtlasActorContext,
  surfaceKey: AtlasWorkspaceSurfaceKey,
  items: AtlasWorkspaceListItemRecord[],
  client: DatabaseClient
) {
  if (!isSupportTenantReadActor(actor)) {
    return;
  }

  if (actor.workspace !== "BUYER" && actor.workspace !== "SELLER") {
    return;
  }

  await createAtlasTenantAccessAuditEvent(client, actor, {
    eventType:
      actor.workspace === "BUYER"
        ? "support_access.buyer_surface_inspected"
        : "support_access.seller_surface_inspected",
    targetType:
      actor.workspace === "BUYER"
        ? "buyer_workspace_surface"
        : "seller_workspace_surface",
    targetId: `${actor.organization.id}:${surfaceKey}`,
    payload: {
      surfaceKey,
      resultCount: items.length,
      itemIds: items.slice(0, 10).map((item) => item.id)
    }
  });
}

async function getBuyerOverview(actor: AtlasActorContext, client: DatabaseClient): Promise<AtlasWorkspaceOverviewRecord> {
  const [activeAgents, policies, requests, pendingApprovals, capturedPayments, recentRequests, failedRequests] =
    await Promise.all([
      client.agent.count({
        where: {
          organizationId: actor.organization.id,
          status: "ACTIVE"
        }
      }),
      client.policy.count({
        where: {
          organizationId: actor.organization.id
        }
      }),
      client.spendRequest.count({
        where: {
          organizationId: actor.organization.id
        }
      }),
      client.approval.count({
        where: {
          request: {
            organizationId: actor.organization.id
          },
          status: "PENDING"
        }
      }),
      client.payment.aggregate({
        where: {
          organizationId: actor.organization.id,
          status: "CAPTURED"
        },
        _sum: {
          amountMinor: true
        }
      }),
      listBuyerRequests(actor.organization.id, client).then((items) => items.slice(0, 3)),
      client.spendRequest.count({
        where: {
          organizationId: actor.organization.id,
          status: "FAILED"
        }
      })
    ]);

  return {
    metrics: [
      {
        label: "Active agents",
        value: formatCount(activeAgents),
        detail: "Buyer-linked actors currently allowed to initiate spend against seeded policies."
      },
      {
        label: "Spend policies",
        value: formatCount(policies),
        detail: "Policy records defining allowlists, thresholds, and approval posture."
      },
      {
        label: "Request volume",
        value: formatCount(requests),
        detail: "Seeded request states already span draft through completed, failed, and rejected flows."
      },
      {
        label: "Pending approvals",
        value: formatCount(pendingApprovals),
        detail: "Requests that still require a human decision before payment can proceed."
      },
      {
        label: "Captured spend",
        value: formatCurrencyMinor(capturedPayments._sum.amountMinor ?? 0, "USD"),
        detail: "Completed seeded spend already reflects money movement across buyer and seller organizations."
      },
      {
        label: "Exceptions",
        value: formatCount(failedRequests),
        detail: "Failed seeded requests already surface the buyer-side operational watchlist."
      }
    ],
    activity: recentRequests.map((request) => ({
      id: request.id,
      title: request.title,
      description: `${request.status} · ${formatCurrencyMinor(request.amountMinor, request.currency)}`,
      detail: request.sellerOrganizationName ?? "No seller linked",
      detailSurfaceKey: "requests"
    }))
  };
}

async function getSellerOverview(actor: AtlasActorContext, client: DatabaseClient): Promise<AtlasWorkspaceOverviewRecord> {
  const [inboundRequests, capturedPayments, recentBuyers, recentSellerRequests, pendingAuthorizations, failedDeliveries] =
    await Promise.all([
      client.spendRequest.count({
        where: {
          sellerOrganizationId: actor.organization.id
        }
      }),
      client.payment.count({
        where: {
          sellerOrganizationId: actor.organization.id,
          status: "CAPTURED"
        }
      }),
      client.organization.count({
        where: {
          buyerRequests: {
            some: {
              sellerOrganizationId: actor.organization.id
            }
          }
        }
      }),
      listSellerRequests(actor.organization.id, client).then((items) => items.slice(0, 3)),
      client.payment.count({
        where: {
          sellerOrganizationId: actor.organization.id,
          status: "AUTHORIZED"
        }
      }),
      client.spendRequest.count({
        where: {
          sellerOrganizationId: actor.organization.id,
          status: "FAILED"
        }
      })
    ]);

  return {
    metrics: [
      {
        label: "Inbound requests",
        value: formatCount(inboundRequests),
        detail: "Buyer-originated requests currently routed to this seller."
      },
      {
        label: "Captured payments",
        value: formatCount(capturedPayments),
        detail: "Settled seeded payments already visible to the seller-side operating surface."
      },
      {
        label: "Buyer organizations",
        value: formatCount(recentBuyers),
        detail: "Distinct buyer organizations present in current seeded data."
      },
      {
        label: "Awaiting confirmation",
        value: formatCount(pendingAuthorizations),
        detail: "Payment-authorized work still waiting on seller confirmation or downstream completion."
      },
      {
        label: "Failed actions",
        value: formatCount(failedDeliveries),
        detail: "Seeded failures that later webhook and support tooling must explain."
      },
      {
        label: "Active role",
        value: actor.membership.role,
        detail: "The current seller-side actor context used for local development."
      }
    ],
    activity: recentSellerRequests.map((request) => ({
      id: request.id,
      title: request.title,
      description: `${request.status} · ${formatCurrencyMinor(request.amountMinor, request.currency)}`,
      detail: request.buyerOrganizationName,
      detailSurfaceKey: "requests"
    }))
  };
}

async function getOperatorOverview(client: DatabaseClient, actor: AtlasActorContext): Promise<AtlasWorkspaceOverviewRecord> {
  const queueFamilies = new Set(listAtlasQueueDefinitions().map((definition) => definition.family)).size;
  const [organizations, pendingApprovals, failedRequests, recentAuditEvents, completedPayments] = await Promise.all([
    client.organization.count(),
    client.approval.count({
      where: {
        status: "PENDING"
      }
    }),
    client.spendRequest.count({
      where: {
        status: "FAILED"
      }
    }),
    client.auditEvent.findMany({
      orderBy: {
        occurredAt: "desc"
      },
      take: 4
    }),
    client.payment.count({
      where: {
        status: "CAPTURED"
      }
    })
  ]);

  return {
    metrics: [
      {
        label: "Organizations",
        value: formatCount(organizations),
        detail: "Buyer, seller, and operator orgs visible to the platform operator."
      },
      {
        label: "Pending approvals",
        value: formatCount(pendingApprovals),
        detail: "Requests that still need a buyer-side human decision."
      },
      {
        label: "Failed requests",
        value: formatCount(failedRequests),
        detail: "Seeded lifecycle failures that should surface in operator review."
      },
      {
        label: "Captured payments",
        value: formatCount(completedPayments),
        detail: "Platform-wide settled payments already visible in the current demo baseline."
      },
      {
        label: "Queue families",
        value: formatCount(queueFamilies),
        detail: "Background work is already separated by approval, notification, payment, webhook, and audit families."
      },
      {
        label: "Active role",
        value: actor.membership.role,
        detail: "The current operator-side actor context used for local development."
      }
    ],
    activity: recentAuditEvents.map((event) => ({
      id: event.id,
      title: event.eventType,
      description: `${event.targetType} · ${event.targetId}`,
      detail: event.actorType,
      detailSurfaceKey: "audit"
    }))
  };
}

async function listBuyerOverviewItems(actor: AtlasActorContext, client: DatabaseClient): Promise<AtlasWorkspaceListItemRecord[]> {
  const [agents, sellers, approvals] = await Promise.all([
    listBuyerAgents(actor.organization.id, client).then((items) => items.slice(0, 3)),
    client.organization.findMany({
      where: {
        sellerRequests: {
          some: {
            organizationId: actor.organization.id
          }
        }
      },
      include: {
        _count: {
          select: {
            sellerRequests: true
          }
        }
      },
      take: 2
    }),
    listBuyerApprovals(actor.organization.id, client).then((items) => items.slice(0, 2))
  ]);

  return [
    ...agents.map((agent) => ({
      id: agent.id,
      title: agent.name,
      description: `${agent.requestCount} seeded requests linked to this agent`,
      detail: `Status: ${agent.status}`,
      statusLabel: "agent",
      statusTone: agent.status === "ACTIVE" ? "success" : "warning"
    })),
    ...sellers.map((seller) => ({
      id: seller.id,
      title: seller.name,
      description: `${seller._count.sellerRequests} seeded requests routed to this seller`,
      detail: `${seller.kind} organization`,
      statusLabel: "seller"
    })),
    ...approvals.map((approval) => ({
      id: approval.id,
      title: approval.requestTitle,
      description: `Approval state: ${approval.status}`,
      detail: approval.decisionReason ?? "Decision reason not captured yet",
      statusLabel: approval.status,
      statusTone: approval.status === "APPROVED" ? "success" : approval.status === "PENDING" ? "warning" : "critical",
      detailSurfaceKey: "approvals"
    }))
  ];
}

function mapBuyerAgentItems(agents: AtlasBuyerAgentRecord[]): AtlasWorkspaceListItemRecord[] {
  return agents.map((agent) => ({
    id: agent.id,
    title: agent.name,
    description: agent.policyName ?? "No policy linked yet",
    detail: agent.externalRef ?? "No external reference",
    statusLabel: agent.status,
    statusTone: agent.status === "ACTIVE" ? "success" : agent.status === "PAUSED" ? "warning" : "default"
  }));
}

function mapBuyerPolicyItems(policies: AtlasBuyerPolicyRecord[]): AtlasWorkspaceListItemRecord[] {
  return policies.map((policy) => ({
    id: policy.id,
    title: policy.name,
    description: `${policy.linkedAgentCount} linked agents · ${policy.requestCount} requests`,
    detail: "Rules payload shape is stored and ready for Phase 2 evaluation work",
    statusLabel: policy.status,
    statusTone: policy.status === "ACTIVE" ? "success" : "default"
  }));
}

function mapBuyerRequestItems(requests: AtlasBuyerRequestRecord[]): AtlasWorkspaceListItemRecord[] {
  return requests.map((request) => ({
    id: request.id,
    title: request.title,
    description: `${formatCurrencyMinor(request.amountMinor, request.currency)} · ${request.serviceCategory}`,
    detail: request.sellerOrganizationName ?? "No seller linked",
    detailSurfaceKey: "requests",
    statusLabel: request.status,
    statusTone: resolveRequestStatusTone(request.status)
  }));
}

function mapBuyerApprovalItems(approvals: AtlasBuyerApprovalRecord[]): AtlasWorkspaceListItemRecord[] {
  return approvals.map((approval) => ({
    id: approval.id,
    title: approval.requestTitle,
    description: `${formatCurrencyMinor(approval.amountMinor, approval.currency)} · ${approval.serviceCategory}`,
    detail: approval.decisionReason ?? "Decision reason not captured yet",
    detailSurfaceKey: "approvals",
    statusLabel: approval.status,
    statusTone: approval.status === "APPROVED" ? "success" : approval.status === "PENDING" ? "warning" : "critical"
  }));
}

async function listBuyerActivityItems(actor: AtlasActorContext, client: DatabaseClient): Promise<AtlasWorkspaceListItemRecord[]> {
  const events = await client.auditEvent.findMany({
    where: {
      OR: [
        {
          organizationId: actor.organization.id
        },
        {
          request: {
            is: {
              organizationId: actor.organization.id
            }
          }
        }
      ]
    },
    orderBy: {
      occurredAt: "desc"
    },
    take: 8
  });

  return events.map((event) => ({
    id: event.id,
    title: event.eventType,
    description: `${event.targetType} · ${event.targetId}`,
    detail: event.actorType,
    detailSurfaceKey: "activity",
    statusLabel: "event"
  }));
}

async function listSellerCustomers(
  organizationId: string,
  limit: number,
  client: DatabaseClient
) {
  return client.organization.findMany({
    where: {
      buyerRequests: {
        some: {
          sellerOrganizationId: organizationId
        }
      }
    },
    include: {
      _count: {
        select: {
          buyerRequests: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: limit
  });
}

async function listSellerOverviewItems(actor: AtlasActorContext, client: DatabaseClient): Promise<AtlasWorkspaceListItemRecord[]> {
  const [recentRequests, topCustomers] = await Promise.all([
    listSellerRequests(actor.organization.id, client).then((items) => items.slice(0, 4)),
    listSellerCustomers(actor.organization.id, 2, client)
  ]);

  return [
    ...recentRequests.map((request) => ({
      id: request.id,
      title: request.title,
      description: `${request.buyerOrganizationName} · ${formatCurrencyMinor(request.amountMinor, request.currency)}`,
      detail: request.serviceCategory,
      detailSurfaceKey: "requests",
      statusLabel: request.status,
      statusTone: resolveRequestStatusTone(request.status)
    })),
    ...topCustomers.map((organization) => ({
      id: organization.id,
      title: organization.name,
      description: `${organization._count.buyerRequests} seeded requests`,
      detail: `${organization.kind} organization`,
      statusLabel: "customer"
    }))
  ];
}

function mapSellerServiceItems(services: AtlasSellerServiceRecord[]): AtlasWorkspaceListItemRecord[] {
  return services.map((service) => ({
    id: service.id,
    title: service.name,
    description: `${service.category} · ${formatCurrencyMinor(service.priceMinor, service.currency)}`,
    detail: `${service.linkedRequestCount} linked requests`,
    detailSurfaceKey: "services",
    statusLabel: service.status,
    statusTone: service.status === "PUBLISHED" ? "success" : service.status === "DRAFT" ? "warning" : "default"
  }));
}

function mapSellerRequestItems(requests: AtlasSellerRequestRecord[]): AtlasWorkspaceListItemRecord[] {
  return requests.map((request) => ({
    id: request.id,
    title: request.title,
    description: `${request.buyerOrganizationName} · ${formatCurrencyMinor(request.amountMinor, request.currency)}`,
    detail: request.serviceCategory,
    detailSurfaceKey: "requests",
    statusLabel: request.status,
    statusTone: resolveRequestStatusTone(request.status)
  }));
}

async function listSellerPaymentItems(actor: AtlasActorContext, client: DatabaseClient): Promise<AtlasWorkspaceListItemRecord[]> {
  const payments = await listPaymentIntents(actor, client);

  return payments.slice(0, 8).map((payment) => ({
    id: payment.id,
    title: payment.requestId,
    description: `${payment.buyerOrganizationName} · ${formatCurrencyMinor(payment.amountMinor, payment.currency)}`,
    detail: `${formatAtlasPaymentReconciliationStateLabel(payment.reconciliationState)} · ${payment.reference ?? "No payment reference"}`,
    detailSurfaceKey: "payments",
    statusLabel: payment.status,
    statusTone: resolvePaymentStatusTone(payment.status)
  }));
}

async function listSellerCustomerItems(actor: AtlasActorContext, client: DatabaseClient): Promise<AtlasWorkspaceListItemRecord[]> {
  const organizations = await listSellerCustomers(actor.organization.id, 8, client);

  return organizations.map((organization) => ({
    id: organization.id,
    title: organization.name,
    description: `${organization.kind} organization`,
    detail: `${formatCount(organization._count.buyerRequests)} related requests`,
    statusLabel: "active"
  }));
}

async function listOperatorOverviewItems(client: DatabaseClient): Promise<AtlasWorkspaceListItemRecord[]> {
  const [exceptionRequests, pendingApprovals, organizations] = await Promise.all([
    client.spendRequest.findMany({
      where: {
        status: "FAILED"
      },
      include: {
        organization: true,
        sellerOrganization: true
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 3
    }),
    client.approval.findMany({
      where: {
        status: "PENDING"
      },
      include: {
        request: {
          include: {
            organization: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 2
    }),
    client.organization.findMany({
      include: {
        _count: {
          select: {
            buyerRequests: true,
            sellerRequests: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 2
    })
  ]);

  return [
    ...exceptionRequests.map((request) => ({
      id: request.id,
      title: request.title,
      description: `${request.organization.name} → ${request.sellerOrganization?.name ?? "No seller"}`,
      detail: `${formatCurrencyMinor(request.amountMinor, request.currency)} · failed lifecycle`,
      detailSurfaceKey: "transactions" as const,
      statusLabel: request.status,
      statusTone: "critical" as const
    })),
    ...pendingApprovals.map((approval) => ({
      id: approval.id,
      title: approval.request.title,
      description: approval.request.organization.name,
      detail: `Pending decision for ${approval.request.currency} ${approval.request.amountMinor / 100}`,
      statusLabel: approval.status,
      statusTone: "warning" as const
    })),
    ...organizations.map((organization) => ({
      id: organization.id,
      title: organization.name,
      description: `${organization.kind} organization`,
      detail: `${formatCount(organization._count.buyerRequests + organization._count.sellerRequests)} tracked requests`,
      statusLabel: organization.kind
    }))
  ];
}

async function listOperatorTransactionItems(client: DatabaseClient): Promise<AtlasWorkspaceListItemRecord[]> {
  const requests = await client.spendRequest.findMany({
    include: {
      organization: true,
      sellerOrganization: true,
      payment: true,
      receipt: true
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 8
  });

  return requests.map((request) => ({
    id: request.id,
    title: request.title,
    description: `${request.organization.name} → ${request.sellerOrganization?.name ?? "No seller"}`,
    detail: request.payment
      ? `${derivePaymentReconciliationLabel({
          requestStatus: request.status,
          paymentStatus: request.payment.status,
          receiptStatus: request.receipt?.status ?? null,
          sellerFulfillmentStatus: extractSellerFulfillmentStatus(request.metadata)
        })} · ${request.payment.status}`
      : request.status,
    detailSurfaceKey: "transactions",
    statusLabel: request.status,
    statusTone: resolveRequestStatusTone(request.status)
  }));
}

async function listOperatorOrganizationItems(client: DatabaseClient): Promise<AtlasWorkspaceListItemRecord[]> {
  const organizations = await client.organization.findMany({
    include: {
      _count: {
        select: {
          memberships: true,
          agents: true,
          buyerRequests: true,
          sellerRequests: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 8
  });

  return organizations.map((organization) => ({
    id: organization.id,
    title: organization.name,
    description: `${organization.kind} · ${formatCount(organization._count.memberships)} memberships`,
    detail: `${formatCount(organization._count.agents)} agents · ${formatCount(
      organization._count.buyerRequests + organization._count.sellerRequests
    )} requests`,
    statusLabel: organization.kind
  }));
}

async function listOperatorReceiptItems(actor: AtlasActorContext, client: DatabaseClient): Promise<AtlasWorkspaceListItemRecord[]> {
  const receipts = await listReceiptRecords(actor, client);

  return receipts.slice(0, 8).map((receipt) => ({
    id: receipt.id,
    title: receipt.requestTitle,
    description: `${receipt.buyerOrganizationName} → ${receipt.sellerOrganizationName ?? "No seller"}`,
    detail: `${formatAtlasPaymentReconciliationStateLabel(receipt.reconciliationState)} · ${receipt.paymentStatus ?? "No payment status"}`,
    detailSurfaceKey: "receipts",
    statusLabel: receipt.status,
    statusTone: resolveReceiptStatusTone(receipt.status)
  }));
}

async function listOperatorApprovalItems(client: DatabaseClient): Promise<AtlasWorkspaceListItemRecord[]> {
  const approvals = await client.approval.findMany({
    include: {
      request: {
        include: {
          organization: true
        }
      },
      approver: true
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 8
  });

  return approvals.map((approval) => ({
    id: approval.id,
    title: approval.request.title,
    description: approval.request.organization.name,
    detail: approval.approver?.email ?? "No approver recorded",
    statusLabel: approval.status,
    statusTone: approval.status === "APPROVED" ? "success" : approval.status === "PENDING" ? "warning" : "critical"
  }));
}

async function listOperatorExceptionItems(client: DatabaseClient): Promise<AtlasWorkspaceListItemRecord[]> {
  const failedRequests = await client.spendRequest.findMany({
    where: {
      status: "FAILED"
    },
    include: {
      organization: true,
      sellerOrganization: true
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 8
  });

  return failedRequests.map((request) => ({
    id: request.id,
    title: request.title,
    description: `${request.organization.name} → ${request.sellerOrganization?.name ?? "No seller"}`,
    detail: `${formatCurrencyMinor(request.amountMinor, request.currency)} · ${request.serviceCategory}`,
    detailSurfaceKey: "transactions",
    statusLabel: request.status,
    statusTone: "critical"
  }));
}

async function listOperatorAuditItems(client: DatabaseClient): Promise<AtlasWorkspaceListItemRecord[]> {
  const events = await client.auditEvent.findMany({
    orderBy: {
      occurredAt: "desc"
    },
    take: 10
  });

  return events.map((event) => ({
    id: event.id,
    title: event.eventType,
    description: `${event.targetType} · ${event.targetId}`,
    detail: event.actorType,
    detailSurfaceKey: "audit",
    statusLabel: "event"
  }));
}

export async function getWorkspaceOverviewForActor(
  actor: AtlasActorContext,
  client: DatabaseClient = prisma
): Promise<AtlasWorkspaceOverviewRecord> {
  const overview =
    actor.workspace === "BUYER"
      ? await getBuyerOverview(actor, client)
      : actor.workspace === "SELLER"
        ? await getSellerOverview(actor, client)
        : await getOperatorOverview(client, actor);

  await auditWorkspaceOverviewRead(actor, overview, client);
  return overview;
}

export async function listWorkspaceSurfacePrimaryItemsForActor(
  actor: AtlasActorContext,
  surfaceKey: AtlasWorkspaceSurfaceKey,
  client: DatabaseClient = prisma
): Promise<AtlasWorkspaceListItemRecord[]> {
  let items: AtlasWorkspaceListItemRecord[];

  if (actor.workspace === "BUYER") {
    if (surfaceKey === "overview") {
      items = await listBuyerOverviewItems(actor, client);
    } else if (surfaceKey === "agents") {
      items = mapBuyerAgentItems((await listBuyerAgents(actor.organization.id, client)).slice(0, 6));
    } else if (surfaceKey === "policies") {
      items = mapBuyerPolicyItems((await listBuyerPolicies(actor.organization.id, client)).slice(0, 6));
    } else if (surfaceKey === "requests") {
      items = mapBuyerRequestItems((await listBuyerRequests(actor.organization.id, client)).slice(0, 8));
    } else if (surfaceKey === "approvals") {
      items = mapBuyerApprovalItems((await listBuyerApprovals(actor.organization.id, client)).slice(0, 8));
    } else if (surfaceKey === "receipts") {
      items = (await listReceiptRecords(actor, client)).slice(0, 8).map((receipt) => ({
        id: receipt.id,
        title: receipt.requestTitle,
        description: `${formatCurrencyMinor(receipt.amountMinor, receipt.currency)} · ${receipt.serviceCategory}`,
        detail: `${formatAtlasPaymentReconciliationStateLabel(receipt.reconciliationState)} · ${
          receipt.paymentReference ?? "No payment reference"
        }`,
        detailSurfaceKey: "receipts",
        statusLabel: receipt.status,
        statusTone: resolveReceiptStatusTone(receipt.status)
      }));
    } else if (surfaceKey === "activity") {
      items = await listBuyerActivityItems(actor, client);
    } else {
      items = [];
    }
  } else if (actor.workspace === "SELLER") {
    if (surfaceKey === "overview") {
      items = await listSellerOverviewItems(actor, client);
    } else if (surfaceKey === "services") {
      items = mapSellerServiceItems((await listSellerServices(actor.organization.id, client)).slice(0, 6));
    } else if (surfaceKey === "requests") {
      items = mapSellerRequestItems((await listSellerRequests(actor.organization.id, client)).slice(0, 8));
    } else if (surfaceKey === "payments") {
      items = await listSellerPaymentItems(actor, client);
    } else if (surfaceKey === "customers") {
      items = await listSellerCustomerItems(actor, client);
    } else if (surfaceKey === "webhooks") {
      items = listAtlasQueueDefinitionsForFamily("seller-webhooks").map((queue) => ({
        id: queue.key,
        title: queue.title,
        description: queue.description,
        detail: `${queue.name} · ${queue.nextPhase}`,
        statusLabel: queue.readiness,
        statusTone: queue.readiness === "baseline" ? "success" : "warning"
      }));
    } else {
      items = [];
    }
  } else if (surfaceKey === "overview") {
    items = await listOperatorOverviewItems(client);
  } else if (surfaceKey === "organizations") {
    items = await listOperatorOrganizationItems(client);
  } else if (surfaceKey === "transactions") {
    items = await listOperatorTransactionItems(client);
  } else if (surfaceKey === "receipts") {
    items = await listOperatorReceiptItems(actor, client);
  } else if (surfaceKey === "approvals") {
    items = await listOperatorApprovalItems(client);
  } else if (surfaceKey === "exceptions") {
    items = await listOperatorExceptionItems(client);
  } else if (surfaceKey === "audit") {
    items = await listOperatorAuditItems(client);
  } else {
    items = [];
  }

  await auditWorkspaceSurfaceRead(actor, surfaceKey, items, client);
  return items;
}
