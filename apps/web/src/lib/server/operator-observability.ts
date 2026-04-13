import type { AtlasActorContext, AtlasLocalSessionSelection } from "@atlas/auth";
import { createAtlasIdentityProviderSessionToken, createAtlasLocalSessionToken } from "@atlas/auth/server";
import { apiRuntime, authRuntime } from "@atlas/config";
import type {
  AtlasApiRuntimeTelemetryRecord,
  AtlasIncidentReadinessRecord,
  AtlasObservabilityAlertDispatchRecord,
  AtlasObservabilityAlertRecord,
  AtlasObservabilityAutomationRunRecord,
  AtlasObservabilityAutomationStatusRecord,
  AtlasObservabilityIncidentTriggerRecord,
  AtlasObservabilitySnapshotRecord,
  AtlasRuntimeTraceRecord,
  AtlasWorkerTelemetryRecord
} from "@atlas/domain";
import type { DetailGridItem, RecordListPanelItem } from "@atlas/ui";
import { createAtlasChildTraceContext, createAtlasServerTraceSession } from "./request-trace";
type AtlasApiEnvelope<T> = {
  item?: T;
  items?: T[];
};

async function fetchOperatorObservabilityResource<T>(
  path: string,
  actor: AtlasActorContext,
  selection: AtlasLocalSessionSelection,
  traceSession: ReturnType<typeof createAtlasServerTraceSession>
): Promise<AtlasApiEnvelope<T>> {
  const { headers: traceHeaders } = createAtlasChildTraceContext(traceSession);
  const sessionHeader =
    actor.source === "identity-provider" && actor.sessionId
      ? createAtlasIdentityProviderSessionToken(authRuntime.sessionSigningSecret, selection, {
          sessionId: actor.sessionId,
          provider: actor.providerMode === "external-oidc" ? authRuntime.externalOidcProvider : authRuntime.identityBridgeProvider,
          expiresAt: actor.sessionExpiresAt
        })
      : createAtlasLocalSessionToken(authRuntime.sessionSigningSecret, selection, {
          expiresAt: new Date(Date.now() + authRuntime.localSessionTtlMinutes * 60 * 1000).toISOString()
        });
  const response = await fetch(`${apiRuntime.baseUrl}${path}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      "x-atlas-local-session": sessionHeader,
      ...traceHeaders
    }
  });

  if (!response.ok) {
    throw new Error(`Observability request failed for ${path} with status ${response.status}.`);
  }

  return (await response.json()) as AtlasApiEnvelope<T>;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export async function loadOperatorObservabilityData(actor: AtlasActorContext, selection: AtlasLocalSessionSelection) {
  const traceSession = createAtlasServerTraceSession("web");
  const [
    metricsResponse,
    alertsResponse,
    incidentsResponse,
    workerResponse,
    snapshotsResponse,
    dispatchesResponse,
    automationResponse,
    incidentTriggersResponse
  ] = await Promise.all([
    fetchOperatorObservabilityResource<AtlasApiRuntimeTelemetryRecord>("/observability/metrics", actor, selection, traceSession),
    fetchOperatorObservabilityResource<AtlasObservabilityAlertRecord>("/observability/alerts", actor, selection, traceSession),
    fetchOperatorObservabilityResource<AtlasIncidentReadinessRecord>("/observability/incidents", actor, selection, traceSession),
    fetchOperatorObservabilityResource<AtlasWorkerTelemetryRecord>("/observability/worker", actor, selection, traceSession),
    fetchOperatorObservabilityResource<AtlasObservabilitySnapshotRecord>("/observability/snapshots", actor, selection, traceSession),
    fetchOperatorObservabilityResource<AtlasObservabilityAlertDispatchRecord>("/observability/dispatches", actor, selection, traceSession),
    fetchOperatorObservabilityResource<AtlasObservabilityAutomationStatusRecord>("/observability/automation", actor, selection, traceSession),
    fetchOperatorObservabilityResource<AtlasObservabilityIncidentTriggerRecord>(
      "/observability/incident-triggers",
      actor,
      selection,
      traceSession
    )
  ]);

  return {
    metrics: metricsResponse.item,
    alerts: alertsResponse.items ?? [],
    incidentReadiness: incidentsResponse.item,
    workerTelemetry: workerResponse.item,
    snapshots: snapshotsResponse.items ?? [],
    dispatches: dispatchesResponse.items ?? [],
    automation: automationResponse.item,
    incidentTriggers: incidentTriggersResponse.items ?? []
  };
}

export function createOperatorAlertItems(items: AtlasObservabilityAlertRecord[]): RecordListPanelItem[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    detail: `${item.metricLabel} · ${item.runbookPath}`,
    statusLabel: item.severity.toUpperCase(),
    statusTone:
      item.severity === "critical" ? "critical" : item.severity === "warning" ? "warning" : "default"
  }));
}

export function createOperatorIncidentItems(record: AtlasIncidentReadinessRecord): RecordListPanelItem[] {
  return record.items.map((item) => ({
    id: item.key,
    title: item.label,
    description: item.detail,
    detail: item.runbookPath,
    statusLabel: item.status === "ready" ? "Ready" : "Warning",
    statusTone: item.status === "ready" ? "success" : "warning"
  }));
}

export function createOperatorSnapshotItems(items: AtlasObservabilitySnapshotRecord[]): RecordListPanelItem[] {
  return items.map((item) => ({
    id: item.id,
    title: `${item.appEnv} snapshot · ${item.totalRequests} requests`,
    description: `${item.activeAlertCount} alerts · ${item.criticalAlertCount} critical · ${item.configurationStatus}`,
    detail: `expires ${formatDateTime(item.expiresAt)} · ${item.reportPath}`,
    statusLabel: item.readinessStatus.toUpperCase(),
    statusTone: item.readinessStatus === "degraded" ? "warning" : "default"
  }));
}

export function createOperatorDispatchItems(items: AtlasObservabilityAlertDispatchRecord[]): RecordListPanelItem[] {
  return items.map((item) => ({
    id: item.id,
    title: `${item.provider} · ${item.dispatchedAlertCount} alerts`,
    description: item.summary,
    detail: `${item.deliveryKind} · ${item.minimumSeverity} threshold${item.traceId ? ` · trace ${item.traceId}` : ""} · ${item.reportPath}`,
    statusLabel: item.status,
    statusTone: item.status === "SUCCEEDED" ? "success" : "critical"
  }));
}

export function createOperatorIncidentTriggerItems(
  items: AtlasObservabilityIncidentTriggerRecord[]
): RecordListPanelItem[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.summary,
    detail: `${item.severity} severity · ${item.traceIds.length} traces · ${item.reportPath}`,
    statusLabel: item.status,
    statusTone: item.status === "ACTIVE" ? (item.severity === "critical" ? "critical" : "warning") : "success"
  }));
}

export function createOperatorAutomationRunItems(
  items: AtlasObservabilityAutomationRunRecord[]
): RecordListPanelItem[] {
  return items.map((item) => ({
    id: item.id,
    title: `${item.trigger === "scheduled" ? "Scheduled" : "Manual"} automation · ${item.status}`,
    description:
      item.reason ??
      (item.errorMessage ? item.errorMessage : `${item.alertCount ?? 0} alerts reviewed at ${item.minimumSeverity}.`),
    detail: `${item.minimumSeverity} threshold · ${item.reportPath}`,
    statusLabel: formatDateTime(item.generatedAt),
    statusTone: item.status === "FAILED" ? "critical" : "success"
  }));
}

export function createOperatorWorkerQueueItems(workerTelemetry: AtlasWorkerTelemetryRecord | null): RecordListPanelItem[] {
  return (workerTelemetry?.snapshot?.queues ?? []).map((item) => ({
    id: item.key,
    title: item.name,
    description: `${item.processedCount} processed · ${item.failedCount} failed`,
    detail: `ready ${item.readyCount} · last processed ${formatDateTime(item.lastProcessedAt)} · last failed ${formatDateTime(item.lastFailedAt)}`,
    statusLabel: item.failedCount > 0 ? "Failures" : item.readyCount > 0 ? "Ready" : "Waiting",
    statusTone: item.failedCount > 0 ? "critical" : item.readyCount > 0 ? "success" : "warning"
  }));
}

export function createOperatorMetricsFacts(
  metrics: AtlasApiRuntimeTelemetryRecord
): DetailGridItem[] {
  return [
    {
      label: "Startup configuration",
      value: metrics.configurationStatus === "valid" ? "Valid" : "Invalid"
    },
    {
      label: "Verification command",
      value: metrics.verificationCommand
    },
    {
      label: "Revision",
      value: metrics.revision
    },
    {
      label: "Deployment slot",
      value: metrics.deploymentSlot
    },
    {
      label: "Last readiness status",
      value: metrics.lastReadinessStatus
    },
    {
      label: "Last readiness check",
      value: formatDateTime(metrics.lastReadinessAt)
    },
    {
      label: "Average request duration",
      value: `${metrics.averageDurationMs} ms`
    },
    {
      label: "Max request duration",
      value: `${metrics.maxDurationMs} ms`
    },
    {
      label: "Trace coverage",
      value: `${Math.round(metrics.traceCoverageRate * 100)}%`
    },
    {
      label: "Recent traces",
      value: String(metrics.recentTraces.length)
    }
  ];
}

export function createOperatorAutomationFacts(
  automation: AtlasObservabilityAutomationStatusRecord
): DetailGridItem[] {
  return [
    {
      label: "Schedule mode",
      value: automation.scheduleMode === "interval" ? "Interval" : "Disabled"
    },
    {
      label: "Interval",
      value: `${automation.intervalMinutes} minutes`
    },
    {
      label: "Startup delay",
      value: `${automation.startupDelaySeconds} seconds`
    },
    {
      label: "Automation actor",
      value: automation.actorUserEmail ?? "Not configured"
    },
    {
      label: "Default severity",
      value: automation.minimumSeverity
    },
    {
      label: "Dispatch provider",
      value: automation.dispatchProvider
    },
    {
      label: "Delivery kind",
      value: automation.dispatchDeliveryKind
    },
    {
      label: "Dispatch externally",
      value: automation.dispatchAlerts ? "Enabled" : "Disabled"
    },
    {
      label: "Dispatch mode",
      value: automation.dispatchMode === "command" ? "Command" : "Dry run"
    },
    {
      label: "Sync incidents",
      value: automation.triggerIncidents ? "Enabled" : "Disabled"
    },
    {
      label: "Last run",
      value: automation.lastRunAt ? formatDateTime(automation.lastRunAt) : "Not recorded"
    },
    {
      label: "Snapshot retention",
      value: `${automation.retention.snapshotRetentionDays} days`
    },
    {
      label: "Automation retention",
      value: `${automation.retention.automationRetentionDays} days`
    }
  ];
}

export function createOperatorRouteMetricItems(metrics: AtlasApiRuntimeTelemetryRecord): RecordListPanelItem[] {
  return metrics.routeMetrics.slice(0, 8).map((item) => ({
    id: item.key,
    title: item.key,
    description: `${item.totalRequests} requests · ${item.errorCount} server errors`,
    detail: `avg ${item.averageDurationMs} ms · max ${item.maxDurationMs} ms · last ${item.lastStatusCode}`,
    statusLabel: formatDateTime(item.lastSeenAt),
    statusTone: item.errorCount > 0 ? "warning" : "default"
  }));
}

function formatTraceContext(record: AtlasRuntimeTraceRecord) {
  const parts = [
    record.requestId ? `request ${record.requestId}` : null,
    record.jobId ? `job ${record.jobId}` : null,
    record.path,
    record.queueName
  ].filter(Boolean);

  return parts.join(" · ");
}

export function createOperatorTraceItems(
  metrics: AtlasApiRuntimeTelemetryRecord,
  workerTelemetry: AtlasWorkerTelemetryRecord | null
): RecordListPanelItem[] {
  return Array.from(
    new Map(
      [...metrics.recentTraces, ...(workerTelemetry?.snapshot?.recentTraces ?? [])]
        .sort((left, right) => new Date(right.endedAt).getTime() - new Date(left.endedAt).getTime())
        .map((trace) => [`${trace.sourceService}:${trace.spanId}`, trace] as const)
    ).values()
  )
    .slice(0, 12)
    .map((trace) => ({
      id: `${trace.sourceService}:${trace.spanId}`,
      title: `${trace.sourceService.toUpperCase()} · ${trace.name}`,
      description: `${trace.status.toUpperCase()} · ${trace.durationMs} ms · ${trace.traceId}`,
      detail: formatTraceContext(trace),
      statusLabel: formatDateTime(trace.endedAt),
      statusTone: trace.status === "error" ? "critical" : "default"
    }));
}
