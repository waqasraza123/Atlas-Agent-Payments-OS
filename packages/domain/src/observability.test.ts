import { describe, expect, it } from "vitest";
import {
  buildAtlasIncidentReadinessRecord,
  buildAtlasObservabilityAlerts,
  calculateAtlasApiErrorRate,
  type AtlasApiRuntimeMetricsSnapshot
} from "./observability";

function createMetricsSnapshot(overrides: Partial<AtlasApiRuntimeMetricsSnapshot> = {}): AtlasApiRuntimeMetricsSnapshot {
  return {
    service: "api",
    startedAt: "2026-04-12T00:00:00.000Z",
    uptimeSeconds: 300,
    totalRequests: 100,
    successCount: 92,
    errorCount: 8,
    averageDurationMs: 42,
    maxDurationMs: 220,
    inFlightRequests: 1,
    lastReadinessStatus: "ready",
    lastReadinessAt: "2026-04-12T00:05:00.000Z",
    routeMetrics: [],
    ...overrides
  };
}

describe("atlas observability contracts", () => {
  it("calculates a stable API error rate", () => {
    expect(calculateAtlasApiErrorRate(createMetricsSnapshot())).toBe(0.08);
    expect(calculateAtlasApiErrorRate(createMetricsSnapshot({ totalRequests: 0, errorCount: 0 }))).toBe(0);
  });

  it("builds critical and warning alerts from runtime and operator posture", () => {
    const alerts = buildAtlasObservabilityAlerts({
      metrics: createMetricsSnapshot({
        lastReadinessStatus: "degraded",
        totalRequests: 40,
        errorCount: 8
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
      generatedAt: "2026-04-12T00:10:00.000Z"
    });

    expect(alerts.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "runtime-config-invalid",
        "api-readiness-degraded",
        "api-error-rate-elevated",
        "operator-critical-cases"
      ])
    );
    expect(alerts[0]?.severity).toBe("critical");
  });

  it("builds incident readiness from release and alert posture", () => {
    const record = buildAtlasIncidentReadinessRecord({
      releaseStage: "private-beta",
      configurationStatus: "valid",
      hasRequestCorrelation: true,
      hasMetricsEndpoint: true,
      hasHealthEndpoints: true,
      hasRollbackVerification: true,
      hasBackupRestoreRunbook: true,
      activeAlertCount: 2
    });

    expect(record.overallStatus).toBe("warning");
    expect(record.items.find((item) => item.key === "active-alert-load")?.status).toBe("warning");
    expect(record.items.find((item) => item.key === "rollback-verification")?.status).toBe("ready");
  });
});
