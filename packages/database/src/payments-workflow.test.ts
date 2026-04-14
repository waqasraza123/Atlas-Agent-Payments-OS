import type { AtlasActorContext } from "@atlas/auth";
import { describe, expect, it, vi } from "vitest";
import { getPaymentIntent, getReceiptRecord, listPaymentIntents } from "./payments-workflow";

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

function createSupportActor(workspace: Extract<AtlasActorContext["workspace"], "BUYER" | "SELLER">): AtlasActorContext {
  const actor = createActor(workspace);

  return {
    ...actor,
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
      reason: "Investigate tenant payment and receipt posture.",
      grantedByUserEmail: "operator-admin@atlas.local",
      targetOrganizationSlug: actor.organization.slug,
      targetWorkspace: workspace
    }
  };
}

function createPaymentRow() {
  return {
    id: "payment-1",
    organizationId: "org-buyer-1",
    sellerOrganizationId: "org-seller-1",
    requestId: "request-1",
    rail: "INTERNAL_SIMULATED",
    provider: "atlas-internal",
    reference: "ref-1",
    status: "CAPTURED",
    amountMinor: 1200,
    currency: "USD",
    createdAt: new Date("2026-04-14T00:00:00.000Z"),
    updatedAt: new Date("2026-04-14T00:05:00.000Z"),
    request: {
      status: "COMPLETED",
      metadata: null,
      receipt: {
        status: "AVAILABLE"
      }
    },
    organization: {
      id: "org-buyer-1",
      name: "Buyer Org"
    },
    sellerOrganization: {
      id: "org-seller-1",
      name: "Seller Org"
    },
    attempts: [
      {
        id: "attempt-1",
        paymentId: "payment-1",
        attemptNumber: 1,
        rail: "INTERNAL_SIMULATED",
        status: "CAPTURED",
        reference: "ref-1",
        evidence: null,
        errorCode: null,
        errorMessage: null,
        createdAt: new Date("2026-04-14T00:00:00.000Z")
      }
    ]
  };
}

function createReceiptRow() {
  return {
    id: "receipt-1",
    requestId: "request-1",
    organizationId: "org-buyer-1",
    status: "AVAILABLE",
    storageKey: "receipts/receipt-1.json",
    contentType: "application/json",
    metadata: null,
    createdAt: new Date("2026-04-14T00:10:00.000Z"),
    updatedAt: new Date("2026-04-14T00:11:00.000Z"),
    organization: {
      id: "org-buyer-1",
      name: "Buyer Org"
    },
    request: {
      id: "request-1",
      title: "Receipt request",
      status: "COMPLETED",
      serviceCategory: "MODEL_API",
      amountMinor: 1200,
      currency: "USD",
      metadata: null,
      sellerOrganizationId: "org-seller-1",
      sellerOrganization: {
        id: "org-seller-1",
        name: "Seller Org"
      },
      payment: {
        status: "CAPTURED",
        rail: "INTERNAL_SIMULATED",
        reference: "ref-1",
        amountMinor: 1200,
        currency: "USD",
        metadata: null,
        attempts: [
          {
            evidence: null
          }
        ]
      }
    }
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

  it("audits support-session payment list inspection at the shared workflow layer", async () => {
    const actor = createSupportActor("BUYER");
    const client = {
      payment: {
        findMany: vi.fn(async () => [])
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;

    await listPaymentIntents(actor, client as never);

    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: actor.organization.id,
        eventType: "support_access.payment_records_inspected",
        targetType: "tenant_payment_scope",
        targetId: actor.organization.id,
        payload: expect.objectContaining({
          recordCount: 0,
          paymentIds: [],
          principalOrganizationId: "org-operator-1",
          supportAccessGrantId: "grant-1"
        })
      })
    });
  });

  it("audits support-session payment detail inspection at the shared workflow layer", async () => {
    const actor = createSupportActor("BUYER");
    const client = {
      payment: {
        findFirst: vi.fn(async () => createPaymentRow())
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;

    const record = await getPaymentIntent(actor, "payment-1", client as never);

    expect(record?.id).toBe("payment-1");
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "support_access.payment_record_inspected",
        targetType: "tenant_payment_record",
        targetId: "payment-1",
        payload: expect.objectContaining({
          requestId: "request-1",
          rail: "INTERNAL_SIMULATED",
          status: "CAPTURED",
          principalOrganizationId: "org-operator-1",
          supportAccessGrantId: "grant-1"
        })
      })
    });
  });

  it("audits support-session receipt detail inspection at the shared workflow layer", async () => {
    const actor = createSupportActor("BUYER");
    const client = {
      receipt: {
        findFirst: vi.fn(async () => createReceiptRow())
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;

    const record = await getReceiptRecord(actor, "receipt-1", client as never);

    expect(record?.id).toBe("receipt-1");
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "support_access.receipt_record_inspected",
        targetType: "tenant_receipt_record",
        targetId: "receipt-1",
        payload: expect.objectContaining({
          requestId: "request-1",
          status: "AVAILABLE",
          principalOrganizationId: "org-operator-1",
          supportAccessGrantId: "grant-1"
        })
      })
    });
  });
});
