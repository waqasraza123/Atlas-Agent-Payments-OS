import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deploymentRuntime, observabilityRuntime, validateAtlasRuntimeConfiguration } from "@atlas/config";
import type {
  AtlasApiRuntimeMetricsSnapshot,
  AtlasApiRuntimeTelemetryRecord,
  AtlasApiRouteMetricRecord,
  AtlasRuntimeTraceRecord
} from "@atlas/domain";
import { calculateAtlasTraceCoverageRate } from "@atlas/domain";

type RouteMetricState = {
  method: string;
  path: string;
  totalRequests: number;
  errorCount: number;
  totalDurationMs: number;
  maxDurationMs: number;
  lastStatusCode: number;
  lastSeenAt: string;
};

type ReadinessSnapshot = {
  status: "ready" | "degraded";
  recordedAt: string;
};

const apiRuntimeMetricsState = {
  startedAt: new Date().toISOString(),
  totalRequests: 0,
  successCount: 0,
  errorCount: 0,
  tracedRequestCount: 0,
  totalDurationMs: 0,
  maxDurationMs: 0,
  inFlightRequests: 0,
  routeMetrics: new Map<string, RouteMetricState>(),
  lastReadiness: null as ReadinessSnapshot | null,
  recentTraces: [] as AtlasRuntimeTraceRecord[]
};

function roundMetric(value: number) {
  return Number(value.toFixed(2));
}

function resolveRuntimeSnapshotPath(fileName: string) {
  return resolve(import.meta.dirname, "../../..", observabilityRuntime.runtimeSnapshotDirectory, fileName);
}

function canPublishRuntimeSnapshot() {
  return process.env.NODE_ENV !== "test";
}

function createRouteMetricKey(method: string, path: string) {
  return `${method.toUpperCase()} ${path}`;
}

function mapRouteMetricRecord(key: string, state: RouteMetricState): AtlasApiRouteMetricRecord {
  return {
    key,
    method: state.method,
    path: state.path,
    totalRequests: state.totalRequests,
    errorCount: state.errorCount,
    averageDurationMs: state.totalRequests === 0 ? 0 : roundMetric(state.totalDurationMs / state.totalRequests),
    maxDurationMs: state.maxDurationMs,
    lastStatusCode: state.lastStatusCode,
    lastSeenAt: state.lastSeenAt
  };
}

function publishApiRuntimeTelemetryRecord() {
  if (!canPublishRuntimeSnapshot()) {
    return;
  }

  const filePath = resolveRuntimeSnapshotPath("api.json");
  mkdirSync(dirname(filePath), {
    recursive: true
  });
  writeFileSync(filePath, `${JSON.stringify(getApiRuntimeTelemetryRecord(), null, 2)}\n`, "utf8");
}

function pushRecentTrace(trace: AtlasRuntimeTraceRecord) {
  apiRuntimeMetricsState.recentTraces.unshift(trace);
  apiRuntimeMetricsState.recentTraces = apiRuntimeMetricsState.recentTraces.slice(0, observabilityRuntime.traceHistoryLimit);
}

export function beginApiRequestMetric() {
  apiRuntimeMetricsState.inFlightRequests += 1;

  return () => {
    apiRuntimeMetricsState.inFlightRequests = Math.max(0, apiRuntimeMetricsState.inFlightRequests - 1);
  };
}

export function recordApiRequestMetric(input: {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}) {
  apiRuntimeMetricsState.totalRequests += 1;
  apiRuntimeMetricsState.totalDurationMs += input.durationMs;
  apiRuntimeMetricsState.maxDurationMs = Math.max(apiRuntimeMetricsState.maxDurationMs, input.durationMs);

  if (input.statusCode >= 500) {
    apiRuntimeMetricsState.errorCount += 1;
  } else {
    apiRuntimeMetricsState.successCount += 1;
  }

  const key = createRouteMetricKey(input.method, input.path);
  const current = apiRuntimeMetricsState.routeMetrics.get(key) ?? {
    method: input.method.toUpperCase(),
    path: input.path,
    totalRequests: 0,
    errorCount: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
    lastStatusCode: input.statusCode,
    lastSeenAt: new Date().toISOString()
  };

  current.totalRequests += 1;
  current.totalDurationMs += input.durationMs;
  current.maxDurationMs = Math.max(current.maxDurationMs, input.durationMs);
  current.lastStatusCode = input.statusCode;
  current.lastSeenAt = new Date().toISOString();

  if (input.statusCode >= 500) {
    current.errorCount += 1;
  }

  apiRuntimeMetricsState.routeMetrics.set(key, current);
  publishApiRuntimeTelemetryRecord();
}

