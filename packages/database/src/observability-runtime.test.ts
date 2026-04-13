import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const operatorWorkflowMock = vi.hoisted(() => ({
  getOperatorOverview: vi.fn(async () => ({
    openCaseCount: 2,
    criticalCaseCount: 1,
    actionRequiredCount: 1,
    unreadNotificationCount: 0,
    delayedCaseCount: 1,
    failedCaseCount: 0,
    recentCases: [],
    recentNotifications: [],
    recentAuditEvents: []
  }))
}));

const observabilityOperationsMock = vi.hoisted(() => ({
  AtlasObservabilityOperationsError: class AtlasObservabilityOperationsError extends Error {
    constructor(
      message: string,
      readonly code: "bad_request" | "forbidden" | "execution_failed"
    ) {
      super(message);
      this.name = "AtlasObservabilityOperationsError";
    }
  },
  persistObservabilitySnapshot: vi.fn(async ({ reason }: { reason: string }) => ({
    id: "snapshot-automation-1",
    reason
  })),
  dispatchObservabilityAlerts: vi.fn(async () => ({
    id: "dispatch-automation-1",
    provider: "generic-webhook",
    dispatchedAlertCount: 2
  }))
}));

vi.mock("./operator-workflow", () => operatorWorkflowMock);
vi.mock("./observability-operations", () => observabilityOperationsMock);

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("observability runtime", () => {
  it("reads shared worker telemetry from the published runtime snapshot", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "atlas-observability-runtime-"));
    vi.stubEnv("OBSERVABILITY_RUNTIME_SNAPSHOT_DIR", sandbox);
    writeFileSync(
      join(sandbox, "worker.json"),
      `${JSON.stringify(
        {
          service: "worker",
          startedAt: "2026-04-13T00:00:00.000Z",
          recordedAt: "2026-04-13T00:05:00.000Z",
          uptimeSeconds: 300,
          revision: "rev-123",
          deploymentSlot: "blue",
          queueCount: 2,
          readyQueueCount: 2,
          processedCount: 8,
          failedCount: 0,
          queues: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const { readPublishedWorkerTelemetry } = await import("./observability-runtime");
    const telemetry = readPublishedWorkerTelemetry("2026-04-13T00:10:00.000Z");

    expect(telemetry.status).toBe("healthy");
    expect(telemetry.snapshot?.service).toBe("worker");
    expect(telemetry.snapshot?.queueCount).toBe(2);
  });

  it("runs observability automation from the published API and worker snapshots", async () => {
    const runtimeSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-runtime-"));
    const automationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-automation-"));
    vi.stubEnv("OBSERVABILITY_RUNTIME_SNAPSHOT_DIR", runtimeSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_REPORT_DIR", automationSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_DEFAULT_MINIMUM_SEVERITY", "warning");
    writeFileSync(
      join(runtimeSandbox, "api.json"),
      `${JSON.stringify(
        {
          service: "api",
          startedAt: "2026-04-13T00:00:00.000Z",
          uptimeSeconds: 420,
          totalRequests: 42,
          successCount: 38,
          errorCount: 4,
          averageDurationMs: 24,
          maxDurationMs: 120,
          inFlightRequests: 1,
          lastReadinessStatus: "ready",
          lastReadinessAt: "2026-04-13T00:05:00.000Z",
          routeMetrics: [],
          configurationStatus: "valid",
          verificationCommand: "pnpm verify:release",
          revision: "rev-123",
          deploymentSlot: "blue",
          recordedAt: "2026-04-13T00:05:00.000Z"
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    writeFileSync(
      join(runtimeSandbox, "worker.json"),
      `${JSON.stringify(
        {
          service: "worker",
          startedAt: "2026-04-13T00:00:00.000Z",
          recordedAt: "2026-04-13T00:05:00.000Z",
          uptimeSeconds: 300,
          revision: "rev-123",
          deploymentSlot: "blue",
          queueCount: 2,
          readyQueueCount: 2,
          processedCount: 8,
          failedCount: 0,
          queues: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const client = {
      membership: {
        findFirst: vi.fn(async () => ({
          id: "membership-operator",
          role: "ADMIN",
          user: {
            id: "user-operator",
            email: "operator-admin@atlas.local",
            name: "Operator Admin"
          },
          organization: {
            id: "org-operator",
            slug: "atlas-demo-operator",
            name: "Atlas Demo Operator",
            kind: "OPERATOR"
          }
        }))
      }
    } as const;

    const { executeObservabilityAutomation } = await import("./observability-runtime");
    const result = await executeObservabilityAutomation(
      {
        actorUserEmail: "operator-admin@atlas.local",
        reason: "Run the shared observability automation before the next operator handoff.",
        dispatchAlerts: true
      },
      client as never
    );

    expect(observabilityOperationsMock.persistObservabilitySnapshot).toHaveBeenCalled();
    expect(observabilityOperationsMock.dispatchObservabilityAlerts).toHaveBeenCalled();
    expect(result.snapshot.id).toBe("snapshot-automation-1");
    expect(result.dispatch?.id).toBe("dispatch-automation-1");
    expect(existsSync(result.reportPath)).toBe(true);
    expect(readFileSync(result.reportPath, "utf8")).toContain("snapshot-automation-1");
  });
});
