import { describe, expect, it } from "vitest";
import type { AtlasActorContext } from "@atlas/auth";
import {
  createApprovalDetailWhere,
  createAuditDetailWhere,
  createPaymentDetailWhere,
  createReceiptDetailWhere,
  createRequestDetailWhere
} from "./workspace-record-scope";

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

describe("workspace record scope", () => {
  it("scopes buyer request detail reads by buyer organization", () => {
    expect(createRequestDetailWhere(createActor("BUYER"), "request-1")).toEqual({
      id: "request-1",
      organizationId: "org-buyer-1"
    });
  });

  it("scopes seller approval detail reads by seller organization through the linked request", () => {
    expect(createApprovalDetailWhere(createActor("SELLER"), "request-1")).toEqual({
      OR: [
        {
          id: "request-1"
        },
        {
          requestId: "request-1"
        }
      ],
      request: {
        sellerOrganizationId: "org-seller-1"
      }
    });
  });

  it("scopes seller payment and receipt detail reads by seller organization", () => {
    expect(createPaymentDetailWhere(createActor("SELLER"), "payment-1")).toEqual({
      OR: [
        {
          id: "payment-1"
        },
        {
          requestId: "payment-1"
        }
      ],
      sellerOrganizationId: "org-seller-1"
    });

    expect(createReceiptDetailWhere(createActor("SELLER"), "receipt-1")).toEqual({
      OR: [
        {
          id: "receipt-1"
        },
        {
          requestId: "receipt-1"
        }
      ],
      request: {
        is: {
          sellerOrganizationId: "org-seller-1"
        }
      }
    });
  });

  it("scopes buyer audit detail reads to buyer-owned records or linked requests", () => {
    expect(createAuditDetailWhere(createActor("BUYER"), "event-1")).toEqual({
      id: "event-1",
      OR: [
        {
          organizationId: "org-buyer-1"
        },
        {
          request: {
            is: {
              organizationId: "org-buyer-1"
            }
          }
        }
      ]
    });
  });

  it("leaves operator detail reads unscoped at the tenant layer", () => {
    expect(createPaymentDetailWhere(createActor("OPERATOR"), "payment-1")).toEqual({
      OR: [
        {
          id: "payment-1"
        },
        {
          requestId: "payment-1"
        }
      ]
    });
  });
});
