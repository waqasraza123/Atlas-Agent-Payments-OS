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
    deletedRemediationArtifacts: 0,
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

  it("records telemetry remediation acknowledgement and exposes current ownership", async () => {
    const runtimeSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-runtime-remediation-ack-"));
    const automationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-automation-remediation-ack-"));
    const remediationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-remediation-ack-"));
    vi.stubEnv("OBSERVABILITY_RUNTIME_SNAPSHOT_DIR", runtimeSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_REPORT_DIR", automationSandbox);
    vi.stubEnv("OBSERVABILITY_REMEDIATION_REPORT_DIR", remediationSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_SCHEDULE_MODE", "interval");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_INTERVAL_MINUTES", "20");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_TELEMETRY_POLICY", "recover");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_TELEMETRY_ESCALATION_THRESHOLD", "2");
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

    const { getObservabilityAutomationStatus, recordObservabilityTelemetryRemediationAction } = await import(
      "./observability-runtime"
    );
    const client = {
      notification: {
        upsert: vi.fn(async () => undefined)
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;
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

    const action = await recordObservabilityTelemetryRemediationAction(actor, {
      action: "ACKNOWLEDGED",
      reason: "Taking ownership of the current telemetry remediation issue.",
      now: "2026-04-13T00:12:00.000Z"
    }, client as never);
    const status = getObservabilityAutomationStatus(actor, {
      limit: 5,
      now: "2026-04-13T00:12:30.000Z"
    });

    expect(action).toMatchObject({
      action: "ACKNOWLEDGED",
      remediationStatus: "escalated"
    });
    expect(status.telemetryRemediationOwnership).toMatchObject({
      status: "acknowledged",
      actorUserEmail: "operator-admin@atlas.local"
    });
    expect(status.telemetryRemediationFollowUp).toMatchObject({
      status: "ready",
      thresholdMinutes: 60,
      ageMinutes: 1
    });
    expect(status.recentTelemetryRemediationActions[0]).toMatchObject({
      action: "ACKNOWLEDGED",
      reason: "Taking ownership of the current telemetry remediation issue.",
      resolvedIncidentTriggerCount: 0,
      activeIncidentTriggerCount: 0
    });
    expect(client.notification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          category: "observability-remediation",
          status: "UNREAD"
        }),
        update: expect.objectContaining({
          description: expect.stringContaining("acknowledged"),
          status: "UNREAD"
        })
      })
    );
    expect(client.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "observability.telemetry_remediation_acknowledged",
          targetType: "ObservabilityRemediation"
        })
      })
    );
  });

  it("assigns telemetry remediation to a validated operator owner", async () => {
    const runtimeSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-runtime-remediation-assign-"));
    const automationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-automation-remediation-assign-"));
    const remediationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-remediation-assign-"));
    vi.stubEnv("OBSERVABILITY_RUNTIME_SNAPSHOT_DIR", runtimeSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_REPORT_DIR", automationSandbox);
    vi.stubEnv("OBSERVABILITY_REMEDIATION_REPORT_DIR", remediationSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_SCHEDULE_MODE", "interval");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_INTERVAL_MINUTES", "20");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_TELEMETRY_POLICY", "recover");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_TELEMETRY_ESCALATION_THRESHOLD", "2");
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

    const { getObservabilityAutomationStatus, recordObservabilityTelemetryRemediationAction } = await import(
      "./observability-runtime"
    );
    const client = {
      membership: {
        findFirst: vi.fn(async () => ({
          id: "membership-oncall",
          role: "OPERATOR",
          user: {
            id: "user-oncall",
            email: "oncall-operator@atlas.local",
            name: "Oncall Operator"
          }
        }))
      },
      notification: {
        upsert: vi.fn(async () => undefined)
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;
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

    const action = await recordObservabilityTelemetryRemediationAction(
      actor,
      {
        action: "ASSIGNED",
        ownerUserEmail: "oncall-operator@atlas.local",
        reason: "Assign telemetry remediation to the current operator on call.",
        now: "2026-04-13T00:12:00.000Z"
      },
      client as never
    );
    const status = getObservabilityAutomationStatus(actor, {
      limit: 5,
      now: "2026-04-13T00:12:30.000Z"
    });

    expect(action).toMatchObject({
      action: "ASSIGNED",
      ownerUserEmail: "oncall-operator@atlas.local"
    });
    expect(status.telemetryRemediationOwnership).toMatchObject({
      status: "acknowledged",
      actorUserEmail: "oncall-operator@atlas.local",
      assignedByUserEmail: "operator-admin@atlas.local",
      handoffAction: "ASSIGNED"
    });
    expect(status.telemetryRemediationFollowUp).toMatchObject({
      status: "ready",
      ageMinutes: 1
    });
    expect(client.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "observability.telemetry_remediation_assigned"
        })
      })
    );
  });

  it("transfers telemetry remediation ownership to another operator", async () => {
    const automationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-automation-remediation-transfer-"));
    const remediationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-remediation-transfer-"));
    vi.stubEnv("OBSERVABILITY_AUTOMATION_REPORT_DIR", automationSandbox);
    vi.stubEnv("OBSERVABILITY_REMEDIATION_REPORT_DIR", remediationSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_SCHEDULE_MODE", "interval");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_INTERVAL_MINUTES", "20");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_TELEMETRY_POLICY", "recover");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_TELEMETRY_ESCALATION_THRESHOLD", "2");
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
      join(remediationSandbox, "2026-04-13T00-11-00-000Z-telemetry-remediation.json"),
      `${JSON.stringify(
        {
          version: 1,
          action: "ACKNOWLEDGED",
          generatedAt: "2026-04-13T00:11:00.000Z",
          actorUserEmail: "initial-owner@atlas.local",
          reason: "Taking ownership before the next operator handoff.",
          remediationStatus: "escalated",
          affectedOwnershipKeys: ["automation-cadence"],
          latestAutomationReportPath: "/tmp/observability-automation.json"
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const { getObservabilityAutomationStatus, recordObservabilityTelemetryRemediationAction } = await import(
      "./observability-runtime"
    );
    const client = {
      membership: {
        findFirst: vi.fn(async () => ({
          id: "membership-oncall",
          role: "OPERATOR",
          user: {
            id: "user-oncall",
            email: "oncall-operator@atlas.local",
            name: "Oncall Operator"
          }
        }))
      },
      notification: {
        upsert: vi.fn(async () => undefined)
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;
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

    const action = await recordObservabilityTelemetryRemediationAction(
      actor,
      {
        action: "TRANSFERRED",
        ownerUserEmail: "oncall-operator@atlas.local",
        reason: "Transfer telemetry remediation to the active operator on call.",
        now: "2026-04-13T00:12:00.000Z"
      },
      client as never
    );
    const status = getObservabilityAutomationStatus(actor, {
      limit: 6,
      now: "2026-04-13T00:12:30.000Z"
    });

    expect(action).toMatchObject({
      action: "TRANSFERRED",
      ownerUserEmail: "oncall-operator@atlas.local"
    });
    expect(status.telemetryRemediationOwnership).toMatchObject({
      status: "acknowledged",
      actorUserEmail: "oncall-operator@atlas.local",
      assignedByUserEmail: "operator-admin@atlas.local",
      handoffAction: "TRANSFERRED"
    });
    expect(status.recentTelemetryRemediationActions[0]).toMatchObject({
      action: "TRANSFERRED",
      ownerUserEmail: "oncall-operator@atlas.local"
    });
    expect(client.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "observability.telemetry_remediation_transferred"
        })
      })
    );
  });

  it("rejects telemetry remediation assignment to a non-operator identity", async () => {
    const automationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-automation-remediation-assign-invalid-"));
    const remediationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-remediation-assign-invalid-"));
    vi.stubEnv("OBSERVABILITY_AUTOMATION_REPORT_DIR", automationSandbox);
    vi.stubEnv("OBSERVABILITY_REMEDIATION_REPORT_DIR", remediationSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_SCHEDULE_MODE", "interval");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_INTERVAL_MINUTES", "20");
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

    const { recordObservabilityTelemetryRemediationAction } = await import("./observability-runtime");
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

    await expect(
      recordObservabilityTelemetryRemediationAction(
        actor,
        {
          action: "ASSIGNED",
          ownerUserEmail: "buyer-user@atlas.local",
          reason: "Attempting to assign remediation to a non-operator identity.",
          now: "2026-04-13T00:12:00.000Z"
        },
        {
          membership: {
            findFirst: vi.fn(async () => null)
          }
        } as never
      )
    ).rejects.toMatchObject({
      code: "forbidden"
    });
  });

  it("resurfaces overdue acknowledged telemetry remediation follow-up", async () => {
    const runtimeSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-runtime-remediation-follow-up-"));
    const automationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-automation-remediation-follow-up-"));
    const remediationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-remediation-follow-up-"));
    vi.stubEnv("OBSERVABILITY_RUNTIME_SNAPSHOT_DIR", runtimeSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_REPORT_DIR", automationSandbox);
    vi.stubEnv("OBSERVABILITY_REMEDIATION_REPORT_DIR", remediationSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_SCHEDULE_MODE", "interval");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_INTERVAL_MINUTES", "20");
    vi.stubEnv("OBSERVABILITY_TELEMETRY_REMEDIATION_FOLLOW_UP_MINUTES", "60");
    writeFileSync(
      join(remediationSandbox, "2026-04-13T00-00-00-000Z-telemetry-remediation.json"),
      `${JSON.stringify(
        {
          version: 1,
          action: "ACKNOWLEDGED",
          generatedAt: "2026-04-13T00:00:00.000Z",
          actorUserEmail: "operator-admin@atlas.local",
          reason: "Taking ownership of the current telemetry remediation issue.",
          remediationStatus: "action_required",
          affectedOwnershipKeys: ["automation-cadence"],
          latestAutomationReportPath: "/tmp/observability-automation.json"
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
      },
      notification: {
        upsert: vi.fn(async () => undefined)
      }
    } as const;

    const { getObservabilityAutomationStatus, recordObservabilityAutomationFailure } = await import("./observability-runtime");
    await recordObservabilityAutomationFailure(
      {
        actorUserEmail: "operator-admin@atlas.local",
        reason: "Recover degraded telemetry ownership during the current release slot.",
        dispatchAlerts: false,
        triggerIncidents: false,
        telemetryPolicy: "recover",
        telemetryRecoveryStatus: "failed",
        trigger: "scheduled",
        generatedAt: "2026-04-13T01:15:00.000Z",
        errorMessage: "Published API runtime snapshot is missing."
      },
      client as never
    );
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
      now: "2026-04-13T01:15:00.000Z"
    });

    expect(status.telemetryRemediationFollowUp).toMatchObject({
      status: "warning",
      thresholdMinutes: 60,
      ageMinutes: 75
    });
    expect(status.telemetryRemediation).toMatchObject({
      status: "escalated",
      recommendedAction: "run-recovery-and-dispatch"
    });
    expect(client.notification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          title: "Telemetry remediation follow-up needs review",
          status: "UNREAD"
        })
      })
    );
  });

  it("escalates remediation guidance when the acknowledged follow-up window is materially overdue", async () => {
    const automationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-automation-follow-up-critical-"));
    const remediationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-remediation-follow-up-critical-"));
    vi.stubEnv("OBSERVABILITY_AUTOMATION_REPORT_DIR", automationSandbox);
    vi.stubEnv("OBSERVABILITY_REMEDIATION_REPORT_DIR", remediationSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_SCHEDULE_MODE", "interval");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_INTERVAL_MINUTES", "20");
    vi.stubEnv("OBSERVABILITY_TELEMETRY_REMEDIATION_FOLLOW_UP_MINUTES", "60");
    writeFileSync(
      join(remediationSandbox, "2026-04-13T00-00-00-000Z-telemetry-remediation.json"),
      `${JSON.stringify(
        {
          version: 1,
          action: "ACKNOWLEDGED",
          generatedAt: "2026-04-13T00:00:00.000Z",
          actorUserEmail: "operator-admin@atlas.local",
          reason: "Taking ownership of the current telemetry remediation issue.",
          remediationStatus: "action_required",
          affectedOwnershipKeys: ["automation-cadence"],
          latestAutomationReportPath: "/tmp/observability-automation.json"
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
      now: "2026-04-13T02:15:00.000Z"
    });

    expect(status.telemetryRemediationFollowUp).toMatchObject({
      status: "critical",
      ageMinutes: 135
    });
    expect(status.telemetryRemediation).toMatchObject({
      status: "escalated",
      title: "Acknowledged telemetry remediation is materially overdue",
      recommendedAction: "run-recovery-and-dispatch",
      dispatchAlerts: true,
      triggerIncidents: true
    });
  });

  it("persists an explicit escalation event when acknowledged remediation becomes materially overdue", async () => {
    const remediationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-remediation-escalation-"));
    vi.stubEnv("OBSERVABILITY_REMEDIATION_REPORT_DIR", remediationSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_SCHEDULE_MODE", "interval");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_INTERVAL_MINUTES", "20");
    vi.stubEnv("OBSERVABILITY_TELEMETRY_REMEDIATION_FOLLOW_UP_MINUTES", "60");
    writeFileSync(
      join(remediationSandbox, "2026-04-13T00-00-00-000Z-telemetry-remediation.json"),
      `${JSON.stringify(
        {
          version: 1,
          action: "ACKNOWLEDGED",
          generatedAt: "2026-04-13T00:00:00.000Z",
          actorUserEmail: "operator-admin@atlas.local",
          reason: "Taking ownership of the current telemetry remediation issue.",
          remediationStatus: "action_required",
          affectedOwnershipKeys: ["automation-cadence"],
          latestAutomationReportPath: "/tmp/observability-automation.json"
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
      },
      notification: {
        upsert: vi.fn(async () => undefined)
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;

    const { getObservabilityAutomationStatus, recordObservabilityAutomationFailure } = await import("./observability-runtime");
    await recordObservabilityAutomationFailure(
      {
        actorUserEmail: "operator-admin@atlas.local",
        reason: "Recover degraded telemetry ownership during the current release slot.",
        dispatchAlerts: false,
        triggerIncidents: false,
        telemetryPolicy: "recover",
        telemetryRecoveryStatus: "failed",
        trigger: "scheduled",
        generatedAt: "2026-04-13T02:15:00.000Z",
        errorMessage: "Published API runtime snapshot is missing."
      },
      client as never
    );
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
      limit: 6,
      now: "2026-04-13T02:15:00.000Z"
    });

    expect(status.recentTelemetryRemediationActions[0]).toMatchObject({
      action: "ESCALATED"
    });
    expect(client.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "observability.telemetry_remediation_escalated"
        })
      })
    );
  });

  it("records telemetry remediation re-acknowledgement after escalation follow-up ages out", async () => {
    const remediationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-remediation-reack-"));
    vi.stubEnv("OBSERVABILITY_REMEDIATION_REPORT_DIR", remediationSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_SCHEDULE_MODE", "interval");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_INTERVAL_MINUTES", "20");
    vi.stubEnv("OBSERVABILITY_TELEMETRY_REMEDIATION_FOLLOW_UP_MINUTES", "60");
    writeFileSync(
      join(remediationSandbox, "2026-04-13T00-00-00-000Z-telemetry-remediation.json"),
      `${JSON.stringify(
        {
          version: 1,
          action: "REACKNOWLEDGED",
          generatedAt: "2026-04-13T00:00:00.000Z",
          actorUserEmail: "operator-admin@atlas.local",
          reason: "Renewing ownership of the telemetry remediation posture.",
          remediationStatus: "escalated",
          affectedOwnershipKeys: ["automation-cadence"],
          latestAutomationReportPath: "/tmp/observability-automation.json",
          resolvedIncidentTriggerCount: 0,
          activeIncidentTriggerCount: 0
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    writeFileSync(
      join(remediationSandbox, "2026-04-13T00-10-00-000Z-telemetry-remediation.json"),
      `${JSON.stringify(
        {
          version: 1,
          action: "ESCALATED",
          generatedAt: "2026-04-13T02:10:00.000Z",
          actorUserEmail: "operator-admin@atlas.local",
          reason: "Atlas escalated telemetry remediation after the 60-minute follow-up window was materially breached.",
          remediationStatus: "escalated",
          affectedOwnershipKeys: ["automation-cadence"],
          latestAutomationReportPath: "/tmp/observability-automation.json",
          resolvedIncidentTriggerCount: 0,
          activeIncidentTriggerCount: 0
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const { getObservabilityAutomationStatus, recordObservabilityTelemetryRemediationAction } = await import(
      "./observability-runtime"
    );
    const client = {
      notification: {
        upsert: vi.fn(async () => undefined)
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;
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

    const action = await recordObservabilityTelemetryRemediationAction(
      actor,
      {
        action: "REACKNOWLEDGED",
        reason: "Renewing telemetry remediation ownership after the escalation handoff aged out.",
        now: "2026-04-13T02:15:00.000Z"
      },
      client as never
    );
    const status = getObservabilityAutomationStatus(actor, {
      limit: 6,
      now: "2026-04-13T02:15:30.000Z"
    });

    expect(action).toMatchObject({
      action: "REACKNOWLEDGED"
    });
    expect(status.telemetryRemediationOwnership).toMatchObject({
      status: "acknowledged",
      actorUserEmail: "operator-admin@atlas.local"
    });
    expect(status.telemetryRemediationFollowUp).toMatchObject({
      status: "ready"
    });
    expect(client.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "observability.telemetry_remediation_reacknowledged"
        })
      })
    );
  });

  it("requires healthy telemetry ownership before remediation can be resolved", async () => {
    const runtimeSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-runtime-remediation-resolve-"));
    const remediationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-remediation-resolve-"));
    vi.stubEnv("OBSERVABILITY_RUNTIME_SNAPSHOT_DIR", runtimeSandbox);
    vi.stubEnv("OBSERVABILITY_REMEDIATION_REPORT_DIR", remediationSandbox);

    const { recordObservabilityTelemetryRemediationAction } = await import("./observability-runtime");
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

    await expect(
      recordObservabilityTelemetryRemediationAction(actor, {
        action: "RESOLVED",
        reason: "Close telemetry remediation after the latest recovery pass.",
        now: "2026-04-13T00:12:00.000Z"
      })
    ).rejects.toThrowError("Telemetry remediation cannot be resolved while ownership signals are still degraded.");
  });

  it("records explicit remediation closure after telemetry ownership returns healthy", async () => {
    const runtimeSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-runtime-remediation-closed-"));
    const automationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-automation-remediation-closed-"));
    const remediationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-remediation-closed-"));
    vi.stubEnv("OBSERVABILITY_RUNTIME_SNAPSHOT_DIR", runtimeSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_REPORT_DIR", automationSandbox);
    vi.stubEnv("OBSERVABILITY_REMEDIATION_REPORT_DIR", remediationSandbox);
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
          telemetryPolicy: "recover",
          telemetryRecovery: {
            status: "recovered",
            recoveredKeys: ["automation-cadence"],
            remainingKeys: []
          },
          snapshot: {
            id: "snapshot-1"
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    writeFileSync(
      join(remediationSandbox, "2026-04-13T00-09-00-000Z-telemetry-remediation.json"),
      `${JSON.stringify(
        {
          version: 1,
          action: "ACKNOWLEDGED",
          generatedAt: "2026-04-13T00:09:00.000Z",
          actorUserEmail: "operator-admin@atlas.local",
          reason: "Taking ownership of the current telemetry remediation issue.",
          remediationStatus: "action_required",
          affectedOwnershipKeys: ["automation-cadence"],
          latestAutomationReportPath: "/tmp/observability-automation.json"
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const { getObservabilityAutomationStatus, recordObservabilityTelemetryRemediationAction } = await import(
      "./observability-runtime"
    );
    observabilityOperationsMock.syncObservabilityIncidentTriggers.mockResolvedValueOnce({
      items: [],
      createdCount: 0,
      resolvedCount: 1,
      activeCount: 0
    });
    const client = {
      notification: {
        upsert: vi.fn(async () => undefined)
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;
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

    const action = await recordObservabilityTelemetryRemediationAction(actor, {
      action: "RESOLVED",
      reason: "Closing telemetry remediation after healthy ownership was restored.",
      now: "2026-04-13T00:12:00.000Z"
    }, client as never);
    const status = getObservabilityAutomationStatus(actor, {
      limit: 5,
      now: "2026-04-13T00:12:30.000Z"
    });

    expect(action).toMatchObject({
      action: "RESOLVED",
      remediationStatus: "ready",
      resolvedIncidentTriggerCount: 1,
      activeIncidentTriggerCount: 0
    });
    expect(status.telemetryRemediationOwnership).toMatchObject({
      status: "resolved",
      actorUserEmail: "operator-admin@atlas.local"
    });
    expect(observabilityOperationsMock.syncObservabilityIncidentTriggers).toHaveBeenCalledWith(
      expect.objectContaining({
        alerts: expect.not.arrayContaining([
          expect.objectContaining({
            id: "telemetry-ownership-automation-cadence"
          })
        ])
      }),
      client
    );
    expect(client.notification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          category: "observability-remediation",
          status: "READ"
        })
      })
    );
    expect(client.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "observability.telemetry_remediation_resolved",
          payload: expect.objectContaining({
            resolvedIncidentTriggerCount: 1,
            activeIncidentTriggerCount: 0
          })
        })
      })
    );
  });

  it("records failure escalation artifacts when recover-mode automation fails before recovery posture is computed", async () => {
    const runtimeSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-runtime-failure-"));
    const automationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-automation-failure-"));
    vi.stubEnv("OBSERVABILITY_RUNTIME_SNAPSHOT_DIR", runtimeSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_REPORT_DIR", automationSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_SCHEDULE_MODE", "interval");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_INTERVAL_MINUTES", "20");
    vi.stubEnv("OBSERVABILITY_WORKER_STALE_AFTER_MINUTES", "10");
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
      },
      notification: {
        upsert: vi.fn(async () => undefined)
      }
    } as const;

    const { recordObservabilityAutomationFailure } = await import("./observability-runtime");
    const result = await recordObservabilityAutomationFailure(
      {
        actorUserEmail: "operator-admin@atlas.local",
        reason: "Recover degraded telemetry ownership during the current release slot.",
        dispatchAlerts: true,
        triggerIncidents: true,
        telemetryPolicy: "recover",
        telemetryRecoveryStatus: "failed",
        trigger: "scheduled",
        generatedAt: "2026-04-13T00:12:00.000Z",
        errorMessage: "Published API runtime snapshot is missing."
      },
      client as never
    );

    expect(result.reportPath).toContain("observability-automation");
    expect(result.snapshotId).toBe("snapshot-automation-1");
    expect(result.dispatchId).toBe("dispatch-automation-1");
    expect(result.activeIncidentCount).toBe(1);
    expect(observabilityOperationsMock.persistObservabilitySnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        alerts: expect.arrayContaining([
          expect.objectContaining({
            id: "telemetry-recovery-failed"
          }),
          expect.objectContaining({
            id: "telemetry-ownership-api-runtime"
          })
        ]),
        metrics: expect.objectContaining({
          lastReadinessStatus: "unknown",
          totalRequests: 0
        })
      }),
      client
    );
    expect(observabilityOperationsMock.syncObservabilityIncidentTriggers).toHaveBeenCalledWith(
      expect.objectContaining({
        alerts: expect.arrayContaining([
          expect.objectContaining({
            id: "telemetry-recovery-failed"
          })
        ])
      }),
      client
    );
    expect(observabilityOperationsMock.dispatchObservabilityAlerts).toHaveBeenCalledWith(
      expect.objectContaining({
        alerts: expect.arrayContaining([
          expect.objectContaining({
            id: "telemetry-recovery-failed"
          })
        ])
      }),
      client
    );
    expect(
      JSON.parse(readFileSync(result.reportPath, "utf8")) as {
        telemetryRecovery?: {
          status?: string;
          remainingKeys?: string[];
        };
      }
    ).toMatchObject({
      telemetryRecovery: {
        status: "failed",
        remainingKeys: ["api-runtime", "automation-cadence"]
      }
    });
    expect(client.notification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          category: "observability-remediation",
          status: "UNREAD",
          title: "Telemetry remediation requires escalation"
        })
      })
    );
  });

  it("lists automation history and current scheduler posture from stored reports", async () => {
    const runtimeSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-runtime-status-"));
    const automationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-automation-history-"));
    const remediationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-remediation-history-"));
    vi.stubEnv("OBSERVABILITY_RUNTIME_SNAPSHOT_DIR", runtimeSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_REPORT_DIR", automationSandbox);
    vi.stubEnv("OBSERVABILITY_REMEDIATION_REPORT_DIR", remediationSandbox);
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
      telemetryRemediation: {
        status: "ready",
        recommendedAction: "none",
        affectedOwnershipKeys: []
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
    const remediationSandbox = mkdtempSync(join(tmpdir(), "atlas-observability-remediation-escalation-"));
    vi.stubEnv("OBSERVABILITY_RUNTIME_SNAPSHOT_DIR", runtimeSandbox);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_REPORT_DIR", automationSandbox);
    vi.stubEnv("OBSERVABILITY_REMEDIATION_REPORT_DIR", remediationSandbox);
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
    expect(status.telemetryRemediation).toMatchObject({
      status: "escalated",
      recommendedAction: "run-recovery-and-dispatch",
      minimumSeverity: "critical"
    });
  });
});
