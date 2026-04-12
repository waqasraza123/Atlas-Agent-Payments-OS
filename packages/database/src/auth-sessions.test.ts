import { describe, expect, it, vi } from "vitest";
import { AtlasAuthSessionWorkflowError, exchangeExternalIdentityForSession, loadAuthSessionById } from "./auth-sessions";

describe("auth session exchange workflow", () => {
  it("persists external oidc exchanges as atlas auth sessions", async () => {
    const transaction = {
      identityProviderLink: {
        create: vi.fn(async () => undefined),
        update: vi.fn(async () => undefined)
      },
      externalIdentityAssignment: {
        update: vi.fn(async () => undefined)
      },
      authSession: {
        create: vi.fn(async () => ({
          id: "session-1",
          source: "IDENTITY_PROVIDER",
          authProviderMode: "EXTERNAL_OIDC",
          provider: "okta-production",
          providerSubject: "subject-1",
          expiresAt: new Date("2027-04-12T08:00:00.000Z"),
          revokedAt: null,
          lastSeenAt: new Date("2027-04-12T00:00:00.000Z"),
          metadata: {
            issuedAt: "2027-04-12T00:00:00.000Z",
            issuer: "https://id.atlas.example",
            audience: "atlas-agent-payments-os"
          },
          user: {
            id: "user-buyer",
            email: "buyer-admin@atlas.local",
            name: "Buyer Admin"
          },
          organization: {
            id: "org-buyer",
            slug: "atlas-demo-buyer",
            name: "Atlas Demo Buyer"
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
      membership: {
        findFirst: vi.fn(async () => ({
          id: "membership-buyer",
          role: "ADMIN",
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
          }
        }))
      },
      identityProviderLink: {
        findUnique: vi.fn(async () => null)
      },
      externalIdentityAssignment: {
        findUnique: vi.fn(async () => ({
          id: "assignment-1",
          status: "ACTIVE"
        }))
      },
      $transaction: vi.fn(async (callback: (input: typeof transaction) => Promise<unknown>) => callback(transaction))
    } as const;

    const session = await exchangeExternalIdentityForSession(
      {
        selection: {
          profileKey: null,
          workspace: "BUYER",
          userEmail: "buyer-admin@atlas.local",
          organizationSlug: "atlas-demo-buyer",
          role: "ADMIN",
          agentId: null
        },
        externalEmail: "buyer-admin@atlas.local",
        subject: "subject-1",
        provider: "okta-production",
        issuer: "https://id.atlas.example",
        audience: "atlas-agent-payments-os",
        issuedAt: "2027-04-12T00:00:00.000Z",
        expiresAt: "2027-04-12T08:00:00.000Z",
        userName: "Buyer Admin"
      },
      client as never
    );

    expect(session.authProviderMode).toBe("EXTERNAL_OIDC");
    expect(transaction.identityProviderLink.create).toHaveBeenCalled();
    expect(transaction.externalIdentityAssignment.update).toHaveBeenCalledWith({
      where: {
        id: "assignment-1"
      },
      data: {
        lastExchangedAt: expect.any(Date)
      }
    });
    expect(transaction.authSession.create).toHaveBeenCalled();
    expect(transaction.auditEvent.create).toHaveBeenCalled();
  });

  it("rejects external exchanges when no external identity assignment exists", async () => {
    const client = {
      membership: {
        findFirst: vi.fn(async () => ({
          id: "membership-buyer",
          role: "ADMIN",
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
          }
        }))
      },
      identityProviderLink: {
        findUnique: vi.fn(async () => null)
      },
      externalIdentityAssignment: {
        findUnique: vi.fn(async () => null)
      },
      $transaction: vi.fn()
    } as const;

    await expect(
      exchangeExternalIdentityForSession(
        {
          selection: {
            profileKey: null,
            workspace: "BUYER",
            userEmail: "buyer-admin@atlas.local",
            organizationSlug: "atlas-demo-buyer",
            role: "ADMIN",
            agentId: null
          },
          externalEmail: "buyer-admin@atlas.local",
          subject: "subject-1",
          provider: "okta-production",
          issuer: "https://id.atlas.example",
          audience: "atlas-agent-payments-os",
          issuedAt: "2027-04-12T00:00:00.000Z",
          expiresAt: "2027-04-12T08:00:00.000Z",
          userName: "Buyer Admin"
        },
        client as never
      )
    ).rejects.toMatchObject({
      code: "forbidden"
    });
  });

  it("rejects suspended identity-provider links during exchange", async () => {
    const client = {
      membership: {
        findFirst: vi.fn(async () => ({
          id: "membership-buyer",
          role: "ADMIN",
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
          }
        }))
      },
      identityProviderLink: {
        findUnique: vi.fn(async () => ({
          id: "link-1",
          userId: "user-buyer",
          status: "SUSPENDED"
        }))
      },
      externalIdentityAssignment: {
        findUnique: vi.fn(async () => ({
          id: "assignment-1",
          status: "ACTIVE"
        }))
      },
      $transaction: vi.fn()
    } as const;

    await expect(
      exchangeExternalIdentityForSession(
        {
          selection: {
            profileKey: null,
            workspace: "BUYER",
            userEmail: "buyer-admin@atlas.local",
            organizationSlug: "atlas-demo-buyer",
            role: "ADMIN",
            agentId: null
          },
          externalEmail: "buyer-admin@atlas.local",
          subject: "subject-1",
          provider: "okta-production",
          issuer: "https://id.atlas.example",
          audience: "atlas-agent-payments-os",
          issuedAt: "2027-04-12T00:00:00.000Z",
          expiresAt: "2027-04-12T08:00:00.000Z",
          userName: "Buyer Admin"
        },
        client as never
      )
    ).rejects.toBeInstanceOf(AtlasAuthSessionWorkflowError);
  });

  it("returns null for sessions whose provider link is no longer active", async () => {
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
          lastSeenAt: new Date("2027-04-12T00:00:00.000Z"),
          metadata: {
            issuedAt: "2027-04-12T00:00:00.000Z"
          },
          user: {
            id: "user-buyer",
            email: "buyer-admin@atlas.local",
            name: "Buyer Admin"
          },
          organization: {
            id: "org-buyer",
            slug: "atlas-demo-buyer",
            name: "Atlas Demo Buyer"
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
          status: "REVOKED"
        }))
      },
      externalIdentityAssignment: {
        findUnique: vi.fn(async () => ({
          id: "assignment-1",
          status: "ACTIVE"
        }))
      }
    } as const;

    const result = await loadAuthSessionById("session-1", client as never);

    expect(result).toBeNull();
  });

  it("returns null for external oidc sessions whose external assignment is no longer active", async () => {
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
          lastSeenAt: new Date("2027-04-12T00:00:00.000Z"),
          metadata: {
            issuedAt: "2027-04-12T00:00:00.000Z"
          },
          user: {
            id: "user-buyer",
            email: "buyer-admin@atlas.local",
            name: "Buyer Admin"
          },
          organization: {
            id: "org-buyer",
            slug: "atlas-demo-buyer",
            name: "Atlas Demo Buyer"
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
          status: "ACTIVE"
        }))
      },
      externalIdentityAssignment: {
        findUnique: vi.fn(async () => ({
          id: "assignment-1",
          status: "SUSPENDED"
        }))
      }
    } as const;

    const result = await loadAuthSessionById("session-1", client as never);

    expect(result).toBeNull();
  });
});
