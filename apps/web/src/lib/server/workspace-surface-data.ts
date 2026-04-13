import {
  deriveAtlasPaymentReconciliationState,
  formatAtlasPaymentReconciliationStateLabel,
  getAtlasWorkspaceSurfaceByKey,
  listAtlasApiDomainDefinitionsForWorkspace,
  listAtlasQueueDefinitionsForFamily,
  type AtlasWorkspaceSurfaceKey
} from "@atlas/domain";
import { listReceiptRecords, prisma } from "@atlas/database";
import type { AtlasActorContext } from "@atlas/auth";
import type { OrganizationKind, PaymentStatus, SpendRequestStatus } from "@atlas/types";
import type { RecordListPanelItem } from "@atlas/ui";
import { getWorkspaceEmptyStateDescription, loadWorkspaceOverviewModel, type WorkspaceOverviewModel } from "./workspace-data";
import { auditWorkspaceSurfaceInspection } from "./tenant-read-audit";
import { getAtlasWorkspaceDetailHref } from "@/lib/detail-hrefs";

export type WorkspaceSurfaceModel = {
  surfaceKey: AtlasWorkspaceSurfaceKey;
  overview: WorkspaceOverviewModel;
  primary: {
    eyebrow: string;
    title: string;
    description: string;
    items: RecordListPanelItem[];
    emptyTitle: string;
    emptyDescription: string;
  };
  moduleAlignment: {
    eyebrow: string;
    title: string;
    description: string;
    items: RecordListPanelItem[];
    emptyTitle: string;
    emptyDescription: string;
  };
  activity: {
    eyebrow: string;
    title: string;
    description: string;
    items: RecordListPanelItem[];
    emptyTitle: string;
    emptyDescription: string;
  };
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

function resolveRequestStatusTone(status: SpendRequestStatus): RecordListPanelItem["statusTone"] {
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

function resolvePaymentStatusTone(status: PaymentStatus): RecordListPanelItem["statusTone"] {
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

function resolveReceiptStatusTone(status: "PENDING" | "AVAILABLE" | "FAILED"): RecordListPanelItem["statusTone"] {
  if (status === "AVAILABLE") {
    return "success";
  }

  if (status === "FAILED") {
    return "critical";
  }

  return "warning";
}

function extractSellerFulfillmentStatus(metadata: unknown) {
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
  requestStatus: SpendRequestStatus;
  paymentStatus: PaymentStatus;
  receiptStatus: string | null;
  sellerFulfillmentStatus: "DELIVERED" | "FAILED" | null;
}) {
  const reconciliationState =
    deriveAtlasPaymentReconciliationState({
      requestStatus: input.requestStatus,
      paymentStatus: input.paymentStatus,
      receiptStatus: input.receiptStatus as "PENDING" | "AVAILABLE" | "FAILED" | null,
      sellerFulfillmentStatus: input.sellerFulfillmentStatus
    });

  return formatAtlasPaymentReconciliationStateLabel(reconciliationState);
}

function createModuleAlignmentItems(workspace: OrganizationKind): RecordListPanelItem[] {
  return listAtlasApiDomainDefinitionsForWorkspace(workspace).map((definition) => ({
    id: definition.key,
    title: definition.title,
    description: definition.description,
    detail: `${definition.routePrefix} · ${definition.nextPhase}`,
    statusLabel: definition.readiness,
    statusTone: definition.readiness === "skeleton" ? "success" : "warning"
  }));
}

async function loadBuyerPrimaryItems(actor: AtlasActorContext, surfaceKey: AtlasWorkspaceSurfaceKey) {
  if (surfaceKey === "overview") {
    const [agents, sellers, approvals] = await Promise.all([
      prisma.agent.findMany({
        where: {
          organizationId: actor.organization.id
        },
        include: {
          _count: {
            select: {
              requests: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 3
      }),
      prisma.organization.findMany({
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
      prisma.approval.findMany({
        where: {
          request: {
            organizationId: actor.organization.id
          }
        },
        include: {
          request: true
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 2
      })
    ]);

    return [
      ...agents.map((agent) => ({
        id: agent.id,
        title: agent.name,
        description: `${agent._count.requests} seeded requests linked to this agent`,
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
        title: approval.request.title,
        description: `Approval state: ${approval.status}`,
        detail: approval.decisionReason ?? "Decision reason not captured yet",
        href: getAtlasWorkspaceDetailHref("BUYER", "approvals", approval.id) ?? undefined,
        statusLabel: approval.status,
        statusTone: approval.status === "APPROVED" ? "success" : approval.status === "PENDING" ? "warning" : "critical"
      }))
    ];
  }

  if (surfaceKey === "agents") {
    const agents = await prisma.agent.findMany({
      where: {
        organizationId: actor.organization.id
      },
      include: {
        policy: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 6
    });

    return agents.map((agent) => ({
      id: agent.id,
      title: agent.name,
      description: agent.policy?.name ?? "No policy linked yet",
      detail: agent.externalRef ?? "No external reference",
      statusLabel: agent.status,
      statusTone: agent.status === "ACTIVE" ? "success" : agent.status === "PAUSED" ? "warning" : "default"
    }));
  }

  if (surfaceKey === "policies") {
    const policies = await prisma.policy.findMany({
      where: {
        organizationId: actor.organization.id
      },
      include: {
        _count: {
          select: {
            agents: true,
            requests: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 6
    });

    return policies.map((policy) => ({
      id: policy.id,
      title: policy.name,
      description: `${policy._count.agents} linked agents · ${policy._count.requests} requests`,
      detail: `Rules payload shape is stored and ready for Phase 2 evaluation work`,
      statusLabel: policy.status,
      statusTone: policy.status === "ACTIVE" ? "success" : "default"
    }));
  }

  if (surfaceKey === "requests") {
    const requests = await prisma.spendRequest.findMany({
      where: {
        organizationId: actor.organization.id
      },
      include: {
        sellerOrganization: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 8
    });

    return requests.map((request) => ({
      id: request.id,
      title: request.title,
      description: `${formatCurrencyMinor(request.amountMinor, request.currency)} · ${request.serviceCategory}`,
      detail: request.sellerOrganization?.name ?? "No seller linked",
      href: getAtlasWorkspaceDetailHref("BUYER", "requests", request.id) ?? undefined,
      statusLabel: request.status,
      statusTone: resolveRequestStatusTone(request.status)
    }));
  }

  if (surfaceKey === "approvals") {
    const approvals = await prisma.approval.findMany({
      where: {
        request: {
          organizationId: actor.organization.id
        }
      },
      include: {
        request: true,
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
      description: approval.approver?.name ?? approval.approver?.email ?? "Awaiting assignee context",
      detail: approval.decisionReason ?? "Decision reason not captured yet",
      href: getAtlasWorkspaceDetailHref("BUYER", "approvals", approval.id) ?? undefined,
      statusLabel: approval.status,
      statusTone: approval.status === "APPROVED" ? "success" : approval.status === "PENDING" ? "warning" : "critical"
    }));
  }

  if (surfaceKey === "receipts") {
    const receipts = await listReceiptRecords(actor);

    return receipts.slice(0, 8).map((receipt) => ({
      id: receipt.id,
      title: receipt.requestTitle,
      description: `${formatCurrencyMinor(receipt.amountMinor, receipt.currency)} · ${receipt.serviceCategory}`,
      detail: `${formatAtlasPaymentReconciliationStateLabel(receipt.reconciliationState)} · ${receipt.paymentReference ?? "No payment reference"}`,
      href: getAtlasWorkspaceDetailHref("BUYER", "receipts", receipt.id) ?? undefined,
      statusLabel: receipt.status,
      statusTone: resolveReceiptStatusTone(receipt.status)
    }));
  }

  if (surfaceKey === "activity") {
    const events = await prisma.auditEvent.findMany({
      where: {
        organizationId: actor.organization.id
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
      href: getAtlasWorkspaceDetailHref("BUYER", "activity", event.id) ?? undefined,
      statusLabel: "event"
    }));
  }

  return [];
}

async function loadSellerPrimaryItems(actor: AtlasActorContext, surfaceKey: AtlasWorkspaceSurfaceKey) {
  if (surfaceKey === "overview") {
    const [recentRequests, topCustomers] = await Promise.all([
      prisma.spendRequest.findMany({
        where: {
          sellerOrganizationId: actor.organization.id
        },
        include: {
          organization: true
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 4
      }),
      prisma.organization.findMany({
        where: {
          buyerRequests: {
            some: {
              sellerOrganizationId: actor.organization.id
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
        take: 2
      })
    ]);

    return [
      ...recentRequests.map((request) => ({
        id: request.id,
        title: request.title,
        description: `${request.organization.name} · ${formatCurrencyMinor(request.amountMinor, request.currency)}`,
        detail: request.serviceCategory,
        href: getAtlasWorkspaceDetailHref("SELLER", "requests", request.id) ?? undefined,
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

  if (surfaceKey === "services") {
    const requests = await prisma.spendRequest.findMany({
      where: {
        sellerOrganizationId: actor.organization.id
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 6
    });

    return requests.map((request) => {
      const payload = typeof request.requestPayload === "object" && request.requestPayload !== null ? request.requestPayload : null;
      const serviceName =
        payload && "service" in payload && typeof payload.service === "string" ? payload.service : request.title;

      return {
        id: request.id,
        title: serviceName,
        description: request.serviceCategory,
        detail: `Last requested for ${formatCurrencyMinor(request.amountMinor, request.currency)}`,
        statusLabel: request.status,
        statusTone: resolveRequestStatusTone(request.status)
      };
    });
  }

  if (surfaceKey === "requests") {
    const requests = await prisma.spendRequest.findMany({
      where: {
        sellerOrganizationId: actor.organization.id
      },
      include: {
        organization: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 8
    });

    return requests.map((request) => ({
      id: request.id,
      title: request.title,
      description: `${request.organization.name} · ${formatCurrencyMinor(request.amountMinor, request.currency)}`,
      detail: request.serviceCategory,
      href: getAtlasWorkspaceDetailHref("SELLER", "requests", request.id) ?? undefined,
      statusLabel: request.status,
      statusTone: resolveRequestStatusTone(request.status)
    }));
  }

  if (surfaceKey === "payments") {
    const payments = await prisma.payment.findMany({
      where: {
        sellerOrganizationId: actor.organization.id
      },
      include: {
        request: {
          include: {
            receipt: true
          }
        },
        organization: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 8
    });

    return payments.map((payment) => ({
      id: payment.id,
      title: payment.request.title,
      description: `${payment.organization.name} · ${formatCurrencyMinor(payment.amountMinor, payment.currency)}`,
      detail: `${derivePaymentReconciliationLabel({
        requestStatus: payment.request.status,
        paymentStatus: payment.status,
        receiptStatus: payment.request.receipt?.status ?? null,
        sellerFulfillmentStatus: extractSellerFulfillmentStatus(payment.request.metadata)
      })} · ${payment.reference ?? "No payment reference"}`,
      href: getAtlasWorkspaceDetailHref("SELLER", "payments", payment.id) ?? undefined,
      statusLabel: payment.status,
      statusTone: resolvePaymentStatusTone(payment.status)
    }));
  }

  if (surfaceKey === "customers") {
    const organizations = await prisma.organization.findMany({
      where: {
        buyerRequests: {
          some: {
            sellerOrganizationId: actor.organization.id
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
      take: 8
    });

    return organizations.map((organization) => ({
      id: organization.id,
      title: organization.name,
      description: `${organization.kind} organization`,
      detail: `${formatCount(organization._count.buyerRequests)} related requests`,
      statusLabel: "active"
    }));
  }

  if (surfaceKey === "webhooks") {
    return listAtlasQueueDefinitionsForFamily("seller-webhooks").map((queue) => ({
      id: queue.key,
      title: queue.title,
      description: queue.description,
      detail: `${queue.name} · ${queue.nextPhase}`,
      statusLabel: queue.readiness,
      statusTone: queue.readiness === "baseline" ? "success" : "warning"
    }));
  }

  return [];
}

async function loadOperatorPrimaryItems(actor: AtlasActorContext, surfaceKey: AtlasWorkspaceSurfaceKey) {
  if (surfaceKey === "overview") {
    const [exceptionRequests, pendingApprovals, organizations] = await Promise.all([
      prisma.spendRequest.findMany({
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
      prisma.approval.findMany({
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
      prisma.organization.findMany({
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
        href: getAtlasWorkspaceDetailHref("OPERATOR", "transactions", request.id) ?? undefined,
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

  if (surfaceKey === "organizations") {
    const organizations = await prisma.organization.findMany({
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
      detail: `${formatCount(organization._count.agents)} agents · ${formatCount(organization._count.buyerRequests + organization._count.sellerRequests)} requests`,
      statusLabel: organization.kind
    }));
  }

  if (surfaceKey === "transactions") {
    const requests = await prisma.spendRequest.findMany({
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
      href: getAtlasWorkspaceDetailHref("OPERATOR", "transactions", request.id) ?? undefined,
      statusLabel: request.status,
      statusTone: resolveRequestStatusTone(request.status)
    }));
  }

  if (surfaceKey === "receipts") {
    const receipts = await listReceiptRecords(actor);

    return receipts.slice(0, 8).map((receipt) => ({
      id: receipt.id,
      title: receipt.requestTitle,
      description: `${receipt.buyerOrganizationName} → ${receipt.sellerOrganizationName ?? "No seller"}`,
      detail: `${formatAtlasPaymentReconciliationStateLabel(receipt.reconciliationState)} · ${receipt.paymentStatus ?? "No payment status"}`,
      href: getAtlasWorkspaceDetailHref("OPERATOR", "receipts", receipt.id) ?? undefined,
      statusLabel: receipt.status,
      statusTone: resolveReceiptStatusTone(receipt.status)
    }));
  }

  if (surfaceKey === "approvals") {
    const approvals = await prisma.approval.findMany({
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

  if (surfaceKey === "exceptions") {
    const failedRequests = await prisma.spendRequest.findMany({
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
      href: getAtlasWorkspaceDetailHref("OPERATOR", "transactions", request.id) ?? undefined,
      statusLabel: request.status,
      statusTone: "critical"
    }));
  }

  if (surfaceKey === "audit") {
    const events = await prisma.auditEvent.findMany({
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
      href: getAtlasWorkspaceDetailHref("OPERATOR", "audit", event.id) ?? undefined,
      statusLabel: "event"
    }));
  }

  return [];
}

function createSurfaceDescriptions(workspace: OrganizationKind, surfaceKey: AtlasWorkspaceSurfaceKey) {
  if (workspace === "BUYER") {
    return {
      primary: {
        eyebrow: "Buyer surface",
        title: surfaceKey === "overview" ? "Buyer command view" : "Buyer workspace data",
        description:
          surfaceKey === "overview"
            ? "The buyer overview now reads like a real control center: active agents, sellers, pending decisions, and seeded lifecycle pressure in one place."
            : surfaceKey === "receipts"
              ? "The buyer receipt surface now keeps durable evidence, payment posture, and receipt availability legible without collapsing the underlying lifecycle."
              : "This shell uses current seeded buyer data and the durable route structure that later buyer workflows will inherit.",
        emptyTitle: "No buyer records available",
        emptyDescription: getWorkspaceEmptyStateDescription("BUYER")
      },
      moduleAlignment: {
        eyebrow: "API module alignment",
        title: "Buyer-facing API boundaries",
        description: "The buyer workspace now maps directly to explicit API module skeletons instead of a single placeholder surface.",
        emptyTitle: "No buyer modules are registered",
        emptyDescription: "Buyer domain modules will appear here once the API registry changes."
      },
      activity: {
        eyebrow: surfaceKey === "activity" ? "Audit posture" : "Recent lifecycle",
        title: surfaceKey === "activity" ? "Buyer audit flow" : "Recent buyer activity",
        description:
          surfaceKey === "overview"
            ? "Recent activity shows the buyer-side narrative that Phase 2 will turn into deeper request, approval, and policy detail surfaces."
            : "Recent lifecycle data remains grounded in the schema and will later feed request and approval detail views.",
        emptyTitle: "No buyer activity yet",
        emptyDescription: getWorkspaceEmptyStateDescription("BUYER")
      }
    };
  }

  if (workspace === "SELLER") {
    return {
      primary: {
        eyebrow: "Seller surface",
        title: surfaceKey === "overview" ? "Seller operating view" : "Seller workspace data",
        description:
          surfaceKey === "overview"
            ? "The seller overview now highlights inbound demand, customer concentration, payment posture, and the delivery boundary Atlas is preparing."
            : "This shell keeps the seller-side route map durable while staying grounded in current seeded request and payment state.",
        emptyTitle: "No seller records available",
        emptyDescription: getWorkspaceEmptyStateDescription("SELLER")
      },
      moduleAlignment: {
        eyebrow: "API module alignment",
        title: "Seller-facing API boundaries",
        description: "The seller workspace now points at explicit service, request, payment, and receipt module boundaries.",
        emptyTitle: "No seller modules are registered",
        emptyDescription: "Seller domain modules will appear here once the API registry changes."
      },
      activity: {
        eyebrow: surfaceKey === "payments" ? "Settlement posture" : "Recent lifecycle",
        title: surfaceKey === "payments" ? "Seller-side lifecycle evidence" : "Recent seller activity",
        description:
          surfaceKey === "overview"
            ? "Seller activity keeps the demo grounded in buyer demand, payment state, and the future webhook-driven delivery model."
            : "The seller shell now exposes durable surfaces for future fulfillment, payout, and webhook behavior.",
        emptyTitle: "No seller activity yet",
        emptyDescription: getWorkspaceEmptyStateDescription("SELLER")
      }
    };
  }

  return {
    primary: {
      eyebrow: "Operator surface",
      title: surfaceKey === "overview" ? "Operator trust center" : "Operator workspace data",
      description:
        surfaceKey === "overview"
          ? "The operator overview now reads like a true trust surface: organizations, pending decisions, failures, and queue-backed system posture."
          : "This shell keeps oversight routes durable while using current organization, request, approval, and audit records.",
      emptyTitle: "No operator records available",
      emptyDescription: getWorkspaceEmptyStateDescription("OPERATOR")
    },
    moduleAlignment: {
      eyebrow: "API module alignment",
      title: "Operator-facing API boundaries",
      description: "The operator workspace now maps directly to organizations, approvals, audit, and operator-control modules.",
      emptyTitle: "No operator modules are registered",
      emptyDescription: "Operator module registrations will appear here once the API registry changes."
    },
    activity: {
      eyebrow: surfaceKey === "exceptions" ? "Exception posture" : "Recent lifecycle",
      title: surfaceKey === "audit" ? "Audit-heavy activity" : "Recent operator activity",
        description:
          surfaceKey === "overview"
            ? "Operator activity keeps the demo grounded in real failures, pending decisions, and cross-entity oversight."
          : surfaceKey === "receipts"
            ? "The operator receipt surface keeps payment evidence and receipt availability visible across organizations for later investigation flows."
            : "The operator shell is now anchored to real route boundaries for later exception handling and audit exploration.",
      emptyTitle: "No operator activity yet",
      emptyDescription: getWorkspaceEmptyStateDescription("OPERATOR")
    }
  };
}

export async function loadWorkspaceSurfaceModel(
  actor: AtlasActorContext,
  surfaceKey: AtlasWorkspaceSurfaceKey
): Promise<WorkspaceSurfaceModel> {
  const surface = getAtlasWorkspaceSurfaceByKey(actor.workspace, surfaceKey);

  if (!surface) {
    throw new Error(`Unknown workspace surface ${surfaceKey} for ${actor.workspace}`);
  }

  const [overview, moduleAlignmentItems, primaryItems] = await Promise.all([
    loadWorkspaceOverviewModel(actor),
    Promise.resolve(createModuleAlignmentItems(actor.workspace)),
    actor.workspace === "BUYER"
      ? loadBuyerPrimaryItems(actor, surfaceKey)
      : actor.workspace === "SELLER"
        ? loadSellerPrimaryItems(actor, surfaceKey)
        : loadOperatorPrimaryItems(actor, surfaceKey)
  ]);

  const descriptions = createSurfaceDescriptions(actor.workspace, surfaceKey);
  const activityItems = surfaceKey === "overview" ? overview.activity : primaryItems;
  await auditWorkspaceSurfaceInspection(actor, {
    surfaceKey,
    primaryItemCount: primaryItems.length,
    activityItemCount: activityItems.length
  });

  return {
    surfaceKey,
    overview,
    primary: {
      ...descriptions.primary,
      items: primaryItems
    },
    moduleAlignment: {
      ...descriptions.moduleAlignment,
      items: moduleAlignmentItems
    },
    activity: {
      ...descriptions.activity,
      items: activityItems
    }
  };
}
