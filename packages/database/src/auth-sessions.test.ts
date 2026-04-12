import { describe, expect, it, vi } from "vitest";
import { exchangeExternalIdentityForSession } from "./auth-sessions";

describe("auth session exchange workflow", () => {
  it("persists external oidc exchanges as atlas auth sessions", async () => {
    const transaction = {
      identityProviderLink: {
        upsert: vi.fn(async () => undefined)
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
    expect(transaction.identityProviderLink.upsert).toHaveBeenCalled();
    expect(transaction.authSession.create).toHaveBeenCalled();
    expect(transaction.auditEvent.create).toHaveBeenCalled();
  });
});
