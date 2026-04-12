import { describe, expect, it } from "vitest";
import {
  createAtlasApiDomainSnapshot,
  createAtlasQueueSnapshot,
  getAtlasApiDomainDefinition,
  getAtlasQueueDefinition,
  getAtlasWorkspaceSurfaceByHref,
  getAtlasWorkspaceSurfaceByKey,
  isTerminalSpendRequestStatus,
  listAtlasApiDomainDefinitionsForWorkspace,
  listAtlasQueueDefinitionsForFamily,
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
      "/buyer/receipts",
      "/buyer/activity",
      "/buyer/wallets"
    ]);
  });

  it("resolves workspace surfaces by key and href", () => {
    expect(getAtlasWorkspaceSurfaceByKey("SELLER", "services")?.href).toBe("/seller/services");
    expect(getAtlasWorkspaceSurfaceByHref("OPERATOR", "/operator/audit")?.key).toBe("audit");
    expect(getAtlasWorkspaceSurfaceByHref("OPERATOR", "/operator/alerts")?.key).toBe("alerts");
    expect(getAtlasWorkspaceSurfaceByHref("OPERATOR", "/operator/support-access")?.key).toBe("support-access");
    expect(getAtlasWorkspaceSurfaceByHref("BUYER", "/buyer/receipts")?.key).toBe("receipts");
  });

  it("creates API domain snapshots with actor context", () => {
    expect(getAtlasApiDomainDefinition("payments").ownerWorkspaces).toEqual(["BUYER", "SELLER", "OPERATOR"]);
    expect(getAtlasApiDomainDefinition("programmable-settlement").routePrefix).toBe("/programmable-settlement");

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
    expect(operatorModules).toContain("observability");
    expect(operatorModules).not.toContain("agents");
  });

  it("distinguishes terminal and non-terminal request states", () => {
    expect(isTerminalSpendRequestStatus("COMPLETED")).toBe(true);
    expect(isTerminalSpendRequestStatus("FAILED")).toBe(true);
    expect(isTerminalSpendRequestStatus("SUBMITTED")).toBe(false);
  });

  it("defines queue families with stable names and retry posture", () => {
    const paymentQueue = getAtlasQueueDefinition("payments-execution");

    expect(paymentQueue.name).toBe("atlas-phase-0-payments-execution");
    expect(paymentQueue.defaultAttempts).toBeGreaterThan(1);

    expect(listAtlasQueueDefinitionsForFamily("approvals").map((queue) => queue.key)).toEqual([
      "approvals-routing",
      "approvals-reminders"
    ]);
  });

  it("creates queue snapshots for platform discovery", () => {
    expect(createAtlasQueueSnapshot("seller-webhooks-delivery")).toMatchObject({
      family: "seller-webhooks",
      readiness: "baseline"
    });
  });
});
