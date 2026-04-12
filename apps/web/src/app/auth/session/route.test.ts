import { atlasLocalSessionCookieName } from "@atlas/auth";
import { verifyAtlasSignedSessionToken } from "@atlas/auth/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authRuntime } from "@atlas/config";
import { DELETE, POST } from "./route";

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
});
