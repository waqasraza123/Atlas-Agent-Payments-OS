import "reflect-metadata";
import { createAtlasLocalSessionSelection, createAtlasSupportAccessRecord } from "@atlas/auth";
import {
  createAtlasIdentityProviderSessionToken,
  createAtlasLocalSessionToken,
  createAtlasSupportSessionToken
} from "@atlas/auth/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  authSession: {
    findUnique: vi.fn(),
    update: vi.fn()
  },
  membership: {
    findFirst: vi.fn()
  },
  supportAccessGrant: {
    findUnique: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock("@atlas/database", () => ({
  prisma: prismaMock,
  loadAuthSessionById: async (sessionId: string) => {
    const session = await prismaMock.authSession.findUnique({
      where: {
        id: sessionId
      }
    });

    if (!session) {
      return null;
    }

    if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return {
      id: session.id,
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name ?? null,
      organizationId: session.organization.id,
      organizationSlug: session.organization.slug,
      organizationName: session.organization.name,
      membershipId: session.membership.id,
      role: session.membership.role,
      provider: session.provider ?? "",
      providerSubject: session.providerSubject ?? "",
      source: session.source,
      issuedAt:
        session.metadata &&
        typeof session.metadata === "object" &&
        !Array.isArray(session.metadata) &&
        typeof session.metadata.issuedAt === "string"
          ? session.metadata.issuedAt
          : session.lastSeenAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      revokedAt: session.revokedAt?.toISOString() ?? null,
      lastSeenAt: session.lastSeenAt.toISOString()
    };
  },
  touchAuthSession: async (sessionId: string) =>
    prismaMock.authSession.update({
      where: {
        id: sessionId
      },
      data: {
        lastSeenAt: new Date()
      }
    })
}));

describe("actor resolution service", () => {
  beforeEach(() => {
    prismaMock.authSession.findUnique.mockReset();
    prismaMock.authSession.update.mockReset();
    prismaMock.membership.findFirst.mockReset();
    prismaMock.supportAccessGrant.findUnique.mockReset();
    prismaMock.supportAccessGrant.update.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("resolves a signed local session header", async () => {
    const { ActorResolutionService } = await import("../src/modules/actor/actor.service");

    prismaMock.membership.findFirst.mockResolvedValue({
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
    });

    const service = new ActorResolutionService();
    const token = createAtlasLocalSessionToken("atlas-local-session-secret", createAtlasLocalSessionSelection("buyer-admin"));
    const resolution = await service.resolveFromHeaders({
      "x-atlas-local-session": token
    });

    expect(resolution.status).toBe("ready");
    expect(resolution.status === "ready" ? resolution.actor.organization.slug : null).toBe("atlas-demo-buyer");
    expect(prismaMock.supportAccessGrant.findUnique).not.toHaveBeenCalled();
  });

  it("rejects signed local sessions outside local-development runtime boundaries", async () => {
    vi.stubEnv("APP_ENV", "staging");

    const { ActorResolutionService } = await import("../src/modules/actor/actor.service");

    const service = new ActorResolutionService();
    const token = createAtlasLocalSessionToken("atlas-local-session-secret", createAtlasLocalSessionSelection("buyer-admin"));
    const resolution = await service.resolveFromHeaders({
      "x-atlas-local-session": token
    });

    expect(resolution.status).toBe("invalid");
    expect(resolution.status !== "ready" ? resolution.message : "").toMatch(/disabled for the current runtime boundary/i);
  });

  it("rejects signed local sessions when provider-backed auth is configured", async () => {
    vi.stubEnv("AUTH_PROVIDER_MODE", "external-oidc");

    const { ActorResolutionService } = await import("../src/modules/actor/actor.service");

    const service = new ActorResolutionService();
    const token = createAtlasLocalSessionToken("atlas-local-session-secret", createAtlasLocalSessionSelection("buyer-admin"));
    const resolution = await service.resolveFromHeaders({
      "x-atlas-local-session": token
    });

    expect(resolution.status).toBe("invalid");
    expect(resolution.status !== "ready" ? resolution.message : "").toMatch(/disabled for the current runtime boundary/i);
  });

  it("resolves a support session into a target tenant while preserving operator principal context", async () => {
    vi.stubEnv("AUTH_SUPPORT_ACCESS_ALLOWED_EMAILS", "operator@atlas.local,operator-admin@atlas.local");
    const { ActorResolutionService } = await import("../src/modules/actor/actor.service");

    prismaMock.membership.findFirst.mockResolvedValue({
      id: "membership-operator",
      role: "OPERATOR",
      user: {
        id: "user-operator",
        email: "operator@atlas.local",
        name: "Operator"
      },
      organization: {
        id: "org-operator",
        slug: "atlas-demo-operator",
        name: "Atlas Demo Operator",
        kind: "OPERATOR"
      }
    });
    prismaMock.supportAccessGrant.findUnique.mockResolvedValue({
      id: "grant-support-1",
      issuedByOrganizationId: "org-operator",
      status: "ACTIVE",
      expiresAt: new Date("2027-04-13T01:00:00.000Z"),
      reviewExpiresAt: new Date("2027-04-12T18:00:00.000Z"),
      issuedByUser: {
        email: "operator@atlas.local"
      },
      issuedByOrganization: {
        slug: "atlas-demo-operator"
      },
      targetOrganization: {
        id: "org-buyer",
        slug: "atlas-demo-buyer",
        name: "Atlas Demo Buyer",
        kind: "BUYER"
      },
      targetWorkspace: "BUYER"
    });

    const service = new ActorResolutionService();
    const token = createAtlasSupportSessionToken(
      "atlas-local-session-secret",
      createAtlasLocalSessionSelection("operator-operator"),
      createAtlasSupportAccessRecord({
        grantId: "grant-support-1",
        targetOrganizationSlug: "atlas-demo-buyer",
        targetWorkspace: "BUYER",
        reason: "Inspect a delayed receipt and payment mismatch.",
        grantedByUserEmail: "operator@atlas.local"
      })
    );
    const resolution = await service.resolveFromHeaders({
      "x-atlas-local-session": token
    });

    expect(resolution.status).toBe("ready");
    expect(resolution.status === "ready" ? resolution.actor.organization.slug : null).toBe("atlas-demo-buyer");
    expect(resolution.status === "ready" ? resolution.actor.principalOrganization?.slug : null).toBe("atlas-demo-operator");
    expect(resolution.status === "ready" ? resolution.actor.supportAccess?.mode : null).toBe("read-only");
  });

  it("rejects expired signed session headers", async () => {
    const { ActorResolutionService } = await import("../src/modules/actor/actor.service");
    const service = new ActorResolutionService();
    const token = createAtlasLocalSessionToken("atlas-local-session-secret", createAtlasLocalSessionSelection("buyer-admin"), {
      issuedAt: "2026-04-12T00:00:00.000Z",
      expiresAt: "2026-04-12T00:01:00.000Z"
    });

    const resolution = await service.resolveFromHeaders({
      "x-atlas-local-session": token
    });

    expect(resolution.status).toBe("invalid");
  });

  it("resolves exchanged identity-provider sessions when the provider boundary is enabled", async () => {
    vi.stubEnv("AUTH_PROVIDER_MODE", "identity-bridge");
    vi.stubEnv("AUTH_IDENTITY_BRIDGE_PROVIDER", "generic-sso");

    const { ActorResolutionService } = await import("../src/modules/actor/actor.service");

    prismaMock.authSession.findUnique.mockResolvedValue({
      id: "session-provider-1",
      source: "IDENTITY_PROVIDER",
      authProviderMode: "IDENTITY_BRIDGE",
      provider: "generic-sso",
      providerSubject: "subject-buyer-1",
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
        name: "Atlas Demo Buyer"
      },
      membership: {
        id: "membership-buyer",
        role: "ADMIN"
      }
    });

    const service = new ActorResolutionService();
    const token = createAtlasIdentityProviderSessionToken(
      "atlas-local-session-secret",
      {
        ...createAtlasLocalSessionSelection("buyer-admin"),
        profileKey: null
      },
      {
        provider: "generic-sso",
        sessionId: "session-provider-1",
        issuedAt: "2026-04-12T00:00:00.000Z",
        expiresAt: "2027-04-12T08:00:00.000Z"
      }
    );

    const resolution = await service.resolveFromHeaders({
      "x-atlas-local-session": token
    });

    expect(resolution.status).toBe("ready");
    expect(resolution.status === "ready" ? resolution.actor.source : null).toBe("identity-provider");
    expect(resolution.status === "ready" ? resolution.selection.profileKey : "missing").toBeNull();
    expect(prismaMock.authSession.update).toHaveBeenCalled();
  });
});
