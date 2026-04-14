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
  listObservabilityIncidentTriggers: vi.fn(async () => []),
  syncObservabilityIncidentTriggers: vi.fn(async () => ({
    items: [],
    createdCount: 1,
    resolvedCount: 0,
    activeCount: 1
  })),
  applyObservabilityRetentionPolicy: vi.fn(async () => ({
    deletedSnapshotRecords: 0,
    deletedDispatchRecords: 0,
    deletedResolvedIncidentTriggerRecords: 0,
    deletedSnapshotArtifacts: 0,
    deletedDispatchArtifacts: 0,
    deletedIncidentArtifacts: 0,
    deletedAutomationArtifacts: 0
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
          traceCount: 8,
          traceCoverageRate: 1,
          queues: [],
          recentTraces: []
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
          tracedRequestCount: 42,
          traceCoverageRate: 1,
          averageDurationMs: 24,
          maxDurationMs: 120,
          inFlightRequests: 1,
          lastReadinessStatus: "ready",
          lastReadinessAt: "2026-04-13T00:05:00.000Z",
          routeMetrics: [],
          recentTraces: [],
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
          traceCount: 8,
          traceCoverageRate: 1,
          queues: [],
          recentTraces: []
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
    expect(observabilityOperationsMock.syncObservabilityIncidentTriggers).toHaveBeenCalled();
    expect(observabilityOperationsMock.dispatchObservabilityAlerts).toHaveBeenCalled();
    expect(observabilityOperationsMock.applyObservabilityRetentionPolicy).toHaveBeenCalled();
    expect(result.snapshot.id).toBe("snapshot-automation-1");
    expect(result.incidentTriggers?.activeCount).toBe(1);
    expect(result.dispatch?.id).toBe("dispatch-automation-1");
    expect(existsSync(result.reportPath)).toBe(true);
    expect(readFileSync(result.reportPath, "utf8")).toContain("snapshot-automation-1");
  });

  it("recovers degraded telemetry ownership by refreshing automation cadence", async () => {
    const runtimeSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-runtime-recovery-"));
    const automationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-automation-recovery-"));
    vi.stubEnv("OBSERVABILITY_RUNTIME_SNAPSHOT_DIR", runtimeSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_REPORT_DIR", automationSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_SCHEDULE_MODE", "interval");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_INTERVAL_MINUTES", "20");
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
          tracedRequestCount: 42,
          traceCoverageRate: 1,
          averageDurationMs: 24,
          maxDurationMs: 120,
          inFlightRequests: 1,
          lastReadinessStatus: "ready",
          lastReadinessAt: "2026-04-13T00:05:00.000Z",
          routeMetrics: [],
          recentTraces: [],
          configurationStatus: "valid",
          verificationCommand: "pnpm verify:release",
          revision: "rev-123",
          deploymentSlot: "blue",
          recordedAt: "2026-04-13T00:11:00.000Z"
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
          recordedAt: "2026-04-13T00:11:00.000Z",
          uptimeSeconds: 300,
          revision: "rev-123",
          deploymentSlot: "blue",
          queueCount: 2,
          readyQueueCount: 2,
          processedCount: 8,
          failedCount: 0,
          traceCount: 8,
          traceCoverageRate: 1,
          queues: [],
          recentTraces: []
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

    const { recoverObservabilityTelemetryOwnership } = await import("./observability-runtime");
    const result = await recoverObservabilityTelemetryOwnership(
      {
        actorUserEmail: "operator-admin@atlas.local",
        reason: "Recover telemetry ownership before the next operator handoff.",
        now: "2026-04-13T00:12:00.000Z"
      },
      client as never
    );

    expect(result.status).toBe("recovered");
    expect(result.recoveredKeys).toEqual(["automation-cadence"]);
    expect(result.remainingKeys).toEqual([]);
    expect(result.beforeOwnership.find((item) => item.key === "automation-cadence")?.status).toBe("critical");
    expect(result.afterOwnership.find((item) => item.key === "automation-cadence")?.status).toBe("healthy");
    expect(existsSync(result.reportPath)).toBe(true);
    expect(readFileSync(result.reportPath, "utf8")).toContain('"telemetryPolicy": "recover"');
    expect(result.automation?.snapshot.id).toBe("snapshot-automation-1");
  });

  it("syncs and dispatches partial telemetry recovery alerts in the same cycle", async () => {
    const runtimeSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-runtime-recovery-partial-"));
    const automationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-automation-recovery-partial-"));
    vi.stubEnv("OBSERVABILITY_RUNTIME_SNAPSHOT_DIR", runtimeSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_REPORT_DIR", automationSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_SCHEDULE_MODE", "interval");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_INTERVAL_MINUTES", "20");
    vi.stubEnv("OBSERVABILITY_WORKER_STALE_AFTER_MINUTES", "10");
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
          tracedRequestCount: 42,
          traceCoverageRate: 1,
          averageDurationMs: 24,
          maxDurationMs: 120,
          inFlightRequests: 1,
          lastReadinessStatus: "ready",
          lastReadinessAt: "2026-04-13T00:05:00.000Z",
          routeMetrics: [],
          recentTraces: [],
          configurationStatus: "valid",
          verificationCommand: "pnpm verify:release",
          revision: "rev-123",
          deploymentSlot: "blue",
          recordedAt: "2026-04-13T00:11:00.000Z"
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
          recordedAt: "2026-04-13T00:00:00.000Z",
          uptimeSeconds: 300,
          revision: "rev-123",
          deploymentSlot: "blue",
          queueCount: 2,
          readyQueueCount: 2,
          processedCount: 8,
          failedCount: 0,
          traceCount: 8,
          traceCoverageRate: 1,
          queues: [],
          recentTraces: []
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

    const { recoverObservabilityTelemetryOwnership } = await import("./observability-runtime");
    const result = await recoverObservabilityTelemetryOwnership(
      {
        actorUserEmail: "operator-admin@atlas.local",
        reason: "Recover telemetry ownership before the next operator handoff.",
        dispatchAlerts: true,
        now: "2026-04-13T00:12:00.000Z"
      },
      client as never
    );

    expect(result.status).toBe("partial");
    expect(observabilityOperationsMock.syncObservabilityIncidentTriggers).toHaveBeenCalledWith(
      expect.objectContaining({
        alerts: expect.arrayContaining([
          expect.objectContaining({
            id: "telemetry-recovery-incomplete"
          }),
          expect.objectContaining({
            id: "telemetry-ownership-worker-runtime"
          })
        ])
      }),
      client
    );
    expect(observabilityOperationsMock.dispatchObservabilityAlerts).toHaveBeenCalledWith(
      expect.objectContaining({
        alerts: expect.arrayContaining([
          expect.objectContaining({
            id: "telemetry-recovery-incomplete"
          })
        ])
      }),
      client
    );
  });

  it("skips telemetry recovery when ownership is already healthy", async () => {
    const runtimeSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-runtime-recovery-healthy-"));
    const automationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-automation-recovery-healthy-"));
    vi.stubEnv("OBSERVABILITY_RUNTIME_SNAPSHOT_DIR", runtimeSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_REPORT_DIR", automationSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_SCHEDULE_MODE", "interval");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_INTERVAL_MINUTES", "20");
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
          tracedRequestCount: 42,
          traceCoverageRate: 1,
          averageDurationMs: 24,
          maxDurationMs: 120,
          inFlightRequests: 1,
          lastReadinessStatus: "ready",
          lastReadinessAt: "2026-04-13T00:05:00.000Z",
          routeMetrics: [],
          recentTraces: [],
          configurationStatus: "valid",
          verificationCommand: "pnpm verify:release",
          revision: "rev-123",
          deploymentSlot: "blue",
          recordedAt: "2026-04-13T00:11:00.000Z"
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
          recordedAt: "2026-04-13T00:11:00.000Z",
          uptimeSeconds: 300,
          revision: "rev-123",
          deploymentSlot: "blue",
          queueCount: 2,
          readyQueueCount: 2,
          processedCount: 8,
          failedCount: 0,
          traceCount: 8,
          traceCoverageRate: 1,
          queues: [],
          recentTraces: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    writeFileSync(
      join(automationSandbox, "2026-04-13T00-10-00-000Z-observability-automation.json"),
      `${JSON.stringify(
        {
          version: 1,
          status: "SUCCEEDED",
          trigger: "scheduled",
          generatedAt: "2026-04-13T00:10:00.000Z",
          actorUserEmail: "operator-admin@atlas.local",
          reason: "Run scheduled observability automation for the current release slot.",
          minimumSeverity: "warning",
          dispatchAlerts: false,
          triggerIncidents: true,
          alertCount: 2,
          workerTelemetry: {
            status: "healthy"
          },
          snapshot: {
            id: "snapshot-1"
          },
          incidentTriggers: {
            activeCount: 1
          },
          dispatch: null
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

    const { recoverObservabilityTelemetryOwnership } = await import("./observability-runtime");
    const result = await recoverObservabilityTelemetryOwnership(
      {
        actorUserEmail: "operator-admin@atlas.local",
        reason: "Check whether telemetry ownership still needs intervention.",
        now: "2026-04-13T00:12:00.000Z"
      },
      client as never
    );

    expect(result.status).toBe("no_action");
    expect(existsSync(result.reportPath)).toBe(true);
    expect(readFileSync(result.reportPath, "utf8")).toContain('"status": "no_action"');
    expect(result.automation).toBeNull();
    expect(result.recoveredKeys).toEqual([]);
    expect(result.remainingKeys).toEqual([]);
  });

  it("lists automation history and current scheduler posture from stored reports", async () => {
    const runtimeSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-runtime-status-"));
    const automationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-automation-history-"));
    vi.stubEnv("OBSERVABILITY_RUNTIME_SNAPSHOT_DIR", runtimeSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_REPORT_DIR", automationSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_SCHEDULE_MODE", "interval");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_INTERVAL_MINUTES", "20");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_STARTUP_DELAY_SECONDS", "45");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_TELEMETRY_POLICY", "recover");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_ACTOR_USER_EMAIL", "operator-admin@atlas.local");
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
          tracedRequestCount: 42,
          traceCoverageRate: 1,
          averageDurationMs: 24,
          maxDurationMs: 120,
          inFlightRequests: 1,
          lastReadinessStatus: "ready",
          lastReadinessAt: "2026-04-13T00:05:00.000Z",
          routeMetrics: [],
          recentTraces: [],
          configurationStatus: "valid",
          verificationCommand: "pnpm verify:release",
          revision: "rev-123",
          deploymentSlot: "blue",
          recordedAt: "2026-04-13T00:11:00.000Z"
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
          recordedAt: "2026-04-13T00:11:00.000Z",
          uptimeSeconds: 300,
          revision: "rev-123",
          deploymentSlot: "blue",
          queueCount: 2,
          readyQueueCount: 2,
          processedCount: 8,
          failedCount: 0,
          traceCount: 8,
          traceCoverageRate: 1,
          queues: [],
          recentTraces: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    writeFileSync(
      join(automationSandbox, "2026-04-13T00-10-00-000Z-observability-automation.json"),
      `${JSON.stringify(
        {
          version: 1,
          status: "SUCCEEDED",
          trigger: "scheduled",
          generatedAt: "2026-04-13T00:10:00.000Z",
          actorUserEmail: "operator-admin@atlas.local",
          reason: "Run scheduled observability automation for the current release slot.",
          minimumSeverity: "warning",
          dispatchAlerts: false,
          triggerIncidents: true,
          telemetryPolicy: "recover",
          telemetryRecovery: {
            status: "partial",
            recoveredKeys: ["automation-cadence"],
            remainingKeys: ["worker-runtime"]
          },
          alertCount: 2,
          workerTelemetry: {
            status: "healthy"
          },
          snapshot: {
            id: "snapshot-1"
          },
          incidentTriggers: {
            activeCount: 1
          },
          dispatch: null
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const { getObservabilityAutomationStatus, listObservabilityAutomationRuns } = await import("./observability-runtime");
    const actor = {
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
      },
      membership: {
        id: "membership-operator",
        role: "ADMIN"
      },
      workspace: "OPERATOR",
      agentId: null,
      source: "identity-provider",
      providerMode: "external-oidc",
      sessionId: "session-1"
    } as const;

    const runs = listObservabilityAutomationRuns(actor, {
      limit: 5
    });
    const status = getObservabilityAutomationStatus(actor, {
      limit: 5,
      now: "2026-04-13T00:12:00.000Z"
    });

    expect(runs[0]).toMatchObject({
      status: "SUCCEEDED",
      trigger: "scheduled",
      telemetryPolicy: "recover",
      telemetryRecoveryStatus: "partial",
      recoveredOwnershipCount: 1,
      remainingOwnershipCount: 1,
      snapshotId: "snapshot-1"
    });
    expect(status).toMatchObject({
      scheduleMode: "interval",
      intervalMinutes: 20,
      telemetryPolicy: "recover",
      telemetryRecoveryEscalation: {
        status: "idle",
        consecutiveBreachedRuns: 1,
        threshold: 2,
        detail: "Telemetry auto-recovery has breached its target for 1 consecutive run, below the escalation threshold of 2."
      },
      actorUserEmail: "operator-admin@atlas.local",
      dispatchProvider: "generic-webhook",
      dispatchDeliveryKind: "alert-dispatch",
      lastRunStatus: "SUCCEEDED"
    });
    expect(status.telemetryOwnership).toEqual([
      expect.objectContaining({
        key: "api-runtime",
        status: "healthy",
        lastRecordedAt: "2026-04-13T00:11:00.000Z"
      }),
      expect.objectContaining({
        key: "worker-runtime",
        status: "healthy",
        lastRecordedAt: "2026-04-13T00:11:00.000Z"
      }),
      expect.objectContaining({
        key: "automation-cadence",
        status: "healthy",
        lastRecordedAt: "2026-04-13T00:10:00.000Z"
      })
    ]);
  });

  it("marks telemetry recovery escalation triggered after repeated breached recovery runs", async () => {
    const runtimeSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-runtime-escalation-"));
    const automationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-automation-escalation-"));
    vi.stubEnv("OBSERVABILITY_RUNTIME_SNAPSHOT_DIR", runtimeSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_REPORT_DIR", automationSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_SCHEDULE_MODE", "interval");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_INTERVAL_MINUTES", "20");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_TELEMETRY_POLICY", "recover");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_TELEMETRY_ESCALATION_THRESHOLD", "2");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_ACTOR_USER_EMAIL", "operator-admin@atlas.local");
    writeFileSync(
      join(automationSandbox, "2026-04-13T00-10-00-000Z-observability-automation.json"),
      `${JSON.stringify(
        {
          version: 1,
          status: "FAILED",
          trigger: "scheduled",
          generatedAt: "2026-04-13T00:10:00.000Z",
          actorUserEmail: "operator-admin@atlas.local",
          reason: "Recover degraded telemetry ownership during the current release slot.",
          minimumSeverity: "warning",
          dispatchAlerts: false,
          triggerIncidents: true,
          telemetryPolicy: "recover",
          telemetryRecovery: {
            status: "failed",
            recoveredKeys: [],
            remainingKeys: ["automation-cadence"]
          },
          errorMessage: "Published API runtime snapshot is missing."
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    writeFileSync(
      join(automationSandbox, "2026-04-13T00-05-00-000Z-observability-automation.json"),
      `${JSON.stringify(
        {
          version: 1,
          status: "SUCCEEDED",
          trigger: "scheduled",
          generatedAt: "2026-04-13T00:05:00.000Z",
          actorUserEmail: "operator-admin@atlas.local",
          reason: "Recover degraded telemetry ownership during the current release slot.",
          minimumSeverity: "warning",
          dispatchAlerts: false,
          triggerIncidents: true,
          telemetryPolicy: "recover",
          telemetryRecovery: {
            status: "unchanged",
            recoveredKeys: [],
            remainingKeys: ["automation-cadence"]
          },
          snapshot: {
            id: "snapshot-2"
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const { getObservabilityAutomationStatus } = await import("./observability-runtime");
    const actor = {
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
      },
      membership: {
        id: "membership-operator",
        role: "ADMIN"
      },
      workspace: "OPERATOR",
      agentId: null,
      source: "identity-provider",
      providerMode: "external-oidc",
      sessionId: "session-1"
    } as const;

    const status = getObservabilityAutomationStatus(actor, {
      limit: 5,
      now: "2026-04-13T00:12:00.000Z"
    });

    expect(status.telemetryRecoveryEscalation).toEqual({
      status: "triggered",
      consecutiveBreachedRuns: 2,
      threshold: 2,
      detail: "Telemetry auto-recovery has breached its target for 2 consecutive runs."
    });
  });
});
