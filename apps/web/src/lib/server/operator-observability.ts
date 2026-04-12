import { atlasIdentityAssertionHeaderName, type AtlasLocalSessionSelection } from "@atlas/auth";
import { createAtlasLocalSessionToken } from "@atlas/auth/server";
import { apiRuntime, authRuntime } from "@atlas/config";
import type {
  AtlasApiRuntimeMetricsSnapshot,
  AtlasIncidentReadinessRecord,
  AtlasObservabilityAlertRecord
} from "@atlas/domain";
import type { DetailGridItem, RecordListPanelItem } from "@atlas/ui";
import { headers } from "next/headers";

type AtlasApiEnvelope<T> = {
  item?: T;
  items?: T[];
};

async function fetchOperatorObservabilityResource<T>(
  path: string,
  selection: AtlasLocalSessionSelection
): Promise<AtlasApiEnvelope<T>> {
  const requestHeaders = await headers();
  const identityAssertion = requestHeaders.get(atlasIdentityAssertionHeaderName);
  const response = await fetch(`${apiRuntime.baseUrl}${path}`, {
    method: "GET",
    cache: "no-store",
    headers:
      identityAssertion && selection.profileKey === null
        ? {
            [atlasIdentityAssertionHeaderName]: identityAssertion
          }
        : {
            "x-atlas-local-session": createAtlasLocalSessionToken(authRuntime.sessionSigningSecret, selection, {
              expiresAt: new Date(Date.now() + authRuntime.localSessionTtlMinutes * 60 * 1000).toISOString()
            })
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

export async function loadOperatorObservabilityData(selection: AtlasLocalSessionSelection) {
  const [metricsResponse, alertsResponse, incidentsResponse] = await Promise.all([
    fetchOperatorObservabilityResource<AtlasApiRuntimeMetricsSnapshot & {
      configurationStatus: "valid" | "invalid";
      verificationCommand: string;
    }>("/observability/metrics", selection),
    fetchOperatorObservabilityResource<AtlasObservabilityAlertRecord>("/observability/alerts", selection),
    fetchOperatorObservabilityResource<AtlasIncidentReadinessRecord>("/observability/incidents", selection)
  ]);

  return {
    metrics: metricsResponse.item,
    alerts: alertsResponse.items ?? [],
    incidentReadiness: incidentsResponse.item
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

export function createOperatorMetricsFacts(
  metrics: AtlasApiRuntimeMetricsSnapshot & {
    configurationStatus: "valid" | "invalid";
    verificationCommand: string;
  }
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
    }
  ];
}

export function createOperatorRouteMetricItems(metrics: AtlasApiRuntimeMetricsSnapshot): RecordListPanelItem[] {
  return metrics.routeMetrics.slice(0, 8).map((item) => ({
    id: item.key,
    title: item.key,
    description: `${item.totalRequests} requests · ${item.errorCount} server errors`,
    detail: `avg ${item.averageDurationMs} ms · max ${item.maxDurationMs} ms · last ${item.lastStatusCode}`,
    statusLabel: formatDateTime(item.lastSeenAt),
    statusTone: item.errorCount > 0 ? "warning" : "default"
  }));
}
