import { atlasLocalSessionCookieName } from "@atlas/auth";
import { describe, expect, it } from "vitest";
import { POST } from "./route";

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
    expect(response.cookies.get(atlasLocalSessionCookieName)?.value).toBeTruthy();
  });
});
