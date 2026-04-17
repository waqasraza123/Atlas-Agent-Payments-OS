import type { AtlasActorContext } from "@atlas/auth";
import { describe, expect, it, vi } from "vitest";
import {
  getSellerAnalyticsForActor,
  getSellerProfileForActor,
  getSellerRequestForActor,
  getSellerServiceForActor,
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

  it("audits support-session seller service detail inspection", async () => {
    const actor = createSupportSellerActor();
    const client = {
      service: {
        findFirst: vi.fn(async () => ({
          id: "service-1",
          organizationId: actor.organization.id,
          key: "service-key",
          name: "Service 1",
          description: "Description",
          category: "api-access",
          status: "PUBLISHED",
          visibility: "PRIVATE",
          pricingModel: "FIXED",
          priceMinor: 2400,
          currency: "USD"
        }))
      },
      spendRequest: {
        count: vi.fn(async () => 3)
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;

    const item = await getSellerServiceForActor(actor, "service-1", client as never);

    expect(item).toMatchObject({
      id: "service-1",
      linkedRequestCount: 3
    });
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "support_access.seller_service_inspected",
        targetType: "seller_service",
        targetId: "service-1",
        payload: expect.objectContaining({
          status: "PUBLISHED",
          linkedRequestCount: 3,
          principalOrganizationId: "org-operator-1",
          supportAccessGrantId: "grant-1"
        })
      })
    });
  });

  it("audits support-session seller request detail inspection", async () => {
    const actor = createSupportSellerActor();
    const client = {
      service: {
        findMany: vi.fn(async () => [
          {
            id: "service-1",
            key: "service-key",
            name: "Service 1"
          }
        ])
      },
      spendRequest: {
        findFirst: vi.fn(async () => ({
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
        }))
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;

    const item = await getSellerRequestForActor(actor, "request-1", client as never);

    expect(item).toMatchObject({
      id: "request-1",
      buyerOrganizationId: "org-buyer-1",
      matchedServiceId: "service-1",
      status: "APPROVED"
    });
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "support_access.seller_request_inspected",
        targetType: "seller_request",
        targetId: "request-1",
        payload: expect.objectContaining({
          status: "APPROVED",
          buyerOrganizationId: "org-buyer-1",
          matchedServiceId: "service-1",
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
