import type { AtlasOperatorOverviewRecord } from "./operator-workflow";

export type AtlasObservabilityReleaseStage =
  | "internal-concept-demo"
  | "functional-alpha"
  | "design-partner-pilot"
  | "private-beta"
  | "public-beta"
  | "ga"
  | "enterprise-rollout";

export type AtlasApiRouteMetricRecord = {
  key: string;
  method: string;
  path: string;
  totalRequests: number;
  errorCount: number;
  averageDurationMs: number;
  maxDurationMs: number;
  lastStatusCode: number;
  lastSeenAt: string;
};

export type AtlasApiRuntimeMetricsSnapshot = {
  service: "api";
  startedAt: string;
  uptimeSeconds: number;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  averageDurationMs: number;
  maxDurationMs: number;
  inFlightRequests: number;
  lastReadinessStatus: "ready" | "degraded" | "unknown";
  lastReadinessAt: string | null;
  routeMetrics: AtlasApiRouteMetricRecord[];
};

export type AtlasObservabilityAlertSeverity = "info" | "warning" | "critical";

export type AtlasObservabilityAlertRecord = {
  id: string;
  title: string;
  description: string;
  severity: AtlasObservabilityAlertSeverity;
  source: "runtime" | "operator" | "release";
  metricLabel: string;
  status: "open" | "monitoring";
  runbookPath: string;
  updatedAt: string;
};

export type AtlasIncidentReadinessItem = {
  key: string;
  label: string;
  status: "ready" | "warning";
  detail: string;
  runbookPath: string;
};

export type AtlasIncidentReadinessRecord = {
  overallStatus: "ready" | "warning";
  releaseStage: AtlasObservabilityReleaseStage;
  items: AtlasIncidentReadinessItem[];
};

type AtlasObservabilityAlertInput = {
  metrics: AtlasApiRuntimeMetricsSnapshot;
  overview: AtlasOperatorOverviewRecord;
  configurationStatus: "valid" | "invalid";
  releaseStage: AtlasObservabilityReleaseStage;
  generatedAt?: string;
};

function roundMetric(value: number) {
  return Number(value.toFixed(2));
}

function createAlertRecord(
  input: Omit<AtlasObservabilityAlertRecord, "updatedAt"> & {
    updatedAt?: string;
  }
): AtlasObservabilityAlertRecord {
  return {
    ...input,
    updatedAt: input.updatedAt ?? new Date().toISOString()
  };
}

export function calculateAtlasApiErrorRate(metrics: AtlasApiRuntimeMetricsSnapshot) {
  if (metrics.totalRequests === 0) {
    return 0;
  }

  return roundMetric(metrics.errorCount / metrics.totalRequests);
}

export function buildAtlasObservabilityAlerts(input: AtlasObservabilityAlertInput): AtlasObservabilityAlertRecord[] {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const alerts: AtlasObservabilityAlertRecord[] = [];
  const errorRate = calculateAtlasApiErrorRate(input.metrics);

  if (input.configurationStatus === "invalid") {
    alerts.push(
      createAlertRecord({
        id: "runtime-config-invalid",
        title: "Runtime configuration is incomplete",
        description:
          "The API startup contract is reporting invalid configuration. Release promotion should stop until required runtime variables are fixed.",
        severity: input.releaseStage === "ga" || input.releaseStage === "enterprise-rollout" ? "critical" : "warning",
        source: "release",
        metricLabel: "Startup configuration",
        status: "open",
        runbookPath: "docs/runbooks/environment-promotion-baseline.md",
        updatedAt: generatedAt
      })
    );
  }

  if (input.metrics.lastReadinessStatus === "degraded") {
    alerts.push(
      createAlertRecord({
        id: "api-readiness-degraded",
        title: "API readiness is degraded",
        description:
          "One or more runtime dependencies failed the latest readiness probe. Operator review should confirm whether the issue is transient or release-blocking.",
        severity: "critical",
        source: "runtime",
        metricLabel: "Readiness",
        status: "open",
        runbookPath: "docs/runbooks/production-operations-baseline.md",
        updatedAt: generatedAt
      })
    );
  }

  if (input.metrics.totalRequests >= 10 && errorRate >= 0.05) {
    alerts.push(
      createAlertRecord({
        id: "api-error-rate-elevated",
        title: "API error rate is elevated",
        description: `Observed error rate is ${Math.round(errorRate * 100)}% across ${input.metrics.totalRequests} requests.`,
        severity: errorRate >= 0.15 ? "critical" : "warning",
        source: "runtime",
        metricLabel: "Error rate",
        status: "monitoring",
        runbookPath: "docs/runbooks/production-operations-baseline.md",
        updatedAt: generatedAt
      })
    );
  }

  if (input.overview.criticalCaseCount > 0) {
    alerts.push(
      createAlertRecord({
        id: "operator-critical-cases",
        title: "Critical operator cases are open",
        description: `${input.overview.criticalCaseCount} critical cases currently require immediate investigation.`,
        severity: "critical",
        source: "operator",
        metricLabel: "Critical cases",
        status: "open",
        runbookPath: "docs/runbooks/incident-response-baseline.md",
        updatedAt: generatedAt
      })
    );
  }

  if (input.overview.unreadNotificationCount > 0) {
    alerts.push(
      createAlertRecord({
        id: "operator-unread-notifications",
        title: "Unread operator notifications are accumulating",
        description: `${input.overview.unreadNotificationCount} operator notifications remain unread.`,
        severity: input.overview.unreadNotificationCount >= 5 ? "warning" : "info",
        source: "operator",
        metricLabel: "Unread notifications",
        status: "monitoring",
        runbookPath: "docs/runbooks/incident-response-baseline.md",
        updatedAt: generatedAt
      })
    );
  }

  if (input.overview.delayedCaseCount > 0) {
    alerts.push(
      createAlertRecord({
        id: "operator-delayed-cases",
        title: "Settlement or delivery delays require monitoring",
        description: `${input.overview.delayedCaseCount} cases are delayed across payment, receipt, or seller-confirmation posture.`,
        severity: "warning",
        source: "operator",
        metricLabel: "Delayed cases",
        status: "monitoring",
        runbookPath: "docs/runbooks/incident-response-baseline.md",
        updatedAt: generatedAt
      })
    );
  }

  return alerts.sort((left, right) => {
    const severityOrder: Record<AtlasObservabilityAlertSeverity, number> = {
      critical: 0,
      warning: 1,
      info: 2
    };

    return severityOrder[left.severity] - severityOrder[right.severity];
  });
}

