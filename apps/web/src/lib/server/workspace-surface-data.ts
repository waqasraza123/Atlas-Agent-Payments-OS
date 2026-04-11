import {
  getAtlasWorkspaceSurfaceByKey,
  listAtlasApiDomainDefinitionsForWorkspace,
  type AtlasWorkspaceSurfaceKey
} from "@atlas/domain";
import { prisma } from "@atlas/database";
import type { AtlasActorContext } from "@atlas/auth";
import type { OrganizationKind, PaymentStatus, SpendRequestStatus } from "@atlas/types";
import type { RecordListPanelItem } from "@atlas/ui";
import { getWorkspaceEmptyStateDescription, loadWorkspaceOverviewModel, type WorkspaceOverviewModel } from "./workspace-data";

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
      statusLabel: approval.status,
      statusTone: approval.status === "APPROVED" ? "success" : approval.status === "PENDING" ? "warning" : "critical"
    }));
  }

  if (surfaceKey === "activity" || surfaceKey === "overview") {
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
      statusLabel: "event"
    }));
  }

  return [];
}

async function loadSellerPrimaryItems(actor: AtlasActorContext, surfaceKey: AtlasWorkspaceSurfaceKey) {
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

  if (surfaceKey === "requests" || surfaceKey === "overview") {
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
        request: true,
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
      detail: payment.reference ?? "No payment reference",
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
    return [];
  }

  return [];
}

async function loadOperatorPrimaryItems(actor: AtlasActorContext, surfaceKey: AtlasWorkspaceSurfaceKey) {
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
        payment: true
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
      detail: request.payment?.status ?? request.status,
      statusLabel: request.status,
      statusTone: resolveRequestStatusTone(request.status)
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
      statusLabel: request.status,
      statusTone: "critical"
    }));
  }

  if (surfaceKey === "audit" || surfaceKey === "overview") {
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
        title: "Buyer workspace data",
        description: "This shell uses current seeded buyer data and the durable route structure that later buyer workflows will inherit.",
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
        description: "Recent lifecycle data remains grounded in the schema and will later feed request and approval detail views.",
        emptyTitle: "No buyer activity yet",
        emptyDescription: getWorkspaceEmptyStateDescription("BUYER")
      }
    };
  }

  if (workspace === "SELLER") {
    return {
      primary: {
        eyebrow: "Seller surface",
        title: "Seller workspace data",
        description: "This shell keeps the seller-side route map durable while staying grounded in current seeded request and payment state.",
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
        description: "The seller shell now exposes durable surfaces for future fulfillment, payout, and webhook behavior.",
        emptyTitle: "No seller activity yet",
        emptyDescription: getWorkspaceEmptyStateDescription("SELLER")
      }
    };
  }

  return {
    primary: {
      eyebrow: "Operator surface",
      title: "Operator workspace data",
      description: "This shell keeps oversight routes durable while using current organization, request, approval, and audit records.",
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
      description: "The operator shell is now anchored to real route boundaries for later exception handling and audit exploration.",
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
