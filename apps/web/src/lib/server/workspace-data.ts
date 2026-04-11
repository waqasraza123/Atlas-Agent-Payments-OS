import { prisma } from "@atlas/database";
import { listAtlasQueueDefinitions } from "@atlas/domain";
import type { AtlasActorContext } from "@atlas/auth";
import type { OrganizationKind } from "@atlas/types";
import type { AuditEvent, SpendRequest } from "@atlas/database";

export type WorkspaceMetric = {
  label: string;
  value: string;
  detail: string;
};

export type WorkspaceActivityItem = {
  id: string;
  title: string;
  description: string;
  detail: string;
};

export type WorkspaceOverviewModel = {
  metrics: WorkspaceMetric[];
  activity: WorkspaceActivityItem[];
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

export async function loadWorkspaceOverviewModel(
  actor: AtlasActorContext
): Promise<WorkspaceOverviewModel> {
  if (actor.workspace === "BUYER") {
    const [activeAgents, policies, requests, pendingApprovals, capturedPayments, recentRequests, failedRequests] =
      await Promise.all([
      prisma.agent.count({
        where: {
          organizationId: actor.organization.id,
          status: "ACTIVE"
        }
      }),
      prisma.policy.count({
        where: {
          organizationId: actor.organization.id
        }
      }),
      prisma.spendRequest.count({
        where: {
          organizationId: actor.organization.id
        }
      }),
      prisma.approval.count({
        where: {
          request: {
            organizationId: actor.organization.id
          },
          status: "PENDING"
        }
      }),
      prisma.payment.aggregate({
        where: {
          organizationId: actor.organization.id,
          status: "CAPTURED"
        },
        _sum: {
          amountMinor: true
        }
      }),
      prisma.spendRequest.findMany({
        where: {
          organizationId: actor.organization.id
        },
        include: {
          sellerOrganization: true
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 3
      }),
      prisma.spendRequest.count({
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
      activity: recentRequests.map((request: SpendRequest & { sellerOrganization: { name: string } | null }) => ({
        id: request.id,
        title: request.title,
        description: `${request.status} · ${formatCurrencyMinor(request.amountMinor, request.currency)}`,
        detail: request.sellerOrganization?.name ?? "No seller linked"
      }))
    };
  }

  if (actor.workspace === "SELLER") {
    const [inboundRequests, capturedPayments, recentBuyers, recentSellerRequests, pendingAuthorizations, failedDeliveries] =
      await Promise.all([
      prisma.spendRequest.count({
        where: {
          sellerOrganizationId: actor.organization.id
        }
      }),
      prisma.payment.count({
        where: {
          sellerOrganizationId: actor.organization.id,
          status: "CAPTURED"
        }
      }),
      prisma.organization.count({
        where: {
          buyerRequests: {
            some: {
              sellerOrganizationId: actor.organization.id
            }
          }
        }
      }),
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
        take: 3
      }),
      prisma.payment.count({
        where: {
          sellerOrganizationId: actor.organization.id,
          status: "AUTHORIZED"
        }
      }),
      prisma.spendRequest.count({
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
      activity: recentSellerRequests.map((request: SpendRequest & { organization: { name: string } }) => ({
        id: request.id,
        title: request.title,
        description: `${request.status} · ${formatCurrencyMinor(request.amountMinor, request.currency)}`,
        detail: request.organization.name
      }))
    };
  }

  const queueFamilies = new Set(listAtlasQueueDefinitions().map((definition) => definition.family)).size;
  const [organizations, pendingApprovals, failedRequests, recentAuditEvents, completedPayments] = await Promise.all([
    prisma.organization.count(),
    prisma.approval.count({
      where: {
        status: "PENDING"
      }
    }),
    prisma.spendRequest.count({
      where: {
        status: "FAILED"
      }
    }),
    prisma.auditEvent.findMany({
      orderBy: {
        occurredAt: "desc"
      },
      take: 4
    }),
    prisma.payment.count({
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
    activity: recentAuditEvents.map((event: AuditEvent) => ({
      id: event.id,
      title: event.eventType,
      description: `${event.targetType} · ${event.targetId}`,
      detail: event.actorType
    }))
  };
}

export function getWorkspaceEmptyStateDescription(workspace: OrganizationKind) {
  if (workspace === "BUYER") {
    return "Seed buyer data will appear here once local seed data is available.";
  }

  if (workspace === "SELLER") {
    return "Seller-side inbound activity will appear here once seeded requests target this org.";
  }

  return "Operator-facing audit and exception signals will appear here once seeded lifecycle events exist.";
}
