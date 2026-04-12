import { atlasLocalSessionCookieName } from "@atlas/auth";
import {
  createAtlasIdentityAssertionTokenForSelection,
  verifyAtlasSignedSessionToken
} from "@atlas/auth/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authRuntime } from "@atlas/config";
import { DELETE, POST } from "./route";

const exchangeIdentityAssertionForSessionMock = vi.fn();

vi.mock("@atlas/database", () => ({
  exchangeIdentityAssertionForSession: exchangeIdentityAssertionForSessionMock
}));

async function createRequest(formEntries: Array<[string, string]>) {
  const formData = new FormData();

  for (const [key, value] of formEntries) {
    formData.set(key, value);
  }

  return new Request("http://localhost:3000/auth/session", {
    method: "POST",
    body: formData
  });
}

describe("local session route", () => {
  afterEach(() => {
    exchangeIdentityAssertionForSessionMock.mockReset();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("redirects to the root path for an invalid redirect target", async () => {
    const response = await POST(
      await createRequest([
        ["profileKey", "buyer-owner"],
        ["redirectTo", "https://example.com"]
      ])
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("does not set a cookie for an invalid session profile", async () => {
    const response = await POST(
      await createRequest([
        ["profileKey", "invalid-profile"],
        ["redirectTo", "/buyer"]
      ])
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/buyer");
    expect(response.cookies.get(atlasLocalSessionCookieName)).toBeUndefined();
  });

  it("sets the local session cookie for a valid profile", async () => {
    const response = await POST(
      await createRequest([
        ["profileKey", "seller-admin"],
        ["redirectTo", "/seller"]
      ])
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/seller");
    const cookieValue = response.cookies.get(atlasLocalSessionCookieName)?.value;

    expect(cookieValue).toBeTruthy();
    expect(verifyAtlasSignedSessionToken(authRuntime.sessionSigningSecret, cookieValue).status).toBe("ready");
  });

  it("clears the local session cookie on delete", async () => {
    const response = await DELETE(new Request("http://localhost:3000/auth/session?redirectTo=/operator"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/operator");
  });

  it("clears the local session cookie through the post intent path", async () => {
    const response = await POST(
      await createRequest([
        ["intent", "clear"],
        ["redirectTo", "/operator/support-access"]
      ])
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/operator/support-access");
  });

  it("does not create a local session outside local and development environments", async () => {
    vi.stubEnv("APP_ENV", "staging");
    const { POST: stagingPost } = await import("./route");

    const response = await stagingPost(
      await createRequest([
        ["profileKey", "seller-admin"],
        ["redirectTo", "/seller"]
      ])
    );

    expect(response.status).toBe(307);
    expect(response.cookies.get(atlasLocalSessionCookieName)).toBeUndefined();
  });

  it("does not create a local session when the auth provider mode is identity-bridge", async () => {
    vi.stubEnv("AUTH_PROVIDER_MODE", "identity-bridge");
    const { POST: providerPost } = await import("./route");

    const response = await providerPost(
      await createRequest([
        ["profileKey", "seller-admin"],
        ["redirectTo", "/seller"]
      ])
    );

    expect(response.status).toBe(307);
    expect(response.cookies.get(atlasLocalSessionCookieName)).toBeUndefined();
  });

  it("exchanges an identity assertion into a persisted provider session cookie", async () => {
    vi.stubEnv("AUTH_PROVIDER_MODE", "identity-bridge");
    vi.stubEnv("AUTH_IDENTITY_BRIDGE_SECRET", "atlas-identity-bridge-secret");
    vi.stubEnv("AUTH_IDENTITY_BRIDGE_PROVIDER", "generic-sso");
    vi.stubEnv("AUTH_IDENTITY_SESSION_TTL_MINUTES", "480");
    exchangeIdentityAssertionForSessionMock.mockResolvedValue({
      id: "session-provider-1",
      provider: "generic-sso",
      expiresAt: "2026-04-12T08:00:00.000Z"
    });

    const { POST: exchangePost } = await import("../provider-exchange/route");
    const assertionToken = createAtlasIdentityAssertionTokenForSelection(
      "atlas-identity-bridge-secret",
      {
        profileKey: null,
        workspace: "BUYER",
        userEmail: "buyer-admin@atlas.local",
        organizationSlug: "atlas-demo-buyer",
        role: "ADMIN",
        agentId: null
      },
      {
        subject: "subject-1",
        provider: "generic-sso",
        userName: "Buyer Admin",
        issuedAt: "2026-04-12T00:00:00.000Z",
        expiresAt: "2026-04-12T08:00:00.000Z"
      }
    );

    const formData = new FormData();
    formData.set("assertionToken", assertionToken);
    formData.set("redirectTo", "/buyer");

    const response = await exchangePost(
      new Request("http://localhost:3000/auth/provider-exchange", {
        method: "POST",
        body: formData
      })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/buyer");
    expect(response.cookies.get(atlasLocalSessionCookieName)?.value).toBeTruthy();
    expect(exchangeIdentityAssertionForSessionMock).toHaveBeenCalledTimes(1);
  });
});
