import { describe, expect, it } from "vitest";
import {
  canAtlasActorAccessWorkspace,
  canAtlasSupportAccessMethod,
  createAtlasLocalSessionSelection,
  createAtlasSupportAccessRecord,
  getDefaultAtlasLocalSessionProfileForWorkspace,
  parseAtlasLocalSessionSelection,
  serializeAtlasLocalSessionSelection
} from "./index";
import { createAtlasLocalSessionToken, createAtlasSupportSessionToken, verifyAtlasSignedSessionToken } from "./server";

const sessionSecret = "atlas-test-secret";

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
});
