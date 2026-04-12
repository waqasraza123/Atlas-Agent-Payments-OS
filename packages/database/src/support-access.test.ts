import { createAtlasSupportAccessRecord, type AtlasActorContext } from "@atlas/auth";
import { describe, expect, it, vi } from "vitest";
import {
  activateSupportAccessGrant,
  issueSupportAccessGrant,
  recertifySupportAccessGrant,
  reviewSupportAccessGrant
} from "./support-access";

function createOperatorActor(overrides?: Partial<AtlasActorContext>): AtlasActorContext {
  return {
    user: {
      id: "user-operator",
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
      id: "membership-operator",
      role: "ADMIN"
    },
    workspace: "OPERATOR",
    agentId: null,
    source: "local-development",
    providerMode: "local-signed",
    sessionId: null,
    principalOrganization: null,
    supportAccess: null,
    sessionIssuedAt: "2026-04-12T00:00:00.000Z",
    sessionExpiresAt: "2026-04-12T08:00:00.000Z",
    ...overrides
  };
}

describe("support access workflow", () => {
  it("creates support grants in pending review state", async () => {
    const actor = createOperatorActor();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const transaction = {
      supportAccessGrant: {
        create: vi.fn(async () => ({
          id: "grant-1",
          targetWorkspace: "BUYER",
          reason: "Investigate a delayed settlement and receipt mismatch.",
          status: "PENDING_REVIEW",
          createdAt: new Date("2026-04-12T00:00:00.000Z"),
          expiresAt: new Date(expiresAt),
          lastReviewedAt: null,
          reviewExpiresAt: null,
          lastActivatedAt: null,
          revokedAt: null,
          revokedReason: null,
          issuedByUser: {
            id: actor.user.id,
            email: actor.user.email
          },
          issuedByOrganization: {
            id: actor.organization.id,
            name: actor.organization.name
          },
          targetOrganization: {
            id: "org-buyer",
            slug: "atlas-demo-buyer",
            name: "Atlas Demo Buyer"
          },
          reviews: []
        }))
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    };
    const client = {
      organization: {
        findFirst: vi.fn(async () => ({
          id: "org-buyer",
          slug: "atlas-demo-buyer",
          kind: "BUYER"
        }))
      },
      $transaction: vi.fn(async (callback: (input: typeof transaction) => Promise<unknown>) => callback(transaction))
    } as const;

    const grant = await issueSupportAccessGrant(
      actor,
      {
        targetOrganizationSlug: "atlas-demo-buyer",
        targetWorkspace: "BUYER",
        reason: "Investigate a delayed settlement and receipt mismatch.",
        expiresAt
      },
      client as never
    );

    expect(grant.status).toBe("PENDING_REVIEW");
    expect(transaction.supportAccessGrant.create).toHaveBeenCalled();
  });

  it("blocks self-review of support grants", async () => {
    const actor = createOperatorActor();
    const client = {
      supportAccessGrant: {
        findUnique: vi.fn(async () => ({
          id: "grant-1",
          issuedByUserId: actor.user.id,
          issuedByOrganizationId: actor.organization.id,
          targetOrganizationId: "org-buyer",
          targetWorkspace: "BUYER",
          authProviderMode: "LOCAL_SIGNED",
          reason: "Investigate a delayed settlement and receipt mismatch.",
          status: "PENDING_REVIEW",
          expiresAt: new Date(Date.now() + 60_000),
          lastReviewedAt: null,
          reviewExpiresAt: null,
          lastActivatedAt: null,
          revokedAt: null,
          revokedReason: null,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          issuedByUser: {
            id: actor.user.id,
            email: actor.user.email
          },
          issuedByOrganization: {
            id: actor.organization.id,
            slug: actor.organization.slug,
            name: actor.organization.name
          },
          targetOrganization: {
            id: "org-buyer",
            slug: "atlas-demo-buyer",
            name: "Atlas Demo Buyer"
          },
          reviews: []
        }))
      }
    } as const;

    await expect(
      reviewSupportAccessGrant(
        actor,
        "grant-1",
        {
          decision: "APPROVED",
          reviewReason: "Approved after confirming the requester and target tenant."
        },
        client as never
      )
    ).rejects.toThrow(/cannot review support-access grants that they requested themselves/i);
  });

  it("blocks support-session activation until the grant is approved", async () => {
    const actor = createOperatorActor({
      source: "internal-support",
      supportAccess: createAtlasSupportAccessRecord({
        grantId: "grant-1",
        targetOrganizationSlug: "atlas-demo-buyer",
        targetWorkspace: "BUYER",
        reason: "Investigate a delayed settlement and receipt mismatch.",
        grantedByUserEmail: "operator-admin@atlas.local"
      })
    });
    const requestingActor = {
      ...actor,
      source: "local-development",
      supportAccess: null
    } satisfies AtlasActorContext;
    const client = {
      supportAccessGrant: {
        findUnique: vi.fn(async () => ({
          id: "grant-1",
          issuedByUserId: requestingActor.user.id,
          issuedByOrganizationId: requestingActor.organization.id,
          targetOrganizationId: "org-buyer",
          targetWorkspace: "BUYER",
          authProviderMode: "LOCAL_SIGNED",
          reason: "Investigate a delayed settlement and receipt mismatch.",
          status: "PENDING_REVIEW",
          expiresAt: new Date(Date.now() + 60_000),
          lastReviewedAt: null,
          reviewExpiresAt: null,
          lastActivatedAt: null,
          revokedAt: null,
          revokedReason: null,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          issuedByUser: {
            id: requestingActor.user.id,
            email: requestingActor.user.email
          },
          issuedByOrganization: {
            id: requestingActor.organization.id,
            slug: requestingActor.organization.slug,
            name: requestingActor.organization.name
          },
          targetOrganization: {
            id: "org-buyer",
            slug: "atlas-demo-buyer",
            name: "Atlas Demo Buyer"
          },
          reviews: []
        }))
      }
    } as const;

    await expect(activateSupportAccessGrant(requestingActor, "grant-1", client as never)).rejects.toThrow(
      /only approved support-access grants can be activated/i
    );
  });

  it("recertifies active support grants through a second review", async () => {
    const actor = createOperatorActor({
      user: {
        id: "user-reviewer",
        email: "operator-owner@atlas.local",
        name: "Operator Owner"
      },
      membership: {
        id: "membership-owner",
        role: "OWNER"
      }
    });
    const transaction = {
      supportAccessGrantReview: {
        create: vi.fn(async () => undefined)
      },
      supportAccessGrant: {
        update: vi.fn(async () => ({
          id: "grant-1",
          issuedByUserId: "user-requester",
          issuedByOrganizationId: actor.organization.id,
          targetOrganizationId: "org-buyer",
          targetWorkspace: "BUYER",
          authProviderMode: "IDENTITY_BRIDGE",
          reason: "Investigate delayed settlement posture for a buyer tenant.",
          status: "ACTIVE",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          lastReviewedAt: new Date(),
          reviewExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
          lastActivatedAt: null,
          revokedAt: null,
          revokedReason: null,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          issuedByUser: {
            id: "user-requester",
            email: "operator-admin@atlas.local"
          },
          issuedByOrganization: {
            id: actor.organization.id,
            slug: actor.organization.slug,
            name: actor.organization.name
          },
          targetOrganization: {
            id: "org-buyer",
            slug: "atlas-demo-buyer",
            name: "Atlas Demo Buyer"
          },
          reviews: [
            {
              id: "review-2",
              reviewType: "RECERTIFICATION",
              decision: "APPROVED",
              reason: "Recertified after confirming the investigation is still active.",
              createdAt: new Date(),
              reviewerUser: {
                email: actor.user.email
              },
              reviewerOrganization: {
                name: actor.organization.name
              }
            }
          ]
        }))
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    };
    const client = {
      supportAccessGrant: {
        findUnique: vi.fn(async () => ({
          id: "grant-1",
          issuedByUserId: "user-requester",
          issuedByOrganizationId: actor.organization.id,
          targetOrganizationId: "org-buyer",
          targetWorkspace: "BUYER",
          authProviderMode: "IDENTITY_BRIDGE",
          reason: "Investigate delayed settlement posture for a buyer tenant.",
          status: "RECERTIFICATION_REQUIRED",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          lastReviewedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          reviewExpiresAt: new Date(Date.now() - 60 * 1000),
          lastActivatedAt: null,
          revokedAt: null,
          revokedReason: null,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          issuedByUser: {
            id: "user-requester",
            email: "operator-admin@atlas.local"
          },
          issuedByOrganization: {
            id: actor.organization.id,
            slug: actor.organization.slug,
            name: actor.organization.name
          },
          targetOrganization: {
            id: "org-buyer",
            slug: "atlas-demo-buyer",
            name: "Atlas Demo Buyer"
          },
          reviews: []
        })),
        update: vi.fn()
      },
      $transaction: vi.fn(async (callback: (input: typeof transaction) => Promise<unknown>) => callback(transaction))
    } as const;

    const grant = await recertifySupportAccessGrant(
      actor,
      "grant-1",
      {
        reviewReason: "Recertified after confirming the investigation is still active."
      },
      client as never
    );

    expect(grant.status).toBe("ACTIVE");
    expect(transaction.supportAccessGrantReview.create).toHaveBeenCalled();
    expect(transaction.supportAccessGrant.update).toHaveBeenCalled();
  });
});