export function buildAtlasIncidentReadinessRecord(input: {
  releaseStage: AtlasObservabilityReleaseStage;
  configurationStatus: "valid" | "invalid";
  hasRequestCorrelation: boolean;
  hasMetricsEndpoint: boolean;
  hasHealthEndpoints: boolean;
  hasRollbackVerification: boolean;
  hasBackupRestoreRunbook: boolean;
  activeAlertCount: number;
}): AtlasIncidentReadinessRecord {
  const items: AtlasIncidentReadinessItem[] = [
    {
      key: "request-correlation",
      label: "Request correlation",
      status: input.hasRequestCorrelation ? "ready" : "warning",
      detail: input.hasRequestCorrelation
        ? "API responses carry request correlation ids for runtime tracing."
        : "Request correlation is missing from API runtime responses.",
      runbookPath: "docs/runbooks/production-operations-baseline.md"
    },
    {
      key: "health-endpoints",
      label: "Health and readiness",
      status: input.hasHealthEndpoints ? "ready" : "warning",
      detail: input.hasHealthEndpoints
        ? "Liveness, startup, readiness, and metrics endpoints are available."
        : "Operational health endpoints are incomplete.",
      runbookPath: "docs/runbooks/production-operations-baseline.md"
    },
    {
      key: "runtime-configuration",
      label: "Runtime configuration",
      status: input.configurationStatus === "valid" ? "ready" : "warning",
      detail:
        input.configurationStatus === "valid"
          ? "Startup configuration currently validates for the tracked runtime contract."
          : "Startup configuration is currently invalid and must be corrected before promotion.",
      runbookPath: "docs/runbooks/environment-promotion-baseline.md"
    },
    {
      key: "rollback-verification",
      label: "Rollback readiness",
      status: input.hasRollbackVerification ? "ready" : "warning",
      detail: input.hasRollbackVerification
        ? "Rollback-readiness verification and release manifest generation are wired into the repo."
        : "Rollback verification is not yet part of the release baseline.",
      runbookPath: "docs/runbooks/release-rollback-baseline.md"
    },
    {
      key: "backup-restore",
      label: "Backup and restore",
      status: input.hasBackupRestoreRunbook ? "ready" : "warning",
      detail: input.hasBackupRestoreRunbook
        ? "Repo-owned backup and restore commands plus runbooks exist for operator use."
        : "Backup and restore procedures are not yet codified in the repo.",
      runbookPath: "docs/runbooks/database-backup-and-restore.md"
    },
    {
      key: "active-alert-load",
      label: "Active alert load",
      status: input.activeAlertCount === 0 ? "ready" : "warning",
      detail:
        input.activeAlertCount === 0
          ? "No active runtime or operator alerts currently require incident handling."
          : `${input.activeAlertCount} active runtime or operator alerts currently need monitoring or intervention.`,
      runbookPath: "docs/runbooks/incident-response-baseline.md"
    }
  ];

  return {
    overallStatus: items.every((item) => item.status === "ready") ? "ready" : "warning",
    releaseStage: input.releaseStage,
    items
  };
}
