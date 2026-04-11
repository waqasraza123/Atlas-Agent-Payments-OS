import { describe, expect, it } from "vitest";
import { getAtlasWorkspaceDetailHref } from "./detail-hrefs";

describe("getAtlasWorkspaceDetailHref", () => {
  it("returns the correct buyer request detail href", () => {
    expect(getAtlasWorkspaceDetailHref("BUYER", "requests", "request-1")).toBe("/buyer/requests/request-1");
  });

  it("returns the correct seller payment detail href", () => {
    expect(getAtlasWorkspaceDetailHref("SELLER", "payments", "payment-1")).toBe("/seller/payments/payment-1");
  });

  it("returns null for surfaces without detail routes", () => {
    expect(getAtlasWorkspaceDetailHref("BUYER", "policies", "policy-1")).toBeNull();
  });
});
