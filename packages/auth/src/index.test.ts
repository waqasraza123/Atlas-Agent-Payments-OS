import { describe, expect, it } from "vitest";
import {
  canAtlasActorAccessWorkspace,
  createAtlasLocalSessionSelection,
  getDefaultAtlasLocalSessionProfileForWorkspace,
  parseAtlasLocalSessionSelection,
  serializeAtlasLocalSessionSelection
} from "./index";

describe("atlas auth session utilities", () => {
  it("round-trips a local session selection", () => {
    const selection = createAtlasLocalSessionSelection("buyer-owner", {
      agentId: "agent-123"
    });
    const serialized = serializeAtlasLocalSessionSelection(selection);

    expect(parseAtlasLocalSessionSelection(serialized)).toEqual(selection);
  });

  it("returns null for malformed selections", () => {
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
    expect(getDefaultAtlasLocalSessionProfileForWorkspace("OPERATOR")?.key).toBe("operator-operator");
  });

  it("enforces workspace and organization-kind alignment", () => {
    expect(canAtlasActorAccessWorkspace("OWNER", "BUYER", "BUYER")).toBe(true);
    expect(canAtlasActorAccessWorkspace("ADMIN", "SELLER", "SELLER")).toBe(true);
    expect(canAtlasActorAccessWorkspace("FINANCE", "OPERATOR", "OPERATOR")).toBe(false);
    expect(canAtlasActorAccessWorkspace("OWNER", "BUYER", "SELLER")).toBe(false);
  });
});
