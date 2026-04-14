import type { AtlasActorContext } from "@atlas/auth";
import { describe, expect, it, vi } from "vitest";
import {
  listBuyerAgentsForActor,
  listBuyerApprovalsForActor,
  listBuyerPoliciesForActor,
  listBuyerRequestsForActor
} from "./buyer-workflow";

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
    source: "identity-provider",
    providerMode: "external-oidc",
    sessionId: "session-1",
    principalOrganization: null,
    supportAccess: null,
    ...overrides
  };
}

function createSupportBuyerActor() {
  return createBuyerActor({
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
      reason: "Inspect buyer tenant records.",
      grantedByUserEmail: "operator-admin@atlas.local",
      targetOrganizationSlug: "buyer-org",
      targetWorkspace: "BUYER"
    }
  });
}

describe("buyer workflow actor-aware reads", () => {
  it("audits support-session buyer request inspection", async () => {
    const actor = createSupportBuyerActor();
    const client = {
      spendRequest: {
        findMany: vi.fn(async () => [])
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;

    const items = await listBuyerRequestsForActor(actor, client as never);

    expect(items).toEqual([]);
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "support_access.buyer_requests_inspected",
        targetType: "buyer_request_scope",
        targetId: actor.organization.id,
        payload: expect.objectContaining({
          resultCount: 0,
          requestIds: [],
          principalOrganizationId: "org-operator-1",
          supportAccessGrantId: "grant-1"
        })
      })
    });
  });

  it("does not audit standard buyer reads", async () => {
    const actor = createBuyerActor();
    const client = {
      agent: {
        findMany: vi.fn(async () => [])
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;

    await listBuyerAgentsForActor(actor, client as never);

    expect(client.auditEvent.create).not.toHaveBeenCalled();
  });

  it("rejects non-buyer actors from buyer read wrappers", async () => {
    const actor = createBuyerActor({
      workspace: "SELLER",
      organization: {
        id: "org-seller-1",
        slug: "seller-org",
        name: "Seller Org",
        kind: "SELLER"
      }
    });

    await expect(listBuyerPoliciesForActor(actor)).rejects.toThrow(/buyer-scoped actor context/i);
    await expect(listBuyerApprovalsForActor(actor)).rejects.toThrow(/buyer-scoped actor context/i);
  });
});
