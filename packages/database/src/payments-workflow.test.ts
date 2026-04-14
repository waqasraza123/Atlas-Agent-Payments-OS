import type { AtlasActorContext } from "@atlas/auth";
import { describe, expect, it, vi } from "vitest";
import { getPaymentIntent, getReceiptRecord } from "./payments-workflow";

function createActor(workspace: AtlasActorContext["workspace"]): AtlasActorContext {
  return {
    user: {
      id: "user-1",
      email: "user@atlas.local",
      name: "Atlas User"
    },
    organization: {
      id: `org-${workspace.toLowerCase()}-1`,
      slug: `${workspace.toLowerCase()}-org`,
      name: `${workspace} Org`,
      kind: workspace
    },
    membership: {
      id: "membership-1",
      role: workspace === "OPERATOR" ? "OPERATOR" : "ADMIN"
    },
    workspace,
    agentId: null,
    source: "identity-provider",
    providerMode: "external-oidc",
    sessionId: "session-1",
    principalOrganization: null,
    supportAccess: null
  };
}

describe("payments workflow", () => {
  it("scopes buyer payment detail reads by buyer organization", async () => {
    const actor = createActor("BUYER");
    const client = {
      payment: {
        findFirst: vi.fn(async () => null)
      }
    } as const;

    const result = await getPaymentIntent(actor, "payment-1", client as never);

    expect(result).toBeNull();
    expect(client.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ id: "payment-1" }, { requestId: "payment-1" }],
          organizationId: actor.organization.id
        }
      })
    );
  });

  it("scopes seller payment detail reads by seller organization", async () => {
    const actor = createActor("SELLER");
    const client = {
      payment: {
        findFirst: vi.fn(async () => null)
      }
    } as const;

    await getPaymentIntent(actor, "request-1", client as never);

    expect(client.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ id: "request-1" }, { requestId: "request-1" }],
          sellerOrganizationId: actor.organization.id
        }
      })
    );
  });

  it("scopes seller receipt detail reads through the linked seller request", async () => {
    const actor = createActor("SELLER");
    const client = {
      receipt: {
        findFirst: vi.fn(async () => null)
      }
    } as const;

    const result = await getReceiptRecord(actor, "receipt-1", client as never);

    expect(result).toBeNull();
    expect(client.receipt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ id: "receipt-1" }, { requestId: "receipt-1" }],
          request: {
            is: {
              sellerOrganizationId: actor.organization.id
            }
          }
        }
      })
    );
  });

  it("leaves operator receipt detail reads unscoped by tenant", async () => {
    const actor = createActor("OPERATOR");
    const client = {
      receipt: {
        findFirst: vi.fn(async () => null)
      }
    } as const;

    await getReceiptRecord(actor, "request-1", client as never);

    expect(client.receipt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ id: "request-1" }, { requestId: "request-1" }]
        }
      })
    );
  });
});
