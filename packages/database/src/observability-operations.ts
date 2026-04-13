import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { canAtlasActorMutate, type AtlasActorContext } from "@atlas/auth";
import {
  appRuntime,
  observabilityRuntime,
  type AtlasAutomationAdapterResult,
  type AtlasCommandAdapterMode
} from "@atlas/config";
import {
  countAtlasObservabilityAlertsBySeverity,
  filterAtlasObservabilityAlertsBySeverity,
  type AtlasApiRuntimeTelemetryRecord,
  type AtlasIncidentReadinessRecord,
  type AtlasObservabilityAlertDispatchRecord,
  type AtlasObservabilityAlertRecord,
  type AtlasObservabilityIncidentTriggerRecord,
  type AtlasObservabilityAlertSeverity,
  type AtlasObservabilitySnapshotRecord,
  type AtlasWorkerTelemetryRecord
} from "@atlas/domain";
import { Prisma, type PrismaClient } from "./generated/client/index.js";
import { prisma } from "./client";
import { resolveOperationalIntegrationForExecution, touchOperationalIntegrationUsage } from "./operational-integrations";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

type MetricsWithConfiguration = AtlasApiRuntimeTelemetryRecord;

export type AtlasObservabilityRetentionSweepResult = {
  deletedSnapshotRecords: number;
  deletedDispatchRecords: number;
  deletedResolvedIncidentTriggerRecords: number;
  deletedSnapshotArtifacts: number;
  deletedDispatchArtifacts: number;
  deletedIncidentArtifacts: number;
  deletedAutomationArtifacts: number;
};

export class AtlasObservabilityOperationsError extends Error {
  constructor(
    message: string,
    readonly code: "bad_request" | "forbidden" | "execution_failed"
  ) {
    super(message);
    this.name = "AtlasObservabilityOperationsError";
  }
}

function assertObservabilityActor(actor: AtlasActorContext) {
  if (actor.workspace !== "OPERATOR" || actor.organization.kind !== "OPERATOR") {
    throw new AtlasObservabilityOperationsError(
      "Observability operations can only be managed from the operator workspace.",
      "forbidden"
    );
  }

  if (!canAtlasActorMutate(actor)) {
    throw new AtlasObservabilityOperationsError(
      "Support-access sessions cannot manage observability operations.",
      "forbidden"
    );
  }
}

function resolveRepoPath(...segments: string[]) {
  return resolve(import.meta.dirname, "../../..", ...segments);
}

function createTimestampFileFragment() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function writeJsonArtifact(filePath: string, payload: unknown) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}

function truncateOutput(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 4000 ? normalized.slice(0, 4000) : normalized;
}

function readAdapterResult(stdout: string | null | undefined): AtlasAutomationAdapterResult | null {
  const normalized = stdout?.trim() ?? "";

  if (normalized.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalized) as AtlasAutomationAdapterResult;

    if (
      parsed &&
      parsed.version === 1 &&
      typeof parsed.adapter === "string" &&
      typeof parsed.provider === "string" &&
      typeof parsed.operationId === "string" &&
      typeof parsed.summary === "string" &&
      parsed.metadata &&
      typeof parsed.metadata === "object" &&
      !Array.isArray(parsed.metadata)
    ) {
      return parsed;
    }
  } catch {}

  return null;
}

function executeConfiguredCommand(
  mode: AtlasCommandAdapterMode,
  command: string | null,
  payload: Record<string, unknown>
) {
  if (mode === "dry-run") {
    return {
      configured: Boolean(command),
      exitCode: null,
      stdout: "",
      stderr: "",
      adapterResult: null as AtlasAutomationAdapterResult | null
    };
  }

  if (!command) {
    throw new AtlasObservabilityOperationsError(
      "Alert dispatch command execution was requested but no command is configured.",
      "bad_request"
    );
  }

  const result = spawnSync("sh", ["-lc", command], {
    env: {
      ...process.env,
      ATLAS_OPERATION_PAYLOAD: JSON.stringify(payload)
    },
    stdio: "pipe",
    encoding: "utf8"
  });

  return {
    configured: true,
    exitCode: result.status,
    stdout: truncateOutput(result.stdout),
    stderr: truncateOutput(result.stderr),
    adapterResult: readAdapterResult(result.stdout)
  };
}

