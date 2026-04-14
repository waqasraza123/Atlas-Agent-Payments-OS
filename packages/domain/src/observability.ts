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

export type AtlasRuntimeTraceRecord = {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  sourceService: "api" | "worker";
  origin: "http" | "job";
  name: string;
  status: "ok" | "error";
  requestId: string | null;
  method: string | null;
  path: string | null;
  queueKey: string | null;
  queueName: string | null;
  jobId: string | null;
  attempt: number | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
};

export type AtlasApiRuntimeMetricsSnapshot = {
  service: "api";
  startedAt: string;
  uptimeSeconds: number;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  tracedRequestCount: number;
  traceCoverageRate: number;
  averageDurationMs: number;
  maxDurationMs: number;
  inFlightRequests: number;
  lastReadinessStatus: "ready" | "degraded" | "unknown";
  lastReadinessAt: string | null;
  routeMetrics: AtlasApiRouteMetricRecord[];
  recentTraces: AtlasRuntimeTraceRecord[];
};

export type AtlasApiRuntimeTelemetryRecord = AtlasApiRuntimeMetricsSnapshot & {
  configurationStatus: "valid" | "invalid";
  verificationCommand: string;
  revision: string;
  deploymentSlot: string;
  recordedAt: string;
};

export type AtlasWorkerQueueRuntimeMetricRecord = {
  key: string;
  name: string;
  readyCount: number;
  processedCount: number;
  failedCount: number;
  lastProcessedAt: string | null;
  lastFailedAt: string | null;
};

export type AtlasWorkerRuntimeMetricsSnapshot = {
  service: "worker";
  startedAt: string;
  recordedAt: string;
  uptimeSeconds: number;
  revision: string;
  deploymentSlot: string;
  queueCount: number;
  readyQueueCount: number;
  processedCount: number;
  failedCount: number;
  traceCount: number;
  traceCoverageRate: number;
  queues: AtlasWorkerQueueRuntimeMetricRecord[];
  recentTraces: AtlasRuntimeTraceRecord[];
};

export type AtlasWorkerTelemetryRecord = {
  status: "healthy" | "warning" | "critical" | "stale" | "missing";
  summary: string;
  snapshotPath: string | null;
  recordedAt: string | null;
  staleAfterMinutes: number;
  snapshot: AtlasWorkerRuntimeMetricsSnapshot | null;
};

export type AtlasObservabilityTelemetryOwnershipRecord = {
  key: "api-runtime" | "worker-runtime" | "automation-cadence";
  label: string;
  status: "healthy" | "warning" | "critical";
  detail: string;
  lastRecordedAt: string | null;
};

export type AtlasObservabilityTelemetryOwnershipPolicy = "monitor" | "recover";
export type AtlasObservabilityTelemetryRecoveryStatus =
  | "not_requested"
  | "no_action"
  | "failed"
  | "recovered"
  | "partial"
  | "unchanged";

export type AtlasObservabilityTelemetryRecoveryEscalationRecord = {
  status: "idle" | "triggered";
  consecutiveBreachedRuns: number;
  threshold: number;
  detail: string;
};

export type AtlasObservabilityTelemetryRemediationRecord = {
  status: "ready" | "action_required" | "escalated";
  title: string;
  detail: string;
  recommendedAction: "none" | "run-recovery" | "run-recovery-and-dispatch";
  recommendedActionLabel: string;
  reason: string;
  minimumSeverity: AtlasObservabilityAlertSeverity;
  dispatchAlerts: boolean;
  triggerIncidents: boolean;
  affectedOwnershipKeys: AtlasObservabilityTelemetryOwnershipRecord["key"][];
  latestReportPath: string | null;
  runbookPath: string;
};

export type AtlasObservabilityAlertSeverity = "info" | "warning" | "critical";
export type AtlasObservabilityDeliveryKind = "alert-dispatch" | "paging";

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

export type AtlasObservabilitySnapshotRecord = {
  id: string;
  appEnv: string;
  releaseStage: string;
  actorUserEmail: string;
  configurationStatus: "valid" | "invalid";
  readinessStatus: "ready" | "degraded" | "unknown";
  totalRequests: number;
  errorCount: number;
  activeAlertCount: number;
  criticalAlertCount: number;
  reportPath: string;
  storageUrl: string | null;
  expiresAt: string;
  createdAt: string;
};

