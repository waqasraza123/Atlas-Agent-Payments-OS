import "reflect-metadata";
import { createAtlasLocalSessionSelection, createAtlasSupportAccessRecord } from "@atlas/auth";
import {
  createAtlasIdentityAssertionTokenForSelection,
  createAtlasLocalSessionToken,
  createAtlasSupportSessionToken
} from "@atlas/auth/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  membership: {
    findFirst: vi.fn()
  },
  supportAccessGrant: {
    findUnique: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock("@atlas/database", () => ({
  prisma: prismaMock
}));

describe("actor resolution service", () => {
  beforeEach(() => {
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

  it("resolves a support session into a target tenant while preserving operator principal context", async () => {
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
      expiresAt: new Date("2026-04-13T01:00:00.000Z"),
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

  it("resolves identity assertion headers when the provider boundary is enabled", async () => {
    vi.stubEnv("AUTH_PROVIDER_MODE", "identity-bridge");
    vi.stubEnv("AUTH_IDENTITY_BRIDGE_SECRET", "atlas-identity-bridge-secret");
    vi.stubEnv("AUTH_IDENTITY_BRIDGE_PROVIDER", "generic-sso");

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
    const token = createAtlasIdentityAssertionTokenForSelection(
      "atlas-identity-bridge-secret",
      {
        ...createAtlasLocalSessionSelection("buyer-admin"),
        profileKey: null
      },
      {
        subject: "subject-buyer-1",
        provider: "generic-sso",
        userName: "Buyer Admin"
      }
    );

    const resolution = await service.resolveFromHeaders({
      "x-atlas-auth-assertion": token
    });

    expect(resolution.status).toBe("ready");
    expect(resolution.status === "ready" ? resolution.actor.source : null).toBe("identity-bridge");
    expect(resolution.status === "ready" ? resolution.selection.profileKey : "missing").toBeNull();
  });
});
