import { describe, expect, it } from "vitest";
import {
  buildAtlasObservabilityTelemetryRemediation,
  buildAtlasWorkerTelemetryRecord,
  buildAtlasIncidentReadinessRecord,
  buildAtlasObservabilityAlerts,
  calculateAtlasTraceCoverageRate,
  countAtlasObservabilityAlertsBySeverity,
  calculateAtlasApiErrorRate,
  filterAtlasObservabilityAlertsBySeverity,
  type AtlasApiRuntimeTelemetryRecord
} from "./observability";

function createMetricsSnapshot(overrides: Partial<AtlasApiRuntimeTelemetryRecord> = {}): AtlasApiRuntimeTelemetryRecord {
  return {
    service: "api",
    startedAt: "2026-04-12T00:00:00.000Z",
    uptimeSeconds: 300,
    totalRequests: 100,
    successCount: 92,
    errorCount: 8,
    tracedRequestCount: 100,
    traceCoverageRate: 1,
    averageDurationMs: 42,
    maxDurationMs: 220,
    inFlightRequests: 1,
    lastReadinessStatus: "ready",
    lastReadinessAt: "2026-04-12T00:05:00.000Z",
    routeMetrics: [],
    recentTraces: [],
    configurationStatus: "valid",
    verificationCommand: "pnpm verify:release",
    revision: "rev-123",
    deploymentSlot: "blue",
    recordedAt: "2026-04-12T00:05:00.000Z",
    ...overrides
  };
}

