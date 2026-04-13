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
  type AtlasObservabilityAlertSeverity,
  type AtlasObservabilitySnapshotRecord
} from "@atlas/domain";
import { Prisma, type PrismaClient } from "./generated/client/index.js";
import { prisma } from "./client";
import { resolveOperationalIntegrationForExecution, touchOperationalIntegrationUsage } from "./operational-integrations";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

type MetricsWithConfiguration = AtlasApiRuntimeTelemetryRecord;

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

function pruneExpiredSnapshotArtifacts() {
  const cutoffTimestamp = Date.now() - observabilityRuntime.telemetryRetentionDays * 24 * 60 * 60 * 1000;

  for (const filePath of collectJsonArtifactFiles(resolveRepoPath(observabilityRuntime.snapshotDirectory))) {
    try {
      const stats = statSync(filePath);

      if (stats.mtimeMs < cutoffTimestamp) {
        rmSync(filePath, {
          force: true
        });
      }
    } catch {}
  }
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
  await client.observabilitySnapshot.deleteMany({
    where: {
      expiresAt: {
        lt: new Date()
      }
    }
  });
  pruneExpiredSnapshotArtifacts();

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

  if (resolvedIntegration && status === "SUCCEEDED") {
    await touchOperationalIntegrationUsage(resolvedIntegration.id, client);
  }

  const mappedRecord = mapDispatchRecord(record);

  if (status === "FAILED") {
    throw new AtlasObservabilityOperationsError(failureMessage ?? "Alert dispatch failed.", "execution_failed");
  }

  return mappedRecord;
}
