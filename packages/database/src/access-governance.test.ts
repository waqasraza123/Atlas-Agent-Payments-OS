import type { AtlasActorContext } from "@atlas/auth";
import { describe, expect, it, vi } from "vitest";
import {
  createSupportAccessReviewCampaign,
  listIdentityProviderLinks,
  listSupportAccessReviewCampaignCandidates,
  revokeIdentityProviderSession,
  updateIdentityProviderLinkLifecycle,
  resolveSupportAccessReviewCampaignItem
} from "./access-governance";

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
    sessionExpiresAt: "2027-04-12T08:00:00.000Z",
    ...overrides
  };
}

describe("access governance workflow", () => {
  it("lists grants that are due for campaign review", async () => {
    const actor = createOperatorActor();
    const client = {
      supportAccessGrant: {
        findMany: vi.fn(async () => [
          {
            id: "grant-1",
            targetWorkspace: "BUYER",
            reason: "Review delayed settlement access for buyer support.",
            status: "RECERTIFICATION_REQUIRED",
            expiresAt: new Date("2027-04-12T08:00:00.000Z"),
            reviewExpiresAt: new Date("2026-04-12T08:00:00.000Z"),
            issuedByUser: {
              email: "operator-requester@atlas.local"
            },
            targetOrganization: {
              id: "org-buyer",
              slug: "atlas-demo-buyer",
              name: "Atlas Demo Buyer"
            }
          }
        ])
      }
    } as const;

    const items = await listSupportAccessReviewCampaignCandidates(actor, client as never);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      grantId: "grant-1",
      status: "RECERTIFICATION_REQUIRED",
      targetOrganizationSlug: "atlas-demo-buyer"
    });
  });

  it("creates a campaign from due grants", async () => {
    const actor = createOperatorActor();
    const transaction = {
      supportAccessReviewCampaign: {
        create: vi.fn(async () => ({
          id: "campaign-1",
          title: "Quarterly support review",
          reason: "Review grants before the next partner operations window.",
          status: "OPEN",
          dueAt: new Date("2026-04-13T00:00:00.000Z"),
          completedAt: null,
          metadata: null,
          createdAt: new Date("2026-04-12T00:00:00.000Z"),
          updatedAt: new Date("2026-04-12T00:00:00.000Z"),
          createdByUser: {
            email: actor.user.email
          },
          organization: {
            id: actor.organization.id
          },
          items: [
            {
              id: "item-1",
              status: "PENDING",
              resolutionReason: null,
              resolvedAt: null,
              supportAccessGrant: {
                id: "grant-1",
                status: "RECERTIFICATION_REQUIRED",
                targetWorkspace: "BUYER",
                expiresAt: new Date("2027-04-12T08:00:00.000Z"),
                reviewExpiresAt: new Date("2026-04-12T08:00:00.000Z"),
                issuedByUser: {
                  email: "operator-requester@atlas.local"
                },
                targetOrganization: {
                  name: "Atlas Demo Buyer",
                  slug: "atlas-demo-buyer"
                }
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
        findMany: vi.fn(async () => [
          {
            id: "grant-1",
            targetWorkspace: "BUYER",
            reason: "Review delayed settlement access for buyer support.",
            status: "RECERTIFICATION_REQUIRED",
            expiresAt: new Date("2027-04-12T08:00:00.000Z"),
            reviewExpiresAt: new Date("2026-04-12T08:00:00.000Z"),
            issuedByUser: {
              email: "operator-requester@atlas.local"
            },
            targetOrganization: {
              id: "org-buyer",
              slug: "atlas-demo-buyer",
              name: "Atlas Demo Buyer"
            }
          }
        ])
      },
      $transaction: vi.fn(async (callback: (input: typeof transaction) => Promise<unknown>) => callback(transaction))
    } as const;

    const campaign = await createSupportAccessReviewCampaign(
      actor,
      {
        title: "Quarterly support review",
        reason: "Review grants before the next partner operations window."
      },
      client as never
    );

    expect(campaign.pendingItemCount).toBe(1);
    expect(transaction.supportAccessReviewCampaign.create).toHaveBeenCalled();
  });

  it("resolves a campaign item through recertification and closes the campaign", async () => {
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
      supportAccessReviewCampaignItem: {
        findUnique: vi.fn(async () => ({
          id: "item-1",
          campaignId: "campaign-1",
          status: "PENDING",
          campaign: {
            id: "campaign-1",
            organizationId: actor.organization.id,
            status: "OPEN"
          },
          supportAccessGrantId: "grant-1",
          supportAccessGrant: {
            id: "grant-1",
            issuedByUserId: "user-requester",
            issuedByOrganizationId: actor.organization.id,
            targetOrganizationId: "org-buyer",
            targetWorkspace: "BUYER",
            authProviderMode: "EXTERNAL_OIDC",
            reason: "Review delayed settlement access for buyer support.",
            status: "RECERTIFICATION_REQUIRED",
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
              email: "operator-requester@atlas.local"
            },
            targetOrganization: {
              id: "org-buyer",
              slug: "atlas-demo-buyer",
              name: "Atlas Demo Buyer"
            },
            reviews: []
          }
        })),
        update: vi.fn(async () => ({
          id: "item-1",
          status: "RECERTIFIED",
          resolutionReason: "Still needed for partner investigation.",
          resolvedAt: new Date(),
          supportAccessGrant: {
            id: "grant-1",
            targetWorkspace: "BUYER",
            status: "ACTIVE",
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            reviewExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
            issuedByUser: {
              email: "operator-requester@atlas.local"
            },
            targetOrganization: {
              name: "Atlas Demo Buyer",
              slug: "atlas-demo-buyer"
            }
          },
          campaign: {
            id: "campaign-1"
          }
        })),
        count: vi.fn(async () => 0)
      },
      supportAccessGrantReview: {
        create: vi.fn(async () => undefined)
      },
      supportAccessGrant: {
        findUnique: vi.fn(async () => ({
          id: "grant-1",
          issuedByUserId: "user-requester",
          issuedByOrganizationId: actor.organization.id,
          targetOrganizationId: "org-buyer",
          targetWorkspace: "BUYER",
          authProviderMode: "EXTERNAL_OIDC",
          reason: "Review delayed settlement access for buyer support.",
          status: "RECERTIFICATION_REQUIRED",
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
            email: "operator-requester@atlas.local"
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
        update: vi.fn(async () => ({
          id: "grant-1",
          issuedByUserId: "user-requester",
          issuedByOrganizationId: actor.organization.id,
          targetOrganizationId: "org-buyer",
          targetWorkspace: "BUYER",
          authProviderMode: "EXTERNAL_OIDC",
          reason: "Review delayed settlement access for buyer support.",
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
            email: "operator-requester@atlas.local"
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
      },
      supportAccessReviewCampaign: {
        update: vi.fn(async () => undefined)
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    };
    const client = {
      $transaction: vi.fn(async (callback: (input: typeof transaction) => Promise<unknown>) => callback(transaction))
    } as const;

    const result = await resolveSupportAccessReviewCampaignItem(
      actor,
      "campaign-1",
      "item-1",
      {
        action: "RECERTIFY",
        reason: "Still needed for partner investigation."
      },
      client as never
    );

    expect(result.itemStatus).toBe("RECERTIFIED");
    expect(transaction.supportAccessReviewCampaign.update).toHaveBeenCalled();
  });

  it("revokes a live identity-provider session", async () => {
    const actor = createOperatorActor();
    const transaction = {
      authSession: {
        findUnique: vi.fn(async () => ({
          id: "session-1",
          source: "IDENTITY_PROVIDER",
          authProviderMode: "EXTERNAL_OIDC",
          provider: "okta-production",
          providerSubject: "subject-1",
          expiresAt: new Date("2027-04-12T08:00:00.000Z"),
          revokedAt: null,
          lastSeenAt: new Date("2026-04-12T00:00:00.000Z"),
          metadata: {
            issuedAt: "2026-04-12T00:00:00.000Z"
          },
          user: {
            id: "user-buyer",
            email: "buyer-admin@atlas.local",
            name: "Buyer Admin"
          },
          organization: {
            id: "org-buyer",
            slug: "atlas-demo-buyer",
            name: "Atlas Demo Buyer",
            kind: "BUYER"
          },
          membership: {
            id: "membership-buyer",
            role: "ADMIN"
          }
        })),
        update: vi.fn(async () => ({
          id: "session-1",
          source: "IDENTITY_PROVIDER",
          authProviderMode: "EXTERNAL_OIDC",
          provider: "okta-production",
          providerSubject: "subject-1",
          expiresAt: new Date("2027-04-12T08:00:00.000Z"),
          revokedAt: new Date("2026-04-12T01:00:00.000Z"),
          lastSeenAt: new Date("2026-04-12T00:00:00.000Z"),
          metadata: {
            issuedAt: "2026-04-12T00:00:00.000Z"
          },
          user: {
            id: "user-buyer",
            email: "buyer-admin@atlas.local",
            name: "Buyer Admin"
          },
          organization: {
            id: "org-buyer",
            slug: "atlas-demo-buyer",
            name: "Atlas Demo Buyer",
            kind: "BUYER"
          },
          membership: {
            id: "membership-buyer",
            role: "ADMIN"
          }
        }))
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    };
    const client = {
      authSession: {
        findUnique: vi.fn(async () => ({
          id: "session-1",
          source: "IDENTITY_PROVIDER",
          authProviderMode: "EXTERNAL_OIDC",
          provider: "okta-production",
          providerSubject: "subject-1",
          expiresAt: new Date("2027-04-12T08:00:00.000Z"),
          revokedAt: null,
          lastSeenAt: new Date("2026-04-12T00:00:00.000Z"),
          metadata: {
            issuedAt: "2026-04-12T00:00:00.000Z"
          },
          user: {
            id: "user-buyer",
            email: "buyer-admin@atlas.local",
            name: "Buyer Admin"
          },
          organization: {
            id: "org-buyer",
            slug: "atlas-demo-buyer",
            name: "Atlas Demo Buyer",
            kind: "BUYER"
          },
          membership: {
            id: "membership-buyer",
            role: "ADMIN"
          }
        }))
      },
      identityProviderLink: {
        findUnique: vi.fn(async () => ({
          id: "link-1",
          provider: "okta-production",
          subject: "subject-1",
          status: "ACTIVE"
        }))
      },
      externalIdentityAssignment: {
        findUnique: vi.fn(async () => ({
          id: "assignment-1",
          status: "ACTIVE"
        }))
      },
      $transaction: vi.fn(async (callback: (input: typeof transaction) => Promise<unknown>) => callback(transaction))
    } as const;

    const session = await revokeIdentityProviderSession(
      actor,
      "session-1",
      {
        reason: "Ending the tenant session after support investigation completed."
      },
      client as never
    );

    expect(session.revokedAt).toBeTruthy();
    expect(transaction.authSession.update).toHaveBeenCalled();
  });

  it("lists tenant-bound identity-provider links with active session counts", async () => {
    const actor = createOperatorActor();
    const client = {
      identityProviderLink: {
        findMany: vi.fn(async () => [
          {
            id: "link-1",
            provider: "okta-production",
            subject: "subject-1",
            status: "ACTIVE",
            statusReason: null,
            statusChangedAt: null,
            linkedAt: new Date("2026-04-12T00:00:00.000Z"),
            lastAuthenticatedAt: new Date("2026-04-12T01:00:00.000Z"),
            user: {
              id: "user-buyer",
              email: "buyer-admin@atlas.local",
              name: "Buyer Admin",
              memberships: [
                {
                  id: "membership-buyer",
                  role: "ADMIN",
                  organization: {
                    id: "org-buyer",
                    slug: "atlas-demo-buyer",
                    name: "Atlas Demo Buyer",
                    kind: "BUYER"
                  }
                }
              ]
            },
            statusChangedByUser: null
          }
        ])
      },
      authSession: {
        findMany: vi.fn(async () => [
          {
            provider: "okta-production",
            providerSubject: "subject-1"
          }
        ])
      }
    } as const;

    const links = await listIdentityProviderLinks(actor, client as never);

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      id: "link-1",
      status: "ACTIVE",
      activeSessionCount: 1
    });
  });

  it("suspends an identity-provider link and revokes live sessions", async () => {
    const actor = createOperatorActor();
    const transaction = {
      identityProviderLink: {
        findUnique: vi.fn(async () => ({
          id: "link-1",
          provider: "okta-production",
          subject: "subject-1",
          status: "ACTIVE",
          statusReason: null,
          statusChangedAt: null,
          linkedAt: new Date("2026-04-12T00:00:00.000Z"),
          lastAuthenticatedAt: new Date("2026-04-12T01:00:00.000Z"),
          user: {
            id: "user-buyer",
            email: "buyer-admin@atlas.local",
            name: "Buyer Admin",
            memberships: [
              {
                id: "membership-buyer",
                role: "ADMIN",
                organization: {
                  id: "org-buyer",
                  slug: "atlas-demo-buyer",
                  name: "Atlas Demo Buyer",
                  kind: "BUYER"
                }
              }
            ]
          },
          statusChangedByUser: null
        })),
        update: vi.fn(async () => ({
          id: "link-1",
          provider: "okta-production",
          subject: "subject-1",
          status: "SUSPENDED",
          statusReason: "Suspend buyer identity while tenancy review completes.",
          statusChangedAt: new Date("2026-04-12T02:00:00.000Z"),
          linkedAt: new Date("2026-04-12T00:00:00.000Z"),
          lastAuthenticatedAt: new Date("2026-04-12T01:00:00.000Z"),
          user: {
            id: "user-buyer",
            email: "buyer-admin@atlas.local",
            name: "Buyer Admin",
            memberships: [
              {
                id: "membership-buyer",
                role: "ADMIN",
                organization: {
                  id: "org-buyer",
                  slug: "atlas-demo-buyer",
                  name: "Atlas Demo Buyer",
                  kind: "BUYER"
                }
              }
            ]
          },
          statusChangedByUser: {
            email: actor.user.email
          }
        }))
      },
      authSession: {
        findMany: vi.fn(async () => [
          {
            id: "session-1",
            metadata: {
              issuedAt: "2026-04-12T00:00:00.000Z"
            }
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

    const result = await updateIdentityProviderLinkLifecycle(
      actor,
      "link-1",
      {
        action: "SUSPEND",
        reason: "Suspend buyer identity while tenancy review completes."
      },
      client as never
    );

    expect(result.link.status).toBe("SUSPENDED");
    expect(result.revokedSessionCount).toBe(1);
    expect(transaction.authSession.update).toHaveBeenCalled();
  });
});
