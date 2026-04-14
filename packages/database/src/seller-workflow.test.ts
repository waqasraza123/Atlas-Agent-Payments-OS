import type { AtlasActorContext } from "@atlas/auth";
import { describe, expect, it, vi } from "vitest";
import {
  getSellerAnalyticsForActor,
  getSellerProfileForActor,
  listSellerRequestsForActor,
  listSellerServicesForActor,
  listSellerTeamMembersForActor
} from "./seller-workflow";

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
    source: "identity-provider",
    providerMode: "external-oidc",
    sessionId: "session-1",
    principalOrganization: null,
    supportAccess: null,
    ...overrides
  };
}

function createSupportSellerActor() {
  return createSellerActor({
    source: "internal-support",
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
    }
  });
}

describe("seller workflow actor-aware reads", () => {
  it("audits support-session seller service inspection", async () => {
    const actor = createSupportSellerActor();
    const client = {
      service: {
        findMany: vi.fn(async () => [])
      },
      spendRequest: {
        findMany: vi.fn(async () => [])
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;

    const items = await listSellerServicesForActor(actor, client as never);

    expect(items).toEqual([]);
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "support_access.seller_services_inspected",
        targetType: "seller_service_scope",
        targetId: actor.organization.id,
        payload: expect.objectContaining({
          resultCount: 0,
          serviceIds: [],
          principalOrganizationId: "org-operator-1",
          supportAccessGrantId: "grant-1"
        })
      })
    });
  });

  it("audits support-session seller profile inspection", async () => {
    const actor = createSupportSellerActor();
    const client = {
      organization: {
        findFirst: vi.fn(async () => ({
          id: actor.organization.id,
          slug: actor.organization.slug,
          name: actor.organization.name,
          kind: "SELLER"
        }))
      },
      service: {
        count: vi.fn(async () => 0)
      },
      spendRequest: {
        count: vi.fn(async () => 0),
        findMany: vi.fn(async () => [])
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;

    const item = await getSellerProfileForActor(actor, client as never);

    expect(item.organizationId).toBe(actor.organization.id);
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "support_access.seller_profile_inspected",
        targetType: "seller_profile_scope",
        targetId: actor.organization.id,
        payload: expect.objectContaining({
          serviceCount: 0,
          requestCount: 0,
          principalOrganizationId: "org-operator-1",
          supportAccessGrantId: "grant-1"
        })
      })
    });
  });

  it("audits support-session seller analytics inspection", async () => {
    const actor = createSupportSellerActor();
    const client = {
      service: {
        findMany: vi.fn(async () => [])
      },
      spendRequest: {
        findMany: vi.fn(async () => [])
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;

    const item = await getSellerAnalyticsForActor(actor, client as never);

    expect(item).toMatchObject({
      pendingFulfillmentCount: 0,
      completedRequestCount: 0,
      failedRequestCount: 0,
      unmatchedRequestCount: 0
    });
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "support_access.seller_analytics_inspected",
        targetType: "seller_analytics_scope",
        targetId: actor.organization.id,
        payload: expect.objectContaining({
          pendingFulfillmentCount: 0,
          completedRequestCount: 0,
          failedRequestCount: 0,
          unmatchedRequestCount: 0,
          principalOrganizationId: "org-operator-1",
          supportAccessGrantId: "grant-1"
        })
      })
    });
  });

  it("does not audit standard seller reads", async () => {
    const actor = createSellerActor();
    const client = {
      membership: {
        findMany: vi.fn(async () => [])
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;

    await listSellerTeamMembersForActor(actor, client as never);

    expect(client.auditEvent.create).not.toHaveBeenCalled();
  });

  it("rejects non-seller actors from seller read wrappers", async () => {
    const actor = createSellerActor({
      workspace: "BUYER",
      organization: {
        id: "org-buyer-1",
        slug: "buyer-org",
        name: "Buyer Org",
        kind: "BUYER"
      }
    });

    await expect(listSellerRequestsForActor(actor)).rejects.toThrow(/seller-scoped actor context/i);
  });
});