function normalizeMinimumSeverity(value: AtlasObservabilityAlertSeverity) {
  if (value === "critical" || value === "warning" || value === "info") {
    return value;
  }

  throw new AtlasObservabilityOperationsError("Minimum alert severity is invalid.", "bad_request");
}

function normalizeReason(value: string | null | undefined, label: string) {
  const normalized = value?.trim() ?? "";

  if (normalized.length < 12) {
    throw new AtlasObservabilityOperationsError(`${label} must include enough operational detail.`, "bad_request");
  }

  return normalized;
}

function toExecutionTargetEnvironment() {
  if (appRuntime.appEnv === "development") {
    return "DEVELOPMENT" as const;
  }

  if (appRuntime.appEnv === "staging") {
    return "STAGING" as const;
  }

  if (appRuntime.appEnv === "production") {
    return "PRODUCTION" as const;
  }

  return null;
}

function mapSnapshotRecord(record: {
  id: string;
  appEnv: string;
  releaseStage: string;
  actorUserEmail: string;
  configurationStatus: string;
  readinessStatus: string;
  totalRequests: number;
  errorCount: number;
  activeAlertCount: number;
  criticalAlertCount: number;
  reportPath: string;
  storageUrl: string | null;
  expiresAt: Date;
  createdAt: Date;
}) {
  return {
    id: record.id,
    appEnv: record.appEnv,
    releaseStage: record.releaseStage,
    actorUserEmail: record.actorUserEmail,
    configurationStatus: record.configurationStatus === "valid" ? "valid" : "invalid",
    readinessStatus:
      record.readinessStatus === "ready" || record.readinessStatus === "degraded" ? record.readinessStatus : "unknown",
    totalRequests: record.totalRequests,
    errorCount: record.errorCount,
    activeAlertCount: record.activeAlertCount,
    criticalAlertCount: record.criticalAlertCount,
    reportPath: record.reportPath,
    storageUrl: record.storageUrl,
    expiresAt: record.expiresAt.toISOString(),
    createdAt: record.createdAt.toISOString()
  } satisfies AtlasObservabilitySnapshotRecord;
}

function mapDispatchRecord(record: {
  id: string;
  provider: string;
  mode: "DRY_RUN" | "COMMAND";
  status: "SUCCEEDED" | "FAILED";
  minimumSeverity: string;
  actorUserEmail: string;
  summary: string;
  targetReference: string | null;
  reportPath: string;
  dispatchedAlertCount: number;
  criticalAlertCount: number;
  warningAlertCount: number;
  infoAlertCount: number;
  completedAt: Date;
  createdAt: Date;
  operationalIntegrationId: string | null;
}) {
  return {
    id: record.id,
    provider: record.provider,
    mode: record.mode === "COMMAND" ? "command" : "dry-run",
    status: record.status,
    minimumSeverity: normalizeMinimumSeverity(
      record.minimumSeverity === "critical" || record.minimumSeverity === "warning" ? record.minimumSeverity : "info"
    ),
    actorUserEmail: record.actorUserEmail,
    summary: record.summary,
    targetReference: record.targetReference,
    reportPath: record.reportPath,
    dispatchedAlertCount: record.dispatchedAlertCount,
    criticalAlertCount: record.criticalAlertCount,
    warningAlertCount: record.warningAlertCount,
    infoAlertCount: record.infoAlertCount,
    completedAt: record.completedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    operationalIntegrationId: record.operationalIntegrationId
  } satisfies AtlasObservabilityAlertDispatchRecord;
}

