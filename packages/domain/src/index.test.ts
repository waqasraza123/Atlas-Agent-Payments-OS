import { describe, expect, it } from "vitest";
import {
  createAtlasApiDomainSnapshot,
  getAtlasApiDomainDefinition,
  getAtlasWorkspaceSurfaceByHref,
  getAtlasWorkspaceSurfaceByKey,
  isTerminalSpendRequestStatus,
  listAtlasApiDomainDefinitionsForWorkspace,
  listAtlasWorkspaceSurfaces
} from "./index";

describe("atlas domain registry", () => {
  it("returns buyer workspace surfaces with durable routes", () => {
    const surfaces = listAtlasWorkspaceSurfaces("BUYER");

    expect(surfaces.map((surface) => surface.href)).toEqual([
      "/buyer",
      "/buyer/agents",
      "/buyer/policies",
      "/buyer/requests",
      "/buyer/approvals",
      "/buyer/activity"
    ]);
  });

  it("resolves workspace surfaces by key and href", () => {
    expect(getAtlasWorkspaceSurfaceByKey("SELLER", "services")?.href).toBe("/seller/services");
    expect(getAtlasWorkspaceSurfaceByHref("OPERATOR", "/operator/audit")?.key).toBe("audit");
  });

  it("creates API domain snapshots with actor context", () => {
    expect(getAtlasApiDomainDefinition("payments").ownerWorkspaces).toEqual(["BUYER", "SELLER", "OPERATOR"]);

    expect(
      createAtlasApiDomainSnapshot("payments", {
        actorRole: "FINANCE",
        workspace: "BUYER"
      })
    ).toMatchObject({
      key: "payments",
      actorRole: "FINANCE",
      workspace: "BUYER"
    });
  });

  it("filters domain modules by workspace ownership", () => {
    const operatorModules = listAtlasApiDomainDefinitionsForWorkspace("OPERATOR").map((definition) => definition.key);

    expect(operatorModules).toContain("organizations");
    expect(operatorModules).toContain("operator-controls");
    expect(operatorModules).not.toContain("agents");
  });

  it("distinguishes terminal and non-terminal request states", () => {
    expect(isTerminalSpendRequestStatus("COMPLETED")).toBe(true);
    expect(isTerminalSpendRequestStatus("FAILED")).toBe(true);
    expect(isTerminalSpendRequestStatus("SUBMITTED")).toBe(false);
  });
});
