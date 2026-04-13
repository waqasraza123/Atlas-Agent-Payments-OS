import { describe, expect, it } from "vitest";
import {
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
        "worker-trace-coverage-degraded"
      ])
    );
    expect(alerts[0]?.severity).toBe("critical");
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