function toStringArray(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function mapIncidentTriggerRecord(record: {
  id: string;
  dedupeKey: string;
  appEnv: string;
  releaseStage: string;
  source: string;
  severity: string;
  status: string;
  title: string;
  summary: string;
  alertIds: Prisma.JsonValue;
  traceIds: Prisma.JsonValue;
  actorUserEmail: string;
  reportPath: string;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: record.id,
    dedupeKey: record.dedupeKey,
    appEnv: record.appEnv,
    releaseStage: record.releaseStage,
    source: record.source === "operator" || record.source === "release" ? record.source : "runtime",
    severity: normalizeMinimumSeverity(
      record.severity === "critical" || record.severity === "warning" ? record.severity : "info"
    ),
    status: record.status === "RESOLVED" ? "RESOLVED" : "ACTIVE",
    title: record.title,
    summary: record.summary,
    alertIds: toStringArray(record.alertIds),
    traceIds: toStringArray(record.traceIds),
    actorUserEmail: record.actorUserEmail,
    reportPath: record.reportPath,
    resolvedAt: record.resolvedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  } satisfies AtlasObservabilityIncidentTriggerRecord;
}

function collectJsonArtifactFiles(directoryPath: string): string[] {
  try {
    const entries = readdirSync(directoryPath, {
      withFileTypes: true
    });
    const filePaths: string[] = [];

    for (const entry of entries) {
      const childPath = resolve(directoryPath, entry.name);

      if (entry.isDirectory()) {
        filePaths.push(...collectJsonArtifactFiles(childPath));
        continue;
      }

      if (entry.isFile() && childPath.endsWith(".json")) {
        filePaths.push(childPath);
      }
    }

    return filePaths;
  } catch {
    return [];
  }
}

function createRetentionCutoffDate(retentionDays: number) {
  return new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
}

function pruneArtifactDirectory(directoryPath: string, cutoffTimestamp: number) {
  let deletedCount = 0;

  for (const filePath of collectJsonArtifactFiles(directoryPath)) {
    try {
      const stats = statSync(filePath);

      if (stats.mtimeMs < cutoffTimestamp) {
        rmSync(filePath, {
          force: true
        });
        deletedCount += 1;
      }
    } catch {}
  }

  return deletedCount;
}

export async function applyObservabilityRetentionPolicy(client: DatabaseClient = prisma) {
  const snapshotRetentionCutoff = createRetentionCutoffDate(observabilityRuntime.snapshotRetentionDays);
  const dispatchRetentionCutoff = createRetentionCutoffDate(observabilityRuntime.dispatchRetentionDays);
  const incidentRetentionCutoff = createRetentionCutoffDate(observabilityRuntime.incidentRetentionDays);
  const automationRetentionCutoff = createRetentionCutoffDate(observabilityRuntime.automationRetentionDays);
  const snapshotDeleted =
    "observabilitySnapshot" in client && client.observabilitySnapshot && typeof client.observabilitySnapshot.deleteMany === "function"
      ? await client.observabilitySnapshot.deleteMany({
          where: {
            OR: [
              {
                expiresAt: {
                  lt: new Date()
                }
              },
              {
                createdAt: {
                  lt: snapshotRetentionCutoff
                }
              }
            ]
          }
        })
      : { count: 0 };
  const dispatchDeleted =
    "observabilityAlertDispatch" in client &&
    client.observabilityAlertDispatch &&
    typeof client.observabilityAlertDispatch.deleteMany === "function"
      ? await client.observabilityAlertDispatch.deleteMany({
          where: {
            completedAt: {
              lt: dispatchRetentionCutoff
            }
          }
        })
      : { count: 0 };
  const incidentDeleted =
    "observabilityIncidentTrigger" in client &&
    client.observabilityIncidentTrigger &&
    typeof client.observabilityIncidentTrigger.deleteMany === "function"
      ? await client.observabilityIncidentTrigger.deleteMany({
          where: {
            status: "RESOLVED",
            OR: [
              {
                resolvedAt: {
                  lt: incidentRetentionCutoff
                }
              },
              {
                resolvedAt: null,
                updatedAt: {
                  lt: incidentRetentionCutoff
                }
              }
            ]
          }
        })
      : { count: 0 };

  return {
    deletedSnapshotRecords: snapshotDeleted.count,
    deletedDispatchRecords: dispatchDeleted.count,
    deletedResolvedIncidentTriggerRecords: incidentDeleted.count,
    deletedSnapshotArtifacts: pruneArtifactDirectory(
      resolveRepoPath(observabilityRuntime.snapshotDirectory),
      snapshotRetentionCutoff.getTime()
    ),
    deletedDispatchArtifacts: pruneArtifactDirectory(
      resolveRepoPath(observabilityRuntime.alertDispatchReportDirectory),
      dispatchRetentionCutoff.getTime()
    ),
    deletedIncidentArtifacts: pruneArtifactDirectory(
      resolveRepoPath(observabilityRuntime.incidentReportDirectory),
      incidentRetentionCutoff.getTime()
    ),
    deletedAutomationArtifacts: pruneArtifactDirectory(
      resolveRepoPath(observabilityRuntime.automationReportDirectory),
      automationRetentionCutoff.getTime()
    )
  } satisfies AtlasObservabilityRetentionSweepResult;
}

export async function listObservabilitySnapshots(
  actor: AtlasActorContext,
  options: {
    limit?: number;
  } = {},
  client: DatabaseClient = prisma
) {
  assertObservabilityActor(actor);

  const records = await client.observabilitySnapshot.findMany({
    where: {
      expiresAt: {
        gt: new Date()
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: options.limit ?? 12
  });

  return records.map((record) => mapSnapshotRecord(record));
}

export async function persistObservabilitySnapshot(
  input: {
    actor: AtlasActorContext;
    metrics: MetricsWithConfiguration;
    alerts: AtlasObservabilityAlertRecord[];
    incidentReadiness: AtlasIncidentReadinessRecord;
    reason: string;
  },
  client: DatabaseClient = prisma
) {
  assertObservabilityActor(input.actor);
  const reason = normalizeReason(input.reason, "Observability snapshot reason");
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + observabilityRuntime.telemetryRetentionDays * 24 * 60 * 60 * 1000);
  const reportPath = resolveRepoPath(
    observabilityRuntime.snapshotDirectory,
    appRuntime.appEnv,
    `${createTimestampFileFragment()}-snapshot.json`
  );
  const payload = {
    version: 1,
    generatedAt: createdAt.toISOString(),
    appEnv: appRuntime.appEnv,
    releaseStage: appRuntime.releaseStage,
    actorUserEmail: input.actor.user.email,
    reason,
    metrics: input.metrics,
    alerts: input.alerts,
    incidentReadiness: input.incidentReadiness
  };

  writeJsonArtifact(reportPath, payload);

  const record = await client.observabilitySnapshot.create({
    data: {
      appEnv: appRuntime.appEnv,
      releaseStage: appRuntime.releaseStage,
      actorUserEmail: input.actor.user.email,
      configurationStatus: input.metrics.configurationStatus,
      readinessStatus: input.metrics.lastReadinessStatus,
      totalRequests: input.metrics.totalRequests,
      errorCount: input.metrics.errorCount,
      activeAlertCount: input.alerts.length,
      criticalAlertCount: input.alerts.filter((alert) => alert.severity === "critical").length,
      reportPath,
      payload: payload as Prisma.JsonObject,
      expiresAt
    }
  });

  await applyObservabilityRetentionPolicy(client);

  return mapSnapshotRecord(record);
}

export async function listObservabilityAlertDispatches(
  actor: AtlasActorContext,
  options: {
    limit?: number;
  } = {},
  client: DatabaseClient = prisma
) {
  assertObservabilityActor(actor);

  const records = await client.observabilityAlertDispatch.findMany({
    orderBy: {
      completedAt: "desc"
    },
    take: options.limit ?? 12
  });

  return records.map((record) => mapDispatchRecord(record));
}

export async function listObservabilityIncidentTriggers(
  actor: AtlasActorContext,
  options: {
    limit?: number;
    status?: AtlasObservabilityIncidentTriggerRecord["status"];
  } = {},
  client: DatabaseClient = prisma
) {
  assertObservabilityActor(actor);

  const records = await client.observabilityIncidentTrigger.findMany({
    where: options.status
      ? {
          status: options.status
        }
      : undefined,
    orderBy: [
      {
        updatedAt: "desc"
      },
      {
        createdAt: "desc"
      }
    ],
    take: options.limit ?? 12
  });

  return records.map((record) => mapIncidentTriggerRecord(record));
}

export async function dispatchObservabilityAlerts(
  input: {
    actor: AtlasActorContext;
    minimumSeverity: AtlasObservabilityAlertSeverity;
    reason: string;
    alerts: AtlasObservabilityAlertRecord[];
    metrics: MetricsWithConfiguration;
    incidentReadiness: AtlasIncidentReadinessRecord;
  },
  client: DatabaseClient = prisma
) {
  assertObservabilityActor(input.actor);
  const minimumSeverity = normalizeMinimumSeverity(input.minimumSeverity);
  const reason = normalizeReason(input.reason, "Alert dispatch reason");
  const selectedAlerts = filterAtlasObservabilityAlertsBySeverity(input.alerts, minimumSeverity);
  const alertCounts = countAtlasObservabilityAlertsBySeverity(selectedAlerts);
  const runtimeTargetEnvironment = toExecutionTargetEnvironment();
  const resolvedIntegration =
    observabilityRuntime.alertDispatchMode === "command" && runtimeTargetEnvironment && selectedAlerts.length > 0
      ? await resolveOperationalIntegrationForExecution(
          {
            kind: "ALERT_DISPATCH",
            targetEnvironment: runtimeTargetEnvironment,
            provider: observabilityRuntime.alertDispatchProvider
          },
          client
        )
      : null;

  let status: "SUCCEEDED" | "FAILED" = "SUCCEEDED";
  let failureMessage: string | null = null;
  let command:
    | {
        configured: boolean;
        exitCode: number | null;
        stdout: string;
        stderr: string;
        adapterResult: AtlasAutomationAdapterResult | null;
      }
    | null = null;

  if (selectedAlerts.length > 0) {
    try {
      command = executeConfiguredCommand(
        observabilityRuntime.alertDispatchMode,
        observabilityRuntime.alertDispatchCommand,
        {
          provider: observabilityRuntime.alertDispatchProvider,
          actorUserEmail: input.actor.user.email,
          reason,
          minimumSeverity,
          appEnv: appRuntime.appEnv,
          releaseStage: appRuntime.releaseStage,
          targetReference: resolvedIntegration?.endpointReference ?? null,
          operationalIntegrationId: resolvedIntegration?.id ?? null,
          alerts: selectedAlerts.map((alert) => ({
            id: alert.id,
            title: alert.title,
            description: alert.description,
            severity: alert.severity,
            source: alert.source,
            runbookPath: alert.runbookPath,
            metricLabel: alert.metricLabel
          })),
          metrics: {
            totalRequests: input.metrics.totalRequests,
            errorCount: input.metrics.errorCount,
            averageDurationMs: input.metrics.averageDurationMs,
            maxDurationMs: input.metrics.maxDurationMs,
            lastReadinessStatus: input.metrics.lastReadinessStatus,
            configurationStatus: input.metrics.configurationStatus
          },
          incidentReadiness: input.incidentReadiness
        }
      );

      if (command.exitCode !== null && command.exitCode !== 0) {
        status = "FAILED";
        failureMessage = command.stderr || command.stdout || "Alert dispatch command failed.";
      }
    } catch (error) {
      status = "FAILED";
      failureMessage = error instanceof Error ? error.message : String(error);
    }
  }

  const completedAt = new Date().toISOString();
  const summary =
    selectedAlerts.length === 0
      ? `No alerts met the ${minimumSeverity} threshold for ${appRuntime.appEnv}.`
      : `${selectedAlerts.length} alerts met the ${minimumSeverity} threshold for ${appRuntime.appEnv}.`;
  const reportPath = resolveRepoPath(
    observabilityRuntime.alertDispatchReportDirectory,
    appRuntime.appEnv,
    `${createTimestampFileFragment()}-dispatch.json`
  );
  const reportPayload = {
    version: 1,
    provider: observabilityRuntime.alertDispatchProvider,
    mode: observabilityRuntime.alertDispatchMode,
    status,
    generatedAt: completedAt,
    actorUserEmail: input.actor.user.email,
    minimumSeverity,
    reason,
    summary,
    targetReference: command?.adapterResult?.targetRef ?? resolvedIntegration?.endpointReference ?? null,
    dispatchedAlertCount: selectedAlerts.length,
    severityCounts: alertCounts,
    command,
    alerts: selectedAlerts,
    metrics: input.metrics,
    incidentReadiness: input.incidentReadiness
  };

  writeJsonArtifact(reportPath, reportPayload);

  const record = await client.observabilityAlertDispatch.create({
    data: {
      provider: observabilityRuntime.alertDispatchProvider,
      mode: observabilityRuntime.alertDispatchMode === "command" ? "COMMAND" : "DRY_RUN",
      status,
      minimumSeverity,
      actorUserEmail: input.actor.user.email,
      summary,
      targetReference: command?.adapterResult?.targetRef ?? resolvedIntegration?.endpointReference ?? null,
      reportPath,
      dispatchedAlertCount: selectedAlerts.length,
      criticalAlertCount: alertCounts.critical,
      warningAlertCount: alertCounts.warning,
      infoAlertCount: alertCounts.info,
      payload: reportPayload as Prisma.JsonObject,
      operationalIntegrationId: resolvedIntegration?.id ?? null,
      completedAt: new Date(completedAt)
    }
  });

  await applyObservabilityRetentionPolicy(client);

  if (resolvedIntegration && status === "SUCCEEDED") {
    await touchOperationalIntegrationUsage(resolvedIntegration.id, client);
  }

  const mappedRecord = mapDispatchRecord(record);

  if (status === "FAILED") {
    throw new AtlasObservabilityOperationsError(failureMessage ?? "Alert dispatch failed.", "execution_failed");
  }

  return mappedRecord;
}

function collectIncidentTraceIds(
  metrics: MetricsWithConfiguration,
  workerTelemetry: AtlasWorkerTelemetryRecord | null | undefined
) {
  return Array.from(
    new Set([
      ...metrics.recentTraces.map((trace) => trace.traceId),
      ...(workerTelemetry?.snapshot?.recentTraces ?? []).map((trace) => trace.traceId)
    ])
  ).slice(0, 12);
}

async function createObservabilityAuditEvent(
  transaction: DatabaseClient,
  actor: AtlasActorContext,
  input: {
    targetId: string;
    eventType: string;
    payload: Prisma.InputJsonValue;
  }
) {
  await transaction.auditEvent.create({
    data: {
      organizationId: actor.organization.id,
      userId: actor.user.id,
      actorType: "HUMAN",
      eventType: input.eventType,
      targetType: "ObservabilityIncidentTrigger",
      targetId: input.targetId,
      requestId: null,
      payload: input.payload
    }
  });
}

async function upsertObservabilityNotification(
  transaction: DatabaseClient,
  input: {
    dedupeKey: string;
    organizationId: string;
    title: string;
    description: string;
    active: boolean;
  }
) {
  await transaction.notification.upsert({
    where: {
      dedupeKey: input.dedupeKey
    },
    create: {
      dedupeKey: input.dedupeKey,
      organizationId: input.organizationId,
      caseId: null,
      category: "observability-incident",
      title: input.title,
      description: input.description,
      status: input.active ? "UNREAD" : "READ"
    },
    update: {
      organizationId: input.organizationId,
      category: "observability-incident",
      title: input.title,
      description: input.description,
      status: input.active ? "UNREAD" : "READ"
    }
  });
}

export async function syncObservabilityIncidentTriggers(
  input: {
    actor: AtlasActorContext;
    minimumSeverity: AtlasObservabilityAlertSeverity;
    reason: string;
    alerts: AtlasObservabilityAlertRecord[];
    metrics: MetricsWithConfiguration;
    incidentReadiness: AtlasIncidentReadinessRecord;
    workerTelemetry?: AtlasWorkerTelemetryRecord | null;
  },
  client: DatabaseClient = prisma
) {
  assertObservabilityActor(input.actor);
  const minimumSeverity = normalizeMinimumSeverity(input.minimumSeverity);
  const reason = normalizeReason(input.reason, "Incident trigger reason");
  const selectedAlerts = filterAtlasObservabilityAlertsBySeverity(input.alerts, minimumSeverity);
  const traceIds = collectIncidentTraceIds(input.metrics, input.workerTelemetry);
  const existingRecords = await client.observabilityIncidentTrigger.findMany({
    where: {
      appEnv: appRuntime.appEnv
    }
  });
  const existingByDedupeKey = new Map(existingRecords.map((record) => [record.dedupeKey, record]));
  const activeDedupeKeys = new Set<string>();
  const syncedRecords: AtlasObservabilityIncidentTriggerRecord[] = [];
  let createdCount = 0;
  let resolvedCount = 0;

  for (const alert of selectedAlerts) {
    const dedupeKey = `${appRuntime.appEnv}:${alert.id}`;
    const notificationDedupeKey = `observability-incident:${dedupeKey}`;
    const reportPath = resolveRepoPath(
      observabilityRuntime.incidentReportDirectory,
      appRuntime.appEnv,
      `${createTimestampFileFragment()}-${alert.id}.json`
    );
    const payload = {
      version: 1,
      generatedAt: new Date().toISOString(),
      appEnv: appRuntime.appEnv,
      releaseStage: appRuntime.releaseStage,
      minimumSeverity,
      reason,
      alert,
      traceIds,
      metrics: input.metrics,
      workerTelemetry: input.workerTelemetry ?? null,
      incidentReadiness: input.incidentReadiness
    };
    const existing = existingByDedupeKey.get(dedupeKey);
    writeJsonArtifact(reportPath, payload);
    activeDedupeKeys.add(dedupeKey);

    const record =
      existing !== undefined
        ? await client.observabilityIncidentTrigger.update({
            where: {
              id: existing.id
            },
            data: {
              releaseStage: appRuntime.releaseStage,
              source: alert.source,
              severity: alert.severity,
              status: "ACTIVE",
              title: alert.title,
              summary: alert.description,
              alertIds: [alert.id],
              traceIds,
              actorUserEmail: input.actor.user.email,
              reportPath,
              payload: payload as Prisma.JsonObject,
              resolvedAt: null
            }
          })
        : await client.observabilityIncidentTrigger.create({
            data: {
              dedupeKey,
              appEnv: appRuntime.appEnv,
              releaseStage: appRuntime.releaseStage,
              source: alert.source,
              severity: alert.severity,
              status: "ACTIVE",
              title: alert.title,
              summary: alert.description,
              alertIds: [alert.id],
              traceIds,
              actorUserEmail: input.actor.user.email,
              reportPath,
              payload: payload as Prisma.JsonObject
            }
          });

    if (!existing || existing.status !== "ACTIVE") {
      createdCount += 1;
      await upsertObservabilityNotification(client, {
        dedupeKey: notificationDedupeKey,
        organizationId: input.actor.organization.id,
        title: alert.title,
        description: alert.description,
        active: true
      });
      await createObservabilityAuditEvent(client, input.actor, {
        targetId: record.id,
        eventType: "observability.incident_triggered",
        payload: {
          dedupeKey,
          alertId: alert.id,
          reason,
          traceIds
        }
      });
    }

    syncedRecords.push(mapIncidentTriggerRecord(record));
  }

  for (const existing of existingRecords) {
    if (existing.status !== "ACTIVE" || activeDedupeKeys.has(existing.dedupeKey)) {
      continue;
    }

    const resolved = await client.observabilityIncidentTrigger.update({
      where: {
        id: existing.id
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date()
      }
    });
    resolvedCount += 1;
    await upsertObservabilityNotification(client, {
      dedupeKey: `observability-incident:${existing.dedupeKey}`,
      organizationId: input.actor.organization.id,
      title: existing.title,
      description: existing.summary,
      active: false
    });
    await createObservabilityAuditEvent(client, input.actor, {
      targetId: resolved.id,
      eventType: "observability.incident_resolved",
      payload: {
        dedupeKey: existing.dedupeKey,
        reason
      }
    });
  }

  const activeRecords = await client.observabilityIncidentTrigger.findMany({
    where: {
      appEnv: appRuntime.appEnv,
      status: "ACTIVE"
    },
    orderBy: [
      {
        updatedAt: "desc"
      },
      {
        createdAt: "desc"
      }
    ]
  });

  await applyObservabilityRetentionPolicy(client);

  return {
    items: activeRecords.map((record) => mapIncidentTriggerRecord(record)),
    createdCount,
    resolvedCount,
    activeCount: activeRecords.length
  };
}
