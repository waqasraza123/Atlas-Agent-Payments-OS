import type { AtlasActorContext } from "@atlas/auth";
import { describe, expect, it, vi } from "vitest";
import {
  getWorkspaceOverviewForActor,
  listWorkspaceSurfacePrimaryItemsForActor
} from "./workspace-reads";

function createBuyerActor(overrides: Partial<AtlasActorContext> = {}): AtlasActorContext {
  return {
    user: {
      id: "user-buyer-1",
      email: "buyer-admin@atlas.local",
      name: "Buyer Admin"
    },
    organization: {
      id: "org-buyer-1",
      slug: "buyer-org",
      name: "Buyer Org",
      kind: "BUYER"
    },
    membership: {
      id: "membership-buyer-1",
      role: "ADMIN"
    },
    workspace: "BUYER",
    agentId: null,
    source: "internal-support",
    providerMode: "external-oidc",
    sessionId: "session-1",
    principalOrganization: {
      id: "org-operator-1",
      slug: "operator-org",
      name: "Operator Org",
      kind: "OPERATOR"
    },
    supportAccess: {
      grantId: "grant-1",
      mode: "read-only",
      reason: "Inspect buyer tenant records.",
      grantedByUserEmail: "operator-admin@atlas.local",
      targetOrganizationSlug: "buyer-org",
      targetWorkspace: "BUYER"
    },
    ...overrides
  };
}

function createSellerActor(overrides: Partial<AtlasActorContext> = {}): AtlasActorContext {
  return {
    user: {
      id: "user-seller-1",
      email: "seller-admin@atlas.local",
      name: "Seller Admin"
    },
    organization: {
      id: "org-seller-1",
      slug: "seller-org",
      name: "Seller Org",
      kind: "SELLER"
    },
    membership: {
      id: "membership-seller-1",
      role: "ADMIN"
    },
    workspace: "SELLER",
    agentId: null,
    source: "internal-support",
    providerMode: "external-oidc",
    sessionId: "session-1",
    principalOrganization: {
      id: "org-operator-1",
      slug: "operator-org",
      name: "Operator Org",
      kind: "OPERATOR"
    },
    supportAccess: {
      grantId: "grant-1",
      mode: "read-only",
      reason: "Inspect seller tenant records.",
      grantedByUserEmail: "operator-admin@atlas.local",
      targetOrganizationSlug: "seller-org",
      targetWorkspace: "SELLER"
    },
    ...overrides
  };
}

describe("workspace reads", () => {
  it("audits support-session buyer overview reads", async () => {
    const actor = createBuyerActor();
    const client = {
      agent: {
        count: vi.fn(async () => 3)
      },
      policy: {
        count: vi.fn(async () => 5)
      },
      spendRequest: {
        count: vi.fn(async () => 7),
        findMany: vi.fn(async () => [
          {
            id: "request-1",
            title: "Premium dataset unlock",
            purpose: "Unlock premium data",
            amountMinor: 2400,
            currency: "USD",
            serviceCategory: "api-access",
            serviceKey: "dataset-access",
            status: "APPROVED",
            createdAt: new Date("2026-04-17T00:00:00.000Z"),
            agent: {
              id: "agent-1",
              name: "Buyer Agent"
            },
            policy: {
              id: "policy-1",
              name: "Default Policy"
            },
            sellerOrganization: {
              id: "org-seller-1",
              name: "Seller Org"
            },
            approval: {
              status: "APPROVED"
            }
          }
        ])
      },
      approval: {
        count: vi.fn(async () => 2)
      },
      payment: {
        aggregate: vi.fn(async () => ({
          _sum: {
            amountMinor: 8800
          }
        }))
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;

    const overview = await getWorkspaceOverviewForActor(actor, client as never);

    expect(overview.metrics).toHaveLength(6);
    expect(overview.activity).toMatchObject([
      {
        id: "request-1",
        detailSurfaceKey: "requests"
      }
    ]);
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "support_access.buyer_overview_inspected",
        targetType: "buyer_overview_scope",
        targetId: actor.organization.id,
        payload: expect.objectContaining({
          metricCount: 6,
          activityCount: 1,
          principalOrganizationId: "org-operator-1",
          supportAccessGrantId: "grant-1"
        })
      })
    });
  });

  it("audits support-session buyer workspace surfaces", async () => {
    const actor = createBuyerActor();
    const client = {
      policy: {
        findMany: vi.fn(async () => [
          {
            id: "policy-1",
            name: "Default Policy",
            status: "ACTIVE",
            version: 1,
            rules: {},
            _count: {
              agents: 2,
              requests: 4
            }
          }
        ])
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;

    const items = await listWorkspaceSurfacePrimaryItemsForActor(actor, "policies", client as never);

    expect(items).toMatchObject([
      {
        id: "policy-1",
        statusLabel: "ACTIVE"
      }
    ]);
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "support_access.buyer_surface_inspected",
        targetType: "buyer_workspace_surface",
        targetId: `${actor.organization.id}:policies`,
        payload: expect.objectContaining({
          surfaceKey: "policies",
          resultCount: 1,
          principalOrganizationId: "org-operator-1",
          supportAccessGrantId: "grant-1"
        })
      })
    });
  });

  it("audits support-session seller overview reads", async () => {
    const actor = createSellerActor();
    const client = {
      spendRequest: {
        count: vi.fn(async () => 4),
        findMany: vi.fn(async () => [
          {
            id: "request-1",
            organizationId: "org-buyer-1",
            title: "Buyer request",
            purpose: "Need service access",
            amountMinor: 3200,
            currency: "USD",
            serviceCategory: "api-access",
            serviceKey: "service-key",
            status: "APPROVED",
            requestPayload: {},
            metadata: null,
            createdAt: new Date("2026-04-17T00:00:00.000Z"),
            updatedAt: new Date("2026-04-17T00:05:00.000Z"),
            organization: {
              id: "org-buyer-1",
              name: "Buyer Org"
            }
          }
        ])
      },
      payment: {
        count: vi.fn(async () => 2)
      },
      organization: {
        count: vi.fn(async () => 1)
      },
      service: {
        findMany: vi.fn(async () => [])
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;

    const overview = await getWorkspaceOverviewForActor(actor, client as never);

    expect(overview.metrics).toHaveLength(6);
    expect(overview.activity).toMatchObject([
      {
        id: "request-1",
        detailSurfaceKey: "requests"
      }
    ]);
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "support_access.seller_overview_inspected",
        targetType: "seller_overview_scope",
        targetId: actor.organization.id,
        payload: expect.objectContaining({
          metricCount: 6,
          activityCount: 1,
          principalOrganizationId: "org-operator-1",
          supportAccessGrantId: "grant-1"
        })
      })
    });
  });

  it("audits support-session seller workspace surfaces", async () => {
    const actor = createSellerActor();
    const client = {
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;

    const items = await listWorkspaceSurfacePrimaryItemsForActor(actor, "webhooks", client as never);

    expect(items.length).toBeGreaterThan(0);
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "support_access.seller_surface_inspected",
        targetType: "seller_workspace_surface",
        targetId: `${actor.organization.id}:webhooks`,
        payload: expect.objectContaining({
          surfaceKey: "webhooks",
          resultCount: items.length,
          principalOrganizationId: "org-operator-1",
          supportAccessGrantId: "grant-1"
        })
      })
    });
  });
});