export function recordApiReadinessSnapshot(status: "ready" | "degraded") {
  apiRuntimeMetricsState.lastReadiness = {
    status,
    recordedAt: new Date().toISOString()
  };
  publishApiRuntimeTelemetryRecord();
}

export function recordApiTrace(trace: AtlasRuntimeTraceRecord) {
  apiRuntimeMetricsState.tracedRequestCount += 1;
  pushRecentTrace(trace);
  publishApiRuntimeTelemetryRecord();
}

export function getApiRuntimeMetricsSnapshot(): AtlasApiRuntimeMetricsSnapshot {
  const startedAt = new Date(apiRuntimeMetricsState.startedAt);

  return {
    service: "api",
    startedAt: apiRuntimeMetricsState.startedAt,
    uptimeSeconds: roundMetric((Date.now() - startedAt.getTime()) / 1000),
    totalRequests: apiRuntimeMetricsState.totalRequests,
    successCount: apiRuntimeMetricsState.successCount,
    errorCount: apiRuntimeMetricsState.errorCount,
    tracedRequestCount: apiRuntimeMetricsState.tracedRequestCount,
    traceCoverageRate: calculateAtlasTraceCoverageRate(
      apiRuntimeMetricsState.totalRequests,
      apiRuntimeMetricsState.tracedRequestCount
    ),
    averageDurationMs:
      apiRuntimeMetricsState.totalRequests === 0
        ? 0
        : roundMetric(apiRuntimeMetricsState.totalDurationMs / apiRuntimeMetricsState.totalRequests),
    maxDurationMs: apiRuntimeMetricsState.maxDurationMs,
    inFlightRequests: apiRuntimeMetricsState.inFlightRequests,
    lastReadinessStatus: apiRuntimeMetricsState.lastReadiness?.status ?? "unknown",
    lastReadinessAt: apiRuntimeMetricsState.lastReadiness?.recordedAt ?? null,
    routeMetrics: Array.from(apiRuntimeMetricsState.routeMetrics.entries())
      .map(([key, value]) => mapRouteMetricRecord(key, value))
      .sort((left, right) => right.totalRequests - left.totalRequests),
    recentTraces: [...apiRuntimeMetricsState.recentTraces]
  };
}

export function getApiRuntimeTelemetryRecord(): AtlasApiRuntimeTelemetryRecord {
  const configuration = validateAtlasRuntimeConfiguration("api");

  return {
    ...getApiRuntimeMetricsSnapshot(),
    configurationStatus: configuration.ok ? "valid" : "invalid",
    verificationCommand: "pnpm verify:release",
    revision: deploymentRuntime.revision,
    deploymentSlot: deploymentRuntime.deploymentSlot,
    recordedAt: new Date().toISOString()
  };
}

export function resetApiRuntimeMetrics() {
  apiRuntimeMetricsState.startedAt = new Date().toISOString();
  apiRuntimeMetricsState.totalRequests = 0;
  apiRuntimeMetricsState.successCount = 0;
  apiRuntimeMetricsState.errorCount = 0;
  apiRuntimeMetricsState.tracedRequestCount = 0;
  apiRuntimeMetricsState.totalDurationMs = 0;
  apiRuntimeMetricsState.maxDurationMs = 0;
  apiRuntimeMetricsState.inFlightRequests = 0;
  apiRuntimeMetricsState.routeMetrics.clear();
  apiRuntimeMetricsState.lastReadiness = null;
  apiRuntimeMetricsState.recentTraces = [];
  publishApiRuntimeTelemetryRecord();
}

publishApiRuntimeTelemetryRecord();