describe("atlas observability contracts", () => {
  it("calculates a stable API error rate", () => {
    expect(calculateAtlasApiErrorRate(createMetricsSnapshot())).toBe(0.08);
    expect(calculateAtlasApiErrorRate(createMetricsSnapshot({ totalRequests: 0, errorCount: 0 }))).toBe(0);
    expect(calculateAtlasTraceCoverageRate(10, 10)).toBe(1);
    expect(calculateAtlasTraceCoverageRate(10, 8)).toBe(0.8);
  });

  it("builds critical and warning alerts from runtime and operator posture", () => {
    const alerts = buildAtlasObservabilityAlerts({
      metrics: createMetricsSnapshot({
        lastReadinessStatus: "degraded",
        totalRequests: 40,
        errorCount: 8,
        tracedRequestCount: 30,
        traceCoverageRate: 0.75
      }),
      overview: {
        openCaseCount: 4,
        criticalCaseCount: 2,
        actionRequiredCount: 1,
        unreadNotificationCount: 3,
        delayedCaseCount: 1,
        failedCaseCount: 1,
        recentCases: [],
        recentNotifications: [],
        recentAuditEvents: []
      },
      configurationStatus: "invalid",
      releaseStage: "ga",
      workerTelemetry: buildAtlasWorkerTelemetryRecord({
        staleAfterMinutes: 10,
        snapshotPath: "/tmp/worker-runtime.json",
        snapshot: {
          service: "worker",
          startedAt: "2026-04-12T00:00:00.000Z",
          recordedAt: "2026-04-12T00:10:00.000Z",
          uptimeSeconds: 300,
          revision: "rev-123",
          deploymentSlot: "blue",
          queueCount: 2,
          readyQueueCount: 1,
          processedCount: 10,
          failedCount: 6,
          traceCount: 7,
          traceCoverageRate: 0.7,
          queues: [],
          recentTraces: []
        }
      }),
      telemetryOwnership: [
        {
          key: "automation-cadence",
          label: "Automation cadence",
          status: "warning",
          detail: "Latest automation run completed 55 minutes ago.",
          lastRecordedAt: "2026-04-11T23:15:00.000Z"
        }
      ],
      latestAutomationRun: {
        id: "run-1",
        status: "SUCCEEDED",
        trigger: "scheduled",
        generatedAt: "2026-04-12T00:09:00.000Z",
        actorUserEmail: "operator-admin@atlas.local",
        reason: "Recover degraded telemetry ownership during the current release slot.",
        minimumSeverity: "warning",
        dispatchAlerts: false,
        triggerIncidents: true,
        telemetryPolicy: "recover",
        telemetryRecoveryStatus: "partial",
        recoveredOwnershipCount: 1,
        remainingOwnershipCount: 1,
        alertCount: 8,
        activeIncidentCount: 2,
        snapshotId: "snapshot-1",
        dispatchId: null,
        workerTelemetryStatus: "warning",
        reportPath: "/tmp/run-1.json",
        errorMessage: null
      },
      telemetryRecoveryEscalation: {
        status: "triggered",
        consecutiveBreachedRuns: 2,
        threshold: 2,
        detail: "Telemetry auto-recovery has breached its target for 2 consecutive runs."
      },
      generatedAt: "2026-04-12T00:10:00.000Z"
    });

    expect(alerts.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "runtime-config-invalid",
        "api-readiness-degraded",
        "api-error-rate-elevated",
        "api-trace-coverage-degraded",
        "operator-critical-cases",
        "worker-queue-failures",
        "worker-queues-not-ready",
        "worker-trace-coverage-degraded",
        "telemetry-ownership-automation-cadence",
        "telemetry-recovery-incomplete",
        "telemetry-recovery-repeating"
      ])
    );
    expect(alerts[0]?.severity).toBe("critical");
  });

  it("escalates failed telemetry auto-recovery runs", () => {
    const alerts = buildAtlasObservabilityAlerts({
      metrics: createMetricsSnapshot(),
      overview: {
        openCaseCount: 0,
        criticalCaseCount: 0,
        actionRequiredCount: 0,
        unreadNotificationCount: 0,
        delayedCaseCount: 0,
        failedCaseCount: 0,
        recentCases: [],
        recentNotifications: [],
        recentAuditEvents: []
      },
      configurationStatus: "valid",
      releaseStage: "private-beta",
      workerTelemetry: buildAtlasWorkerTelemetryRecord({
        staleAfterMinutes: 10,
        snapshotPath: null,
        snapshot: null
      }),
      latestAutomationRun: {
        id: "run-2",
        status: "FAILED",
        trigger: "scheduled",
        generatedAt: "2026-04-12T00:12:00.000Z",
        actorUserEmail: "operator-admin@atlas.local",
        reason: "Recover degraded telemetry ownership during the current release slot.",
        minimumSeverity: "warning",
        dispatchAlerts: false,
        triggerIncidents: true,
        telemetryPolicy: "recover",
        telemetryRecoveryStatus: "not_requested",
        recoveredOwnershipCount: 0,
        remainingOwnershipCount: 0,
        alertCount: null,
        activeIncidentCount: null,
        snapshotId: null,
        dispatchId: null,
        workerTelemetryStatus: null,
        reportPath: "/tmp/run-2.json",
        errorMessage: "Published API runtime snapshot is missing."
      },
      generatedAt: "2026-04-12T00:13:00.000Z"
    });

    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "telemetry-recovery-failed",
          severity: "critical"
        })
      ])
    );
  });

  it("raises follow-up alerts when acknowledged telemetry remediation is aging out", () => {
    const alerts = buildAtlasObservabilityAlerts({
      metrics: createMetricsSnapshot(),
      overview: {
        openCaseCount: 0,
        criticalCaseCount: 0,
        actionRequiredCount: 0,
        unreadNotificationCount: 0,
        delayedCaseCount: 0,
        failedCaseCount: 0,
        recentCases: [],
        recentNotifications: [],
        recentAuditEvents: []
      },
      configurationStatus: "valid",
      releaseStage: "private-beta",
      workerTelemetry: buildAtlasWorkerTelemetryRecord({
        staleAfterMinutes: 10,
        snapshotPath: null,
        snapshot: null
      }),
      telemetryRemediationFollowUp: {
        status: "critical",
        thresholdMinutes: 60,
        ageMinutes: 130,
        detail: "Telemetry remediation follow-up is materially overdue after 130 minutes since acknowledgement."
      }
    });

    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "telemetry-remediation-follow-up",
          severity: "critical",
          source: "operator"
        })
      ])
    );
  });

  it("builds an escalated telemetry remediation plan for failed recover-mode automation", () => {
    const remediation = buildAtlasObservabilityTelemetryRemediation({
      telemetryOwnership: [
        {
          key: "api-runtime",
          label: "API runtime telemetry",
          status: "critical",
          detail: "No published API runtime snapshot is available for operators.",
          lastRecordedAt: null
        }
      ],
      latestAutomationRun: {
        id: "run-2",
        status: "FAILED",
        trigger: "scheduled",
        generatedAt: "2026-04-12T00:12:00.000Z",
        actorUserEmail: "operator-admin@atlas.local",
        reason: "Recover degraded telemetry ownership during the current release slot.",
        minimumSeverity: "warning",
        dispatchAlerts: false,
        triggerIncidents: true,
        telemetryPolicy: "recover",
        telemetryRecoveryStatus: "failed",
        recoveredOwnershipCount: 0,
        remainingOwnershipCount: 1,
        alertCount: 3,
        activeIncidentCount: 1,
        snapshotId: "snapshot-1",
        dispatchId: null,
        workerTelemetryStatus: "healthy",
        reportPath: "/tmp/run-2.json",
        errorMessage: "Published API runtime snapshot is missing."
      },
      telemetryRecoveryEscalation: {
        status: "idle",
        consecutiveBreachedRuns: 1,
        threshold: 2,
        detail: "Telemetry auto-recovery has breached its target for 1 consecutive run, below the escalation threshold of 2."
      },
      dispatchAlerts: false,
      triggerIncidents: true,
      minimumSeverity: "warning"
    });

    expect(remediation).toMatchObject({
      status: "escalated",
      recommendedAction: "run-recovery-and-dispatch",
      minimumSeverity: "critical",
      dispatchAlerts: true,
      affectedOwnershipKeys: ["api-runtime"]
    });
  });

  it("escalates remediation guidance when acknowledged follow-up is materially overdue", () => {
    const remediation = buildAtlasObservabilityTelemetryRemediation({
      telemetryOwnership: [
        {
          key: "automation-cadence",
          label: "Automation cadence",
          status: "critical",
          detail: "No observability automation run has been recorded for the active schedule.",
          lastRecordedAt: null
        }
      ],
      latestAutomationRun: null,
      telemetryRecoveryEscalation: {
        status: "idle",
        consecutiveBreachedRuns: 0,
        threshold: 2,
        detail: "Telemetry auto-recovery has not breached its target."
      },
      telemetryRemediationFollowUp: {
        status: "critical",
        thresholdMinutes: 60,
        ageMinutes: 135,
        detail: "Telemetry remediation follow-up is materially overdue after 135 minutes since acknowledgement."
      },
      dispatchAlerts: false,
      triggerIncidents: true,
      minimumSeverity: "warning"
    });

    expect(remediation).toMatchObject({
      status: "escalated",
      title: "Acknowledged telemetry remediation is materially overdue",
      recommendedAction: "run-recovery-and-dispatch",
      dispatchAlerts: true,
      triggerIncidents: true,
      minimumSeverity: "critical"
    });
  });

  it("classifies worker telemetry freshness and queue health", () => {
    const workerTelemetry = buildAtlasWorkerTelemetryRecord({
      staleAfterMinutes: 10,
      now: "2026-04-12T00:30:00.000Z",
      snapshotPath: "/tmp/worker-runtime.json",
        snapshot: {
          service: "worker",
          startedAt: "2026-04-12T00:00:00.000Z",
          recordedAt: "2026-04-12T00:05:00.000Z",
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
        }
      });

    expect(workerTelemetry.status).toBe("stale");
    expect(workerTelemetry.summary).toContain("older than 10 minutes");
  });

  it("builds incident readiness from release and alert posture", () => {
    const record = buildAtlasIncidentReadinessRecord({
      releaseStage: "private-beta",
      configurationStatus: "valid",
      hasRequestCorrelation: true,
      hasDistributedTracing: true,
      hasMetricsEndpoint: true,
      hasHealthEndpoints: true,
      hasRollbackVerification: true,
      hasBackupRestoreRunbook: true,
      hasExternalPaging: true,
      pagingProvider: "pagerduty-events",
      hasAutomatedIncidentTriggers: true,
      workerTelemetryStatus: "healthy",
      activeAlertCount: 2,
      activeIncidentTriggerCount: 1
    });

    expect(record.overallStatus).toBe("warning");
    expect(record.items.find((item) => item.key === "active-alert-load")?.status).toBe("warning");
    expect(record.items.find((item) => item.key === "rollback-verification")?.status).toBe("ready");
    expect(record.items.find((item) => item.key === "worker-telemetry")?.status).toBe("ready");
    expect(record.items.find((item) => item.key === "distributed-tracing")?.status).toBe("ready");
  });

  it("filters and counts alerts by minimum severity", () => {
    const alerts = buildAtlasObservabilityAlerts({
      metrics: createMetricsSnapshot({
        lastReadinessStatus: "degraded",
        totalRequests: 40,
        errorCount: 8,
        tracedRequestCount: 40,
        traceCoverageRate: 1
      }),
      overview: {
        openCaseCount: 2,
        criticalCaseCount: 1,
        actionRequiredCount: 1,
        unreadNotificationCount: 3,
        delayedCaseCount: 1,
        failedCaseCount: 0,
        recentCases: [],
        recentNotifications: [],
        recentAuditEvents: []
      },
      configurationStatus: "valid",
      releaseStage: "private-beta",
      workerTelemetry: buildAtlasWorkerTelemetryRecord({
        staleAfterMinutes: 10,
        snapshotPath: null,
        snapshot: null
      }),
      generatedAt: "2026-04-12T00:10:00.000Z"
    });

    const filtered = filterAtlasObservabilityAlertsBySeverity(alerts, "warning");

    expect(filtered.every((alert) => alert.severity === "critical" || alert.severity === "warning")).toBe(true);
    expect(countAtlasObservabilityAlertsBySeverity(filtered)).toEqual({
      critical: expect.any(Number),
      warning: expect.any(Number),
      info: 0
    });
  });
});
