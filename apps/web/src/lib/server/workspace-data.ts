import { prisma } from "@atlas/database";
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
    const [agents, policies, requests, pendingApprovals, recentRequests] = await Promise.all([
      prisma.agent.count({
        where: {
          organizationId: actor.organization.id
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
      })
    ]);

    return {
      metrics: [
        {
          label: "Agents",
          value: formatCount(agents),
          detail: "Buyer-linked actors currently bound to this workspace."
        },
        {
          label: "Policies",
          value: formatCount(policies),
          detail: "Policy records available to govern request decisions."
        },
        {
          label: "Requests",
          value: formatCount(requests),
          detail: "Seeded spend requests mapped to the buyer organization."
        },
        {
          label: "Pending approvals",
          value: formatCount(pendingApprovals),
          detail: "Requests that still require a human decision."
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
    const [inboundRequests, capturedPayments, recentBuyers, recentSellerRequests] = await Promise.all([
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
          detail: "Payments already settled toward seller-side delivery."
        },
        {
          label: "Buyer organizations",
          value: formatCount(recentBuyers),
          detail: "Distinct buyer organizations present in current seeded data."
        },
        {
          label: "Workspace role",
          value: actor.membership.role,
          detail: "The active seller-side role used for local development."
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

  const [organizations, pendingApprovals, failedRequests, recentAuditEvents] = await Promise.all([
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
        label: "Workspace role",
        value: actor.membership.role,
        detail: "The active operator-side role used for local development."
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
