import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canAtlasActorAccessWorkspace,
  canAtlasActorExportData,
  canAtlasActorMutate,
  canAtlasSupportAccessMethod,
  createAtlasLocalSessionSelection,
  createAtlasSupportAccessRecord,
  getDefaultAtlasLocalSessionProfileForWorkspace,
  parseAtlasLocalSessionSelection,
  serializeAtlasLocalSessionSelection
} from "./index";
import {
  createAtlasIdentityAssertionTokenForSelection,
  createAtlasExternalIdentityTokenForSelection,
  createAtlasIdentityProviderSessionToken,
  createAtlasLocalSessionToken,
  createAtlasSupportSessionToken,
  verifyAtlasExternalIdentityToken,
  verifyAtlasIdentityAssertionToken,
  verifyAtlasSignedSessionToken
} from "./server";

const sessionSecret = "atlas-test-secret";
const externalOidcKeyPair = generateKeyPairSync("rsa", {
  modulusLength: 2048
});
const externalOidcPublicJwk = externalOidcKeyPair.publicKey.export({
  format: "jwk"
}) as Record<string, unknown>;

describe("atlas auth session utilities", () => {
  it("round-trips a raw local session selection", () => {
    const selection = createAtlasLocalSessionSelection("buyer-owner", {
      agentId: "agent-123"
    });
    const serialized = serializeAtlasLocalSessionSelection(selection);

    expect(parseAtlasLocalSessionSelection(serialized)).toEqual(selection);
  });

  it("verifies a signed local session token", () => {
    const token = createAtlasLocalSessionToken(sessionSecret, createAtlasLocalSessionSelection("buyer-admin"), {
      issuedAt: "2026-04-12T00:00:00.000Z",
      expiresAt: "2026-04-12T08:00:00.000Z"
    });
    const verification = verifyAtlasSignedSessionToken(sessionSecret, token, new Date("2026-04-12T01:00:00.000Z"));

    expect(verification.status).toBe("ready");
    expect(verification.status === "ready" ? verification.payload.source : null).toBe("local-development");
  });

  it("rejects tampered or expired signed session tokens", () => {
    const token = createAtlasLocalSessionToken(sessionSecret, createAtlasLocalSessionSelection("seller-admin"), {
      issuedAt: "2026-04-12T00:00:00.000Z",
      expiresAt: "2026-04-12T08:00:00.000Z"
    });

    expect(verifyAtlasSignedSessionToken(sessionSecret, `${token}tampered`).status).toBe("invalid");
    expect(verifyAtlasSignedSessionToken(sessionSecret, token, new Date("2026-04-12T09:00:00.000Z")).status).toBe("expired");
  });

  it("verifies internal support sessions and enforces read-only support methods", () => {
    const supportAccess = createAtlasSupportAccessRecord({
      grantId: "grant-support-1",
      targetOrganizationSlug: "atlas-demo-buyer",
      targetWorkspace: "BUYER",
      reason: "Investigate a delayed receipt and settlement mismatch.",
      grantedByUserEmail: "operator@atlas.local"
    });
    const token = createAtlasSupportSessionToken(
      sessionSecret,
      createAtlasLocalSessionSelection("operator-operator"),
      supportAccess,
      {
        issuedAt: "2026-04-12T00:00:00.000Z",
        expiresAt: "2026-04-12T01:00:00.000Z"
      }
    );
    const verification = verifyAtlasSignedSessionToken(sessionSecret, token, new Date("2026-04-12T00:15:00.000Z"));

    expect(verification.status).toBe("ready");
    expect(verification.status === "ready" ? verification.payload.supportAccess?.targetWorkspace : null).toBe("BUYER");
    expect(canAtlasSupportAccessMethod("GET")).toBe(true);
    expect(canAtlasSupportAccessMethod("POST")).toBe(false);
  });

  it("verifies identity assertion tokens for the provider boundary", () => {
    const token = createAtlasIdentityAssertionTokenForSelection(
      sessionSecret,
      {
        ...createAtlasLocalSessionSelection("buyer-admin"),
        profileKey: null
      },
      {
        subject: "subject-123",
        provider: "generic-sso",
        userName: "Buyer Admin",
        issuedAt: "2026-04-12T00:00:00.000Z",
        expiresAt: "2026-04-12T00:15:00.000Z"
      }
    );

    const verification = verifyAtlasIdentityAssertionToken(sessionSecret, token, new Date("2026-04-12T00:10:00.000Z"));

    expect(verification.status).toBe("ready");
    expect(verification.status === "ready" ? verification.payload.source : null).toBe("identity-bridge");
    expect(verification.status === "ready" ? verification.payload.selection.profileKey : "missing").toBeNull();
  });

  it("verifies exchanged identity-provider session tokens", () => {
    const token = createAtlasIdentityProviderSessionToken(
      sessionSecret,
      {
        ...createAtlasLocalSessionSelection("buyer-admin"),
        profileKey: null
      },
      {
        sessionId: "session-123",
        provider: "generic-sso",
        issuedAt: "2026-04-12T00:00:00.000Z",
        expiresAt: "2026-04-12T08:00:00.000Z"
      }
    );

    const verification = verifyAtlasSignedSessionToken(sessionSecret, token, new Date("2026-04-12T01:00:00.000Z"));

    expect(verification.status).toBe("ready");
    expect(verification.status === "ready" ? verification.payload.source : null).toBe("identity-provider");
    expect(verification.status === "ready" ? verification.payload.sessionId : null).toBe("session-123");
  });

  it("verifies external oidc tokens for direct provider integration", () => {
    const token = createAtlasExternalIdentityTokenForSelection(
      externalOidcKeyPair.privateKey.export({
        format: "pem",
        type: "pkcs8"
      }).toString(),
      {
        ...createAtlasLocalSessionSelection("buyer-admin"),
        profileKey: null
      },
      {
        issuer: "https://id.atlas.example",
        audience: "atlas-agent-payments-os",
        provider: "okta-design-partner",
        subject: "okta-subject-1",
        keyId: "atlas-test-key",
        userName: "Buyer Admin",
        issuedAt: "2026-04-12T00:00:00.000Z",
        expiresAt: "2026-04-12T01:00:00.000Z"
      }
    );

    const verification = verifyAtlasExternalIdentityToken(
      {
        issuer: "https://id.atlas.example",
        audience: "atlas-agent-payments-os",
        provider: "okta-design-partner",
        jwks: [
          {
            ...externalOidcPublicJwk,
            kid: "atlas-test-key"
          }
        ]
      },
      token,
      new Date("2026-04-12T00:30:00.000Z")
    );

    expect(verification.status).toBe("ready");
    expect(verification.status === "ready" ? verification.payload.provider : null).toBe("okta-design-partner");
    expect(verification.status === "ready" ? verification.payload.selection.organizationSlug : null).toBe("atlas-demo-buyer");
  });

  it("returns null for malformed raw selections", () => {
    expect(parseAtlasLocalSessionSelection(undefined)).toBeNull();
    expect(parseAtlasLocalSessionSelection("not-json")).toBeNull();
    expect(
      parseAtlasLocalSessionSelection(
        encodeURIComponent(
          JSON.stringify({
            profileKey: "buyer-owner",
            workspace: "INVALID",
            userEmail: "owner@atlas.local",
            organizationSlug: "atlas-demo-buyer",
            role: "OWNER"
          })
        )
      )
    ).toBeNull();
  });

  it("returns the default local profile for a workspace", () => {
    expect(getDefaultAtlasLocalSessionProfileForWorkspace("BUYER")?.key).toBe("buyer-owner");
    expect(getDefaultAtlasLocalSessionProfileForWorkspace("SELLER")?.key).toBe("seller-admin");
    expect(getDefaultAtlasLocalSessionProfileForWorkspace("OPERATOR")?.key).toBe("operator-admin");
  });

  it("enforces workspace and organization-kind alignment", () => {
    expect(canAtlasActorAccessWorkspace("OWNER", "BUYER", "BUYER")).toBe(true);
    expect(canAtlasActorAccessWorkspace("ADMIN", "SELLER", "SELLER")).toBe(true);
    expect(canAtlasActorAccessWorkspace("FINANCE", "OPERATOR", "OPERATOR")).toBe(false);
    expect(canAtlasActorAccessWorkspace("OWNER", "BUYER", "SELLER")).toBe(false);
  });

  it("blocks write access for support actors", () => {
    const actor = {
        user: { id: "user-1", email: "operator@atlas.local", name: "Operator" },
        organization: { id: "org-1", slug: "atlas-demo-buyer", name: "Buyer", kind: "BUYER" },
        membership: { id: "membership-1", role: "OPERATOR" },
        workspace: "BUYER",
        agentId: null,
        source: "internal-support",
        providerMode: "local-signed",
        sessionId: null,
        principalOrganization: { id: "org-operator", slug: "atlas-demo-operator", name: "Operator", kind: "OPERATOR" },
        supportAccess: createAtlasSupportAccessRecord({
          grantId: "grant-support-1",
          targetOrganizationSlug: "atlas-demo-buyer",
          targetWorkspace: "BUYER",
          reason: "Investigate a delayed receipt and settlement mismatch.",
          grantedByUserEmail: "operator@atlas.local"
        }),
        sessionIssuedAt: "2026-04-12T00:00:00.000Z",
        sessionExpiresAt: "2026-04-12T01:00:00.000Z"
      } as const;

    expect(canAtlasActorMutate(actor)).toBe(false);
    expect(canAtlasActorExportData(actor)).toBe(false);
  });
});