export type AtlasObservabilityAlertDispatchRecord = {
  id: string;
  provider: string;
  deliveryKind: AtlasObservabilityDeliveryKind;
  mode: "dry-run" | "command";
  status: "SUCCEEDED" | "FAILED";
  minimumSeverity: AtlasObservabilityAlertSeverity;
  actorUserEmail: string;
  summary: string;
  targetReference: string | null;
  traceId: string | null;
  reportPath: string;
  dispatchedAlertCount: number;
  criticalAlertCount: number;
  warningAlertCount: number;
  infoAlertCount: number;
  completedAt: string;
  createdAt: string;
  operationalIntegrationId: string | null;
};

export type AtlasObservabilityIncidentTriggerRecord = {
  id: string;
  dedupeKey: string;
  appEnv: string;
  releaseStage: string;
  source: "runtime" | "operator" | "release";
  severity: AtlasObservabilityAlertSeverity;
  status: "ACTIVE" | "RESOLVED";
  title: string;
  summary: string;
  alertIds: string[];
  traceIds: string[];
  actorUserEmail: string;
  reportPath: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AtlasObservabilityAutomationRunRecord = {
  id: string;
  status: "SUCCEEDED" | "FAILED";
  trigger: "manual" | "scheduled";
  generatedAt: string;
  actorUserEmail: string | null;
  reason: string | null;
  minimumSeverity: AtlasObservabilityAlertSeverity;
  dispatchAlerts: boolean;
  triggerIncidents: boolean;
  telemetryPolicy: AtlasObservabilityTelemetryOwnershipPolicy;
  telemetryRecoveryStatus: AtlasObservabilityTelemetryRecoveryStatus;
  recoveredOwnershipCount: number;
  remainingOwnershipCount: number;
  alertCount: number | null;
  activeIncidentCount: number | null;
  snapshotId: string | null;
  dispatchId: string | null;
  workerTelemetryStatus: AtlasWorkerTelemetryRecord["status"] | null;
  reportPath: string;
  errorMessage: string | null;
};

export type AtlasObservabilityRetentionPolicyRecord = {
  snapshotRetentionDays: number;
  dispatchRetentionDays: number;
  incidentRetentionDays: number;
  automationRetentionDays: number;
};

export type AtlasObservabilityAutomationStatusRecord = {
  scheduleMode: "disabled" | "interval";
  intervalMinutes: number;
  startupDelaySeconds: number;
  telemetryPolicy: AtlasObservabilityTelemetryOwnershipPolicy;
  telemetryRecoveryEscalation: AtlasObservabilityTelemetryRecoveryEscalationRecord;
  telemetryRemediation: AtlasObservabilityTelemetryRemediationRecord;
  actorUserEmail: string | null;
  minimumSeverity: AtlasObservabilityAlertSeverity;
  dispatchAlerts: boolean;
  dispatchMode: "dry-run" | "command";
  dispatchProvider: string;
  dispatchDeliveryKind: AtlasObservabilityDeliveryKind;
  triggerIncidents: boolean;
  retention: AtlasObservabilityRetentionPolicyRecord;
  lastRunAt: string | null;
  lastRunStatus: AtlasObservabilityAutomationRunRecord["status"] | null;
  lastReportPath: string | null;
  telemetryOwnership: AtlasObservabilityTelemetryOwnershipRecord[];
  recentRuns: AtlasObservabilityAutomationRunRecord[];
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

export function isAtlasPagingProvider(provider: string) {
  return provider === "pagerduty-events" || provider === "opsgenie-alerts";
}

export function getAtlasObservabilityDeliveryKind(provider: string): AtlasObservabilityDeliveryKind {
  return isAtlasPagingProvider(provider) ? "paging" : "alert-dispatch";
}

type AtlasObservabilityAlertInput = {
  metrics: AtlasApiRuntimeTelemetryRecord;
  overview: AtlasOperatorOverviewRecord;
  configurationStatus: "valid" | "invalid";
  releaseStage: AtlasObservabilityReleaseStage;
  workerTelemetry?: AtlasWorkerTelemetryRecord | null;
  telemetryOwnership?: AtlasObservabilityTelemetryOwnershipRecord[];
  latestAutomationRun?: AtlasObservabilityAutomationRunRecord | null;
  telemetryRecoveryEscalation?: AtlasObservabilityTelemetryRecoveryEscalationRecord | null;
  generatedAt?: string;
};

function createSeverityRank(severity: AtlasObservabilityAlertSeverity) {
  return severity === "critical" ? 0 : severity === "warning" ? 1 : 2;
}

function listDegradedOwnershipKeys(items: AtlasObservabilityTelemetryOwnershipRecord[]) {
  return items.filter((item) => item.status !== "healthy").map((item) => item.key);
}

function roundMetric(value: number) {
  return Number(value.toFixed(2));
}

export function buildAtlasWorkerTelemetryRecord(input: {
  snapshot: AtlasWorkerRuntimeMetricsSnapshot | null;
  snapshotPath: string | null;
  staleAfterMinutes: number;
  now?: string;
}): AtlasWorkerTelemetryRecord {
  if (!input.snapshot) {
    return {
      status: "missing",
      summary: "Shared worker telemetry has not been published yet.",
      snapshotPath: input.snapshotPath,
      recordedAt: null,
      staleAfterMinutes: input.staleAfterMinutes,
      snapshot: null
    };
  }

  const now = new Date(input.now ?? new Date().toISOString());
  const recordedAt = new Date(input.snapshot.recordedAt);
  const staleThresholdMs = input.staleAfterMinutes * 60 * 1000;
  const isStale = now.getTime() - recordedAt.getTime() > staleThresholdMs;

  if (isStale) {
    return {
      status: "stale",
      summary: `Worker telemetry is older than ${input.staleAfterMinutes} minutes.`,
      snapshotPath: input.snapshotPath,
      recordedAt: input.snapshot.recordedAt,
      staleAfterMinutes: input.staleAfterMinutes,
      snapshot: input.snapshot
    };
  }

  if (input.snapshot.failedCount > 0) {
    return {
      status:
        input.snapshot.failedCount >= 5 || input.snapshot.failedCount > input.snapshot.processedCount
          ? "critical"
          : "warning",
      summary: `${input.snapshot.failedCount} worker job failures are currently recorded.`,
      snapshotPath: input.snapshotPath,
      recordedAt: input.snapshot.recordedAt,
      staleAfterMinutes: input.staleAfterMinutes,
      snapshot: input.snapshot
    };
  }

  if (input.snapshot.readyQueueCount < input.snapshot.queueCount) {
    return {
      status: "warning",
      summary: `${input.snapshot.readyQueueCount} of ${input.snapshot.queueCount} worker queues have reported readiness.`,
      snapshotPath: input.snapshotPath,
      recordedAt: input.snapshot.recordedAt,
      staleAfterMinutes: input.staleAfterMinutes,
      snapshot: input.snapshot
    };
  }

  return {
    status: "healthy",
    summary: "Shared worker telemetry is current and all queues have reported readiness.",
    snapshotPath: input.snapshotPath,
    recordedAt: input.snapshot.recordedAt,
    staleAfterMinutes: input.staleAfterMinutes,
    snapshot: input.snapshot
  };
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

export function calculateAtlasTraceCoverageRate(totalCount: number, tracedCount: number) {
  if (totalCount === 0) {
    return 1;
  }

  return roundMetric(tracedCount / totalCount);
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

  if (input.metrics.totalRequests > 0 && input.metrics.traceCoverageRate < 1) {
    alerts.push(
      createAlertRecord({
        id: "api-trace-coverage-degraded",
        title: "API trace coverage is degraded",
        description: `Observed trace coverage is ${Math.round(input.metrics.traceCoverageRate * 100)}% across ${input.metrics.totalRequests} requests.`,
        severity: input.metrics.traceCoverageRate < 0.8 ? "critical" : "warning",
        source: "runtime",
        metricLabel: "API trace coverage",
        status: "monitoring",
        runbookPath: "docs/runbooks/observability-and-alerting-baseline.md",
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

  if (input.workerTelemetry) {
    if (input.workerTelemetry.status === "missing" || input.workerTelemetry.status === "stale") {
      alerts.push(
        createAlertRecord({
          id: "worker-telemetry-unavailable",
          title: "Worker telemetry is unavailable",
          description:
            input.workerTelemetry.status === "missing"
              ? "Atlas could not load the shared worker telemetry snapshot. Queue health should be treated as unverified."
              : `Worker telemetry is older than ${input.workerTelemetry.staleAfterMinutes} minutes and should be treated as stale.`,
          severity:
            input.releaseStage === "ga" || input.releaseStage === "enterprise-rollout" ? "critical" : "warning",
          source: "runtime",
          metricLabel: "Worker telemetry",
          status: "open",
          runbookPath: "docs/runbooks/production-operations-baseline.md",
          updatedAt: generatedAt
        })
      );
    }

    if (input.workerTelemetry.snapshot) {
      const workerSnapshot = input.workerTelemetry.snapshot;

      if (workerSnapshot.failedCount > 0) {
        alerts.push(
          createAlertRecord({
            id: "worker-queue-failures",
            title: "Worker queue failures require review",
            description: `${workerSnapshot.failedCount} worker job failures were recorded across ${workerSnapshot.queueCount} queues.`,
            severity:
              workerSnapshot.failedCount >= 5 || workerSnapshot.failedCount > workerSnapshot.processedCount
                ? "critical"
                : "warning",
            source: "runtime",
            metricLabel: "Worker failures",
            status: "monitoring",
            runbookPath: "docs/runbooks/incident-response-baseline.md",
            updatedAt: generatedAt
          })
        );
      }

      if (workerSnapshot.readyQueueCount < workerSnapshot.queueCount) {
        alerts.push(
          createAlertRecord({
            id: "worker-queues-not-ready",
            title: "One or more worker queues have not reported readiness",
            description: `${workerSnapshot.readyQueueCount} of ${workerSnapshot.queueCount} worker queues have reported readiness in the current runtime.`,
            severity: workerSnapshot.readyQueueCount === 0 ? "critical" : "warning",
            source: "runtime",
            metricLabel: "Worker queue readiness",
            status: "monitoring",
            runbookPath: "docs/runbooks/production-operations-baseline.md",
            updatedAt: generatedAt
          })
        );
      }

      if (workerSnapshot.processedCount > 0 && workerSnapshot.traceCoverageRate < 1) {
        alerts.push(
          createAlertRecord({
            id: "worker-trace-coverage-degraded",
            title: "Worker trace coverage is degraded",
            description: `Observed worker trace coverage is ${Math.round(workerSnapshot.traceCoverageRate * 100)}% across ${workerSnapshot.processedCount} processed jobs.`,
            severity: workerSnapshot.traceCoverageRate < 0.8 ? "critical" : "warning",
            source: "runtime",
            metricLabel: "Worker trace coverage",
            status: "monitoring",
            runbookPath: "docs/runbooks/observability-and-alerting-baseline.md",
            updatedAt: generatedAt
          })
        );
      }
    }
  }

  for (const ownership of input.telemetryOwnership ?? []) {
    if (ownership.status === "healthy") {
      continue;
    }

    alerts.push(
      createAlertRecord({
        id: `telemetry-ownership-${ownership.key}`,
        title: `${ownership.label} ownership needs attention`,
        description: ownership.detail,
        severity: ownership.status === "critical" ? "critical" : "warning",
        source: "runtime",
        metricLabel: ownership.label,
        status: ownership.status === "critical" ? "open" : "monitoring",
        runbookPath: "docs/runbooks/production-operations-baseline.md",
        updatedAt: generatedAt
      })
    );
  }

  if (input.latestAutomationRun?.telemetryPolicy === "recover") {
    if (input.latestAutomationRun.status === "FAILED") {
      alerts.push(
        createAlertRecord({
          id: "telemetry-recovery-failed",
          title: "Telemetry auto-recovery failed",
          description:
            input.latestAutomationRun.errorMessage ??
            "The latest telemetry ownership recovery run failed before ownership could be restored.",
          severity: "critical",
          source: "runtime",
          metricLabel: "Telemetry auto-recovery",
          status: "open",
          runbookPath: "docs/runbooks/production-operations-baseline.md",
          updatedAt: generatedAt
        })
      );
    } else if (
      input.latestAutomationRun.telemetryRecoveryStatus === "partial" ||
      input.latestAutomationRun.telemetryRecoveryStatus === "unchanged"
    ) {
      const remainingCount = input.latestAutomationRun.remainingOwnershipCount;
      const recoveredCount = input.latestAutomationRun.recoveredOwnershipCount;

      alerts.push(
        createAlertRecord({
          id: "telemetry-recovery-incomplete",
          title: "Telemetry auto-recovery left ownership degraded",
          description:
            input.latestAutomationRun.telemetryRecoveryStatus === "partial"
              ? `The latest recovery run restored ${recoveredCount} ownership signal${recoveredCount === 1 ? "" : "s"}, but ${remainingCount} still require operator follow-up.`
              : `The latest recovery run did not restore any degraded ownership signals, and ${remainingCount} still require operator follow-up.`,
          severity: input.latestAutomationRun.telemetryRecoveryStatus === "unchanged" ? "critical" : "warning",
          source: "runtime",
          metricLabel: "Telemetry auto-recovery",
          status: input.latestAutomationRun.telemetryRecoveryStatus === "unchanged" ? "open" : "monitoring",
          runbookPath: "docs/runbooks/production-operations-baseline.md",
          updatedAt: generatedAt
        })
      );
    }
  }

  if (input.telemetryRecoveryEscalation?.status === "triggered") {
    alerts.push(
      createAlertRecord({
        id: "telemetry-recovery-repeating",
        title: "Telemetry auto-recovery is repeatedly breaching policy",
        description: input.telemetryRecoveryEscalation.detail,
        severity: "critical",
        source: "runtime",
        metricLabel: "Telemetry auto-recovery",
        status: "open",
        runbookPath: "docs/runbooks/production-operations-baseline.md",
        updatedAt: generatedAt
      })
    );
  }

  return alerts.sort((left, right) => {
    return createSeverityRank(left.severity) - createSeverityRank(right.severity);
  });
}

export function filterAtlasObservabilityAlertsBySeverity(
  alerts: AtlasObservabilityAlertRecord[],
  minimumSeverity: AtlasObservabilityAlertSeverity
) {
  const minimumRank = createSeverityRank(minimumSeverity);

  return alerts.filter((alert) => createSeverityRank(alert.severity) <= minimumRank);
}

export function countAtlasObservabilityAlertsBySeverity(alerts: AtlasObservabilityAlertRecord[]) {
  return alerts.reduce(
    (counts, alert) => {
      if (alert.severity === "critical") {
        counts.critical += 1;
      } else if (alert.severity === "warning") {
        counts.warning += 1;
      } else {
        counts.info += 1;
      }

      return counts;
    },
    {
      critical: 0,
      warning: 0,
      info: 0
    }
  );
}

export function buildAtlasObservabilityTelemetryRemediation(input: {
  telemetryOwnership: AtlasObservabilityTelemetryOwnershipRecord[];
  latestAutomationRun: AtlasObservabilityAutomationRunRecord | null;
  telemetryRecoveryEscalation: AtlasObservabilityTelemetryRecoveryEscalationRecord;
  dispatchAlerts: boolean;
  triggerIncidents: boolean;
  minimumSeverity: AtlasObservabilityAlertSeverity;
}): AtlasObservabilityTelemetryRemediationRecord {
  const degradedOwnership = input.telemetryOwnership.filter((item) => item.status !== "healthy");
  const affectedOwnershipKeys = listDegradedOwnershipKeys(input.telemetryOwnership);
  const hasCriticalOwnership = degradedOwnership.some((item) => item.status === "critical");
  const affectedLabels = degradedOwnership.map((item) => item.label);
  const affectedLabelSummary = affectedLabels.length > 0 ? affectedLabels.join(", ") : "Current telemetry ownership";
  const latestRun = input.latestAutomationRun;
  const latestReportPath = latestRun?.reportPath ?? null;
  const runbookPath = "docs/runbooks/production-operations-baseline.md";

  if (latestRun?.telemetryPolicy === "recover" && latestRun.status === "FAILED") {
    return {
      status: "escalated",
      title: "Recover-mode automation failed before ownership was restored",
      detail:
        latestRun.errorMessage ??
        `Atlas could not complete the latest telemetry recovery run, and ${affectedLabelSummary} still require operator follow-up.`,
      recommendedAction: "run-recovery-and-dispatch",
      recommendedActionLabel: "Run guided recovery with dispatch",
      reason: "Run guided telemetry remediation after a failed recover-mode automation cycle.",
      minimumSeverity: "critical",
      dispatchAlerts: true,
      triggerIncidents: true,
      affectedOwnershipKeys,
      latestReportPath,
      runbookPath
    };
  }

  if (input.telemetryRecoveryEscalation.status === "triggered") {
    return {
      status: "escalated",
      title: "Telemetry ownership is breaching recovery policy",
      detail:
        affectedOwnershipKeys.length > 0
          ? `${input.telemetryRecoveryEscalation.detail} ${affectedLabelSummary} still require intervention.`
          : input.telemetryRecoveryEscalation.detail,
      recommendedAction: "run-recovery-and-dispatch",
      recommendedActionLabel: "Run escalated recovery",
      reason: "Run guided telemetry remediation after repeated recovery-policy breaches.",
      minimumSeverity: "critical",
      dispatchAlerts: true,
      triggerIncidents: true,
      affectedOwnershipKeys,
      latestReportPath,
      runbookPath
    };
  }

  if (affectedOwnershipKeys.length > 0) {
    return {
      status: "action_required",
      title: "Telemetry ownership needs guided recovery",
      detail: `${affectedLabelSummary} currently need operator recovery before the next handoff.`,
      recommendedAction: "run-recovery",
      recommendedActionLabel: "Run guided recovery",
      reason: "Run guided telemetry remediation for the current degraded ownership signals.",
      minimumSeverity: hasCriticalOwnership ? "critical" : "warning",
      dispatchAlerts: false,
      triggerIncidents: input.triggerIncidents,
      affectedOwnershipKeys,
      latestReportPath,
      runbookPath
    };
  }

  return {
    status: "ready",
    title: "Telemetry ownership is currently healthy",
    detail: "API runtime telemetry, worker runtime telemetry, and automation cadence are currently within the owned baseline.",
    recommendedAction: "none",
    recommendedActionLabel: "No remediation required",
    reason: "Telemetry ownership is currently healthy.",
    minimumSeverity: input.minimumSeverity,
    dispatchAlerts: false,
    triggerIncidents: input.triggerIncidents,
    affectedOwnershipKeys: [],
    latestReportPath,
    runbookPath
  };
}

export function buildAtlasIncidentReadinessRecord(input: {
  releaseStage: AtlasObservabilityReleaseStage;
  configurationStatus: "valid" | "invalid";
  hasRequestCorrelation: boolean;
  hasDistributedTracing: boolean;
  hasMetricsEndpoint: boolean;
  hasHealthEndpoints: boolean;
  hasRollbackVerification: boolean;
  hasBackupRestoreRunbook: boolean;
  hasExternalPaging: boolean;
  pagingProvider: string | null;
  hasAutomatedIncidentTriggers: boolean;
  workerTelemetryStatus: AtlasWorkerTelemetryRecord["status"];
  activeAlertCount: number;
  activeIncidentTriggerCount: number;
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
      key: "distributed-tracing",
      label: "Distributed tracing",
      status: input.hasDistributedTracing ? "ready" : "warning",
      detail: input.hasDistributedTracing
        ? "Recent API and worker traces are being captured with shared trace identifiers."
        : "Recent runtime activity is missing shared trace identifiers or trace coverage has degraded.",
      runbookPath: "docs/runbooks/observability-and-alerting-baseline.md"
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
      key: "external-paging",
      label: "External paging",
      status: input.hasExternalPaging ? "ready" : "warning",
      detail: input.hasExternalPaging
        ? `Repo-owned external paging is configured through ${input.pagingProvider ?? "the active paging provider"}.`
        : "External paging ownership is not yet configured on the active observability dispatch provider.",
      runbookPath: "docs/runbooks/observability-and-alerting-baseline.md"
    },
    {
      key: "worker-telemetry",
      label: "Worker telemetry",
      status:
        input.workerTelemetryStatus === "healthy" || input.workerTelemetryStatus === "warning" ? "ready" : "warning",
      detail:
        input.workerTelemetryStatus === "healthy"
          ? "Shared worker telemetry is fresh and queue runtime visibility is available to operators."
          : input.workerTelemetryStatus === "warning"
            ? "Shared worker telemetry is available, but one or more queue-level warning signals need review."
            : input.workerTelemetryStatus === "critical"
              ? "Shared worker telemetry is available, but worker queue health is currently degraded."
              : input.workerTelemetryStatus === "stale"
                ? "Shared worker telemetry is stale and should not be treated as current."
                : "Shared worker telemetry is missing and queue runtime visibility is unavailable.",
      runbookPath: "docs/runbooks/production-operations-baseline.md"
    },
    {
      key: "incident-automation",
      label: "Automated incident triggers",
      status: input.hasAutomatedIncidentTriggers ? "ready" : "warning",
      detail: input.hasAutomatedIncidentTriggers
        ? input.activeIncidentTriggerCount === 0
          ? "Repo-owned automation can persist and resolve incident triggers from observability alerts."
          : `${input.activeIncidentTriggerCount} automated incident triggers are currently active for operator follow-up.`
        : "Observability automation is not yet syncing incident triggers from active alerts.",
      runbookPath: "docs/runbooks/incident-response-baseline.md"
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
