import type { AtlasActorContext } from "@atlas/auth";
import { describe, expect, it, vi } from "vitest";
import {
  AtlasExternalIdentityAccessWorkflowError,
  listExternalIdentityAssignments,
  provisionExternalIdentityAssignment,
  updateExternalIdentityAssignmentLifecycle
} from "./external-identity-access";

function createActor(): AtlasActorContext {
  return {
    user: {
      id: "user-operator-admin",
      email: "operator-admin@atlas.local",
      name: "Operator Admin"
    },
    organization: {
      id: "org-operator",
      slug: "atlas-demo-operator",
      name: "Atlas Demo Operator",
      kind: "OPERATOR"
    },
    membership: {
      id: "membership-operator-admin",
      role: "ADMIN"
    },
    workspace: "OPERATOR",
    agentId: null,
    source: "local-development",
    providerMode: "local-signed",
    sessionId: null,
    principalOrganization: null,
    supportAccess: null
  };
}

describe("external identity access workflow", () => {
  it("lists external identity assignments with active session counts", async () => {
    const client = {
      externalIdentityAssignment: {
        findMany: vi.fn(async () => [
          {
            id: "assignment-1",
            provider: "okta-design-partner",
            externalEmail: "buyer-admin@example.com",
            userId: "user-buyer",
            organizationId: "org-buyer",
            membershipId: "membership-buyer-admin",
            status: "ACTIVE",
            statusReason: "Provisioned for design partner rollout.",
            provisionedAt: new Date("2026-04-12T00:00:00.000Z"),
            lastExchangedAt: new Date("2026-04-12T04:00:00.000Z"),
            statusChangedAt: new Date("2026-04-12T04:00:00.000Z"),
            user: {
              id: "user-buyer",
              email: "buyer-admin@example.com",
              name: "Buyer Admin"
            },
            organization: {
              id: "org-buyer",
              slug: "atlas-demo-buyer",
              name: "Atlas Demo Buyer",
              kind: "BUYER"
            },
            membership: {
              id: "membership-buyer-admin",
              role: "ADMIN"
            },
            provisionedByUser: {
              email: "operator-admin@atlas.local"
            },
            statusChangedByUser: {
              email: "operator-admin@atlas.local"
            }
          }
        ])
      },
      authSession: {
        findMany: vi.fn(async () => [
          {
            provider: "okta-design-partner",
            membershipId: "membership-buyer-admin"
          }
        ])
      }
    } as const;

    const result = await listExternalIdentityAssignments(createActor(), client as never);

    expect(result).toEqual([
      expect.objectContaining({
        id: "assignment-1",
        externalEmail: "buyer-admin@example.com",
        activeSessionCount: 1
      })
    ]);
  });

  it("provisions a new external identity assignment and creates audit state", async () => {
    const transaction = {
      organization: {
        findUnique: vi.fn(async () => ({
          id: "org-seller",
          slug: "atlas-demo-seller",
          name: "Atlas Demo Seller",
          kind: "SELLER"
        }))
      },
      user: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async () => ({
          id: "user-seller",
          email: "seller-admin@example.com",
          name: "Seller Admin"
        })),
        update: vi.fn(async () => undefined)
      },
      membership: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({
          id: "membership-seller-admin",
          role: "ADMIN"
        }))
      },
      externalIdentityAssignment: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async () => ({
          id: "assignment-created",
          provider: "okta-design-partner",
          externalEmail: "seller-admin@example.com",
          status: "ACTIVE",
          statusReason: "Provision seller access for rollout validation.",
          provisionedAt: new Date("2026-04-12T00:00:00.000Z"),
          lastExchangedAt: null,
          statusChangedAt: new Date("2026-04-12T00:00:00.000Z"),
          user: {
            id: "user-seller",
            email: "seller-admin@example.com",
            name: "Seller Admin"
          },
          organization: {
            id: "org-seller",
            slug: "atlas-demo-seller",
            name: "Atlas Demo Seller",
            kind: "SELLER"
          },
          membership: {
            id: "membership-seller-admin",
            role: "ADMIN"
          },
          provisionedByUser: {
            email: "operator-admin@atlas.local"
          },
          statusChangedByUser: {
            email: "operator-admin@atlas.local"
          }
        }))
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    };
    const client = {
      $transaction: vi.fn(async (callback: (input: typeof transaction) => Promise<unknown>) => callback(transaction))
    } as const;

    const result = await provisionExternalIdentityAssignment(
      createActor(),
      {
        provider: "okta-design-partner",
        externalEmail: "seller-admin@example.com",
        targetOrganizationSlug: "atlas-demo-seller",
        targetRole: "ADMIN",
        userName: "Seller Admin",
        reason: "Provision seller access for rollout validation."
      },
      client as never
    );

    expect(result).toMatchObject({
      id: "assignment-created",
      organizationSlug: "atlas-demo-seller",
      role: "ADMIN"
    });
    expect(transaction.auditEvent.create).toHaveBeenCalled();
  });

  it("revokes active sessions when suspending an assignment", async () => {
    const transaction = {
      externalIdentityAssignment: {
        findUnique: vi.fn(async () => ({
          id: "assignment-1",
          provider: "okta-design-partner",
          externalEmail: "buyer-admin@example.com",
          membershipId: "membership-buyer-admin",
          status: "ACTIVE",
          organization: {
            id: "org-buyer",
            slug: "atlas-demo-buyer",
            name: "Atlas Demo Buyer",
            kind: "BUYER"
          },
          membership: {
            id: "membership-buyer-admin",
            role: "ADMIN"
          },
          user: {
            id: "user-buyer",
            email: "buyer-admin@example.com",
            name: "Buyer Admin"
          },
          provisionedByUser: {
            email: "operator-admin@atlas.local"
          },
          statusChangedByUser: {
            email: "operator-admin@atlas.local"
          }
        })),
        update: vi.fn(async () => ({
          id: "assignment-1",
          provider: "okta-design-partner",
          externalEmail: "buyer-admin@example.com",
          membershipId: "membership-buyer-admin",
          status: "SUSPENDED",
          statusReason: "Suspend while tenant access mapping is reviewed.",
          provisionedAt: new Date("2026-04-12T00:00:00.000Z"),
          lastExchangedAt: new Date("2026-04-12T03:00:00.000Z"),
          statusChangedAt: new Date("2026-04-12T04:00:00.000Z"),
          organization: {
            id: "org-buyer",
            slug: "atlas-demo-buyer",
            name: "Atlas Demo Buyer",
            kind: "BUYER"
          },
          membership: {
            id: "membership-buyer-admin",
            role: "ADMIN"
          },
          user: {
            id: "user-buyer",
            email: "buyer-admin@example.com",
            name: "Buyer Admin"
          },
          provisionedByUser: {
            email: "operator-admin@atlas.local"
          },
          statusChangedByUser: {
            email: "operator-admin@atlas.local"
          }
        }))
      },
      authSession: {
        findMany: vi.fn(async () => [
          {
            id: "session-1",
            metadata: {}
          }
        ]),
        update: vi.fn(async () => undefined)
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    };
    const client = {
      $transaction: vi.fn(async (callback: (input: typeof transaction) => Promise<unknown>) => callback(transaction))
    } as const;

    const result = await updateExternalIdentityAssignmentLifecycle(
      createActor(),
      "assignment-1",
      {
        action: "SUSPEND",
        reason: "Suspend while tenant access mapping is reviewed."
      },
      client as never
    );

    expect(result.assignment.status).toBe("SUSPENDED");
    expect(result.revokedSessionCount).toBe(1);
    expect(transaction.authSession.update).toHaveBeenCalled();
  });

  it("rejects support-mode actors from provisioning", async () => {
    await expect(
      provisionExternalIdentityAssignment(
        {
          ...createActor(),
          source: "internal-support",
          supportAccess: {
            grantId: "grant-1",
            mode: "read-only",
            reason: "Inspect tenant posture.",
            grantedByUserEmail: "operator-admin@atlas.local",
            targetOrganizationSlug: "atlas-demo-buyer",
            targetWorkspace: "BUYER"
          }
        },
        {
          provider: "okta-design-partner",
          externalEmail: "buyer-admin@example.com",
          targetOrganizationSlug: "atlas-demo-buyer",
          targetRole: "ADMIN",
          reason: "Provision design-partner access for rollout."
        },
        {} as never
      )
    ).rejects.toBeInstanceOf(AtlasExternalIdentityAccessWorkflowError);
  });
});
