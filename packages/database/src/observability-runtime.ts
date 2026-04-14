import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AtlasActorContext } from "@atlas/auth";
import { appRuntime, observabilityRuntime } from "@atlas/config";
import {
  buildAtlasIncidentReadinessRecord,
  buildAtlasObservabilityAlerts,
  getAtlasObservabilityDeliveryKind,
  isAtlasPagingProvider,
  buildAtlasWorkerTelemetryRecord,
  type AtlasApiRuntimeTelemetryRecord,
  type AtlasObservabilityAlertSeverity,
  type AtlasObservabilityAutomationRunRecord,
  type AtlasObservabilityAutomationStatusRecord,
  type AtlasObservabilityTelemetryOwnershipRecord,
  type AtlasWorkerRuntimeMetricsSnapshot,
  type AtlasWorkerTelemetryRecord
} from "@atlas/domain";
import { type PrismaClient } from "./generated/client/index.js";
import { prisma } from "./client";
import { createOwnedExecutionTraceContext } from "./operation-trace";
import { getOperatorOverview } from "./operator-workflow";
import {
  AtlasObservabilityOperationsError,
  applyObservabilityRetentionPolicy,
  dispatchObservabilityAlerts,
  listObservabilityIncidentTriggers,
  persistObservabilitySnapshot,
  syncObservabilityIncidentTriggers
} from "./observability-operations";

type DatabaseClient = PrismaClient;

type AtlasObservabilityAutomationTrigger = "manual" | "scheduled";

type AtlasObservabilityAutomationReportPayload = {
  version: 1;
  status?: "SUCCEEDED" | "FAILED";
  trigger?: AtlasObservabilityAutomationTrigger;
  generatedAt?: string;
  appEnv?: string;
  releaseStage?: string;
  actorUserEmail?: string | null;
  reason?: string | null;
  minimumSeverity?: AtlasObservabilityAlertSeverity;
  dispatchAlerts?: boolean;
  triggerIncidents?: boolean;
  alertCount?: number | null;
  workerTelemetry?: {
    status?: AtlasWorkerTelemetryRecord["status"];
  } | null;
  snapshot?: {
    id?: string | null;
  } | null;
  incidentTriggers?: {
    activeCount?: number | null;
  } | null;
  dispatch?: {
    id?: string | null;
  } | null;
  reportPath?: string;
  errorMessage?: string | null;
};

function resolveRuntimeSnapshotPath(fileName: string) {
  return resolve(import.meta.dirname, "../../..", observabilityRuntime.runtimeSnapshotDirectory, fileName);
}

function resolveAutomationReportPath() {
  return resolve(
    import.meta.dirname,
    "../../..",
    observabilityRuntime.automationReportDirectory,
    appRuntime.appEnv,
    `${new Date().toISOString().replace(/[:.]/g, "-")}-observability-automation.json`
  );
}

function assertObservabilityViewer(actor: AtlasActorContext) {
  if (actor.workspace !== "OPERATOR" || actor.organization.kind !== "OPERATOR") {
    throw new AtlasObservabilityOperationsError(
      "Observability automation status can only be viewed from the operator workspace.",
      "forbidden"
    );
  }
}

function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
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

function normalizeAutomationReportMinimumSeverity(
  value: AtlasObservabilityAlertSeverity | string | null | undefined
): AtlasObservabilityAlertSeverity {
  return value === "critical" || value === "warning" ? value : "info";
}

function formatAgeLabel(minutes: number) {
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function calculateAgeMinutes(now: Date, recordedAt: string | null) {
  if (!recordedAt) {
    return null;
  }

  return Math.max(0, Math.round((now.getTime() - new Date(recordedAt).getTime()) / 60000));
}

function buildApiTelemetryOwnershipRecord(now: Date): AtlasObservabilityTelemetryOwnershipRecord {
  const telemetry = readPublishedApiRuntimeTelemetry();

  if (!telemetry) {
    return {
      key: "api-runtime",
      label: "API runtime telemetry",
      status: "critical",
      detail: "No published API runtime snapshot is available for operators.",
      lastRecordedAt: null
    };
  }

  const ageMinutes = calculateAgeMinutes(now, telemetry.recordedAt) ?? 0;
  const staleAfterMinutes = Math.max(1, observabilityRuntime.workerTelemetryStaleAfterMinutes);

  return {
    key: "api-runtime",
    label: "API runtime telemetry",
    status: ageMinutes <= staleAfterMinutes ? "healthy" : ageMinutes <= staleAfterMinutes * 3 ? "warning" : "critical",
    detail: `Last published ${formatAgeLabel(ageMinutes)} ago from ${telemetry.deploymentSlot}.`,
    lastRecordedAt: telemetry.recordedAt
  };
}

function buildWorkerTelemetryOwnershipRecord(
  workerTelemetry: AtlasWorkerTelemetryRecord
): AtlasObservabilityTelemetryOwnershipRecord {
  return {
    key: "worker-runtime",
    label: "Worker runtime telemetry",
    status:
      workerTelemetry.status === "healthy"
        ? "healthy"
        : workerTelemetry.status === "warning"
          ? "warning"
          : "critical",
    detail: workerTelemetry.summary,
    lastRecordedAt: workerTelemetry.recordedAt
  };
}

function buildAutomationCadenceOwnershipRecord(
  now: Date,
  latestRun: AtlasObservabilityAutomationRunRecord | null
): AtlasObservabilityTelemetryOwnershipRecord {
  if (observabilityRuntime.automationScheduleMode !== "interval") {
    return {
      key: "automation-cadence",
      label: "Automation cadence",
      status: "warning",
      detail: "Scheduled observability automation is disabled, so telemetry cadence depends on manual runs.",
      lastRecordedAt: latestRun?.generatedAt ?? null
    };
  }

  if (!latestRun) {
    return {
      key: "automation-cadence",
      label: "Automation cadence",
      status: "critical",
      detail: "No observability automation run has been recorded for the active schedule.",
      lastRecordedAt: null
    };
  }

  const ageMinutes = calculateAgeMinutes(now, latestRun.generatedAt) ?? 0;
  const healthyWindowMinutes = Math.max(1, observabilityRuntime.automationScheduleIntervalMinutes * 2);

  if (latestRun.status === "FAILED") {
    return {
      key: "automation-cadence",
      label: "Automation cadence",
      status: "critical",
      detail: `Latest automation run failed ${formatAgeLabel(ageMinutes)} ago.`,
      lastRecordedAt: latestRun.generatedAt
    };
  }

  return {
    key: "automation-cadence",
    label: "Automation cadence",
    status:
      ageMinutes <= healthyWindowMinutes
        ? "healthy"
        : ageMinutes <= healthyWindowMinutes * 2
          ? "warning"
          : "critical",
    detail: `Latest automation run completed ${formatAgeLabel(ageMinutes)} ago.`,
    lastRecordedAt: latestRun.generatedAt
  };
}

function mapAutomationRunRecord(
  payload: AtlasObservabilityAutomationReportPayload,
  reportPath: string,
  generatedAtFallback: string
): AtlasObservabilityAutomationRunRecord {
  return {
    id: reportPath,
    status: payload.status === "FAILED" ? "FAILED" : "SUCCEEDED",
    trigger: payload.trigger === "scheduled" ? "scheduled" : "manual",
    generatedAt: payload.generatedAt ?? generatedAtFallback,
    actorUserEmail: typeof payload.actorUserEmail === "string" ? payload.actorUserEmail : null,
    reason: typeof payload.reason === "string" ? payload.reason : null,
    minimumSeverity: normalizeAutomationReportMinimumSeverity(payload.minimumSeverity),
    dispatchAlerts: Boolean(payload.dispatchAlerts),
    triggerIncidents: payload.triggerIncidents !== false,
    alertCount: typeof payload.alertCount === "number" ? payload.alertCount : null,
    activeIncidentCount:
      typeof payload.incidentTriggers?.activeCount === "number" ? payload.incidentTriggers.activeCount : null,
    snapshotId: typeof payload.snapshot?.id === "string" ? payload.snapshot.id : null,
    dispatchId: typeof payload.dispatch?.id === "string" ? payload.dispatch.id : null,
    workerTelemetryStatus:
      payload.workerTelemetry?.status === "healthy" ||
      payload.workerTelemetry?.status === "warning" ||
      payload.workerTelemetry?.status === "critical" ||
      payload.workerTelemetry?.status === "stale" ||
      payload.workerTelemetry?.status === "missing"
        ? payload.workerTelemetry.status
        : null,
    reportPath,
    errorMessage: typeof payload.errorMessage === "string" ? payload.errorMessage : null
  };
}

function writeObservabilityAutomationReport(payload: AtlasObservabilityAutomationReportPayload) {
  const reportPath = resolveAutomationReportPath();

  mkdirSync(dirname(reportPath), {
    recursive: true
  });
  writeFileSync(reportPath, `${JSON.stringify({ ...payload, reportPath }, null, 2)}\n`, "utf8");

  return reportPath;
}

function normalizeReason(value: string) {
  const normalized = value.trim();

  if (normalized.length < 12) {
    throw new AtlasObservabilityOperationsError(
      "Observability automation reason must include enough operational detail.",
      "bad_request"
    );
  }

  return normalized;
}

function normalizeActorUserEmail(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized.length < 5 || !normalized.includes("@")) {
    throw new AtlasObservabilityOperationsError("Operator identity email is required for observability automation.", "bad_request");
  }

  return normalized;
}

async function resolveAutomationActor(actorUserEmail: string, client: DatabaseClient) {
  const normalizedEmail = normalizeActorUserEmail(actorUserEmail);
  const membership = await client.membership.findFirst({
    where: {
      role: {
        in: ["OWNER", "ADMIN", "OPERATOR"]
      },
      organization: {
        kind: "OPERATOR"
      },
      user: {
        email: normalizedEmail
      }
    },
    include: {
      user: true,
      organization: true
    }
  });

  if (!membership) {
    throw new AtlasObservabilityOperationsError(
      "Observability automation requires a real operator membership for the supplied email.",
      "forbidden"
    );
  }

  return {
    user: {
      id: membership.user.id,
      email: membership.user.email,
      name: membership.user.name
    },
    organization: {
      id: membership.organization.id,
      slug: membership.organization.slug,
      name: membership.organization.name,
      kind: membership.organization.kind
    },
    membership: {
      id: membership.id,
      role: membership.role
    },
    workspace: "OPERATOR",
    agentId: null,
    source: "identity-provider",
    providerMode: "external-oidc",
    sessionId: null
  } satisfies AtlasActorContext;
}

export function readPublishedApiRuntimeTelemetry() {
  return readJsonFile<AtlasApiRuntimeTelemetryRecord>(resolveRuntimeSnapshotPath("api.json"));
}

export function readPublishedWorkerTelemetry(now?: string) {
  const snapshotPath = resolveRuntimeSnapshotPath("worker.json");
  const snapshot = readJsonFile<AtlasWorkerRuntimeMetricsSnapshot>(snapshotPath);

  return buildAtlasWorkerTelemetryRecord({
    snapshot,
    snapshotPath: snapshot ? snapshotPath : null,
    staleAfterMinutes: observabilityRuntime.workerTelemetryStaleAfterMinutes,
    now
  });
}

export function listObservabilityAutomationRuns(
  actor: AtlasActorContext,
  options: {
    limit?: number;
  } = {}
) {
  assertObservabilityViewer(actor);

  return collectJsonArtifactFiles(resolve(import.meta.dirname, "../../..", observabilityRuntime.automationReportDirectory))
    .map((filePath) => {
      const payload = readJsonFile<AtlasObservabilityAutomationReportPayload>(filePath);

      if (!payload) {
        return null;
      }

      try {
        return mapAutomationRunRecord(payload, filePath, statSync(filePath).mtime.toISOString());
      } catch {
        return null;
      }
    })
    .filter((item): item is AtlasObservabilityAutomationRunRecord => item !== null)
    .sort((left, right) => new Date(right.generatedAt).getTime() - new Date(left.generatedAt).getTime())
    .slice(0, options.limit ?? 12);
}

export function getObservabilityAutomationStatus(
  actor: AtlasActorContext,
  options: {
    limit?: number;
    now?: string;
  } = {}
) {
  assertObservabilityViewer(actor);
  const recentRuns = listObservabilityAutomationRuns(actor, options);
  const latestRun = recentRuns[0] ?? null;
  const now = new Date(options.now ?? new Date().toISOString());
  const workerTelemetry = readPublishedWorkerTelemetry(options.now);

  return {
    scheduleMode: observabilityRuntime.automationScheduleMode,
    intervalMinutes: observabilityRuntime.automationScheduleIntervalMinutes,
    startupDelaySeconds: observabilityRuntime.automationScheduleStartupDelaySeconds,
    actorUserEmail: observabilityRuntime.automationActorUserEmail,
    minimumSeverity: observabilityRuntime.automationDefaultMinimumSeverity,
    dispatchAlerts: observabilityRuntime.automationDispatchAlerts,
    dispatchMode: observabilityRuntime.alertDispatchMode,
    dispatchProvider: observabilityRuntime.alertDispatchProvider,
    dispatchDeliveryKind: getAtlasObservabilityDeliveryKind(observabilityRuntime.alertDispatchProvider),
    triggerIncidents: observabilityRuntime.automationTriggerIncidents,
    retention: {
      snapshotRetentionDays: observabilityRuntime.snapshotRetentionDays,
      dispatchRetentionDays: observabilityRuntime.dispatchRetentionDays,
      incidentRetentionDays: observabilityRuntime.incidentRetentionDays,
      automationRetentionDays: observabilityRuntime.automationRetentionDays
    },
    lastRunAt: latestRun?.generatedAt ?? null,
    lastRunStatus: latestRun?.status ?? null,
    lastReportPath: latestRun?.reportPath ?? null,
    telemetryOwnership: [
      buildApiTelemetryOwnershipRecord(now),
      buildWorkerTelemetryOwnershipRecord(workerTelemetry),
      buildAutomationCadenceOwnershipRecord(now, latestRun)
    ],
    recentRuns
  } satisfies AtlasObservabilityAutomationStatusRecord;
}

export function writeObservabilityAutomationFailureReport(input: {
  trigger: AtlasObservabilityAutomationTrigger;
  actorUserEmail: string | null;
  reason: string | null;
  minimumSeverity: AtlasObservabilityAlertSeverity;
  dispatchAlerts: boolean;
  triggerIncidents: boolean;
  generatedAt?: string;
  errorMessage: string;
}) {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const reportPath = writeObservabilityAutomationReport({
    version: 1,
    status: "FAILED",
    trigger: input.trigger,
    generatedAt,
    appEnv: appRuntime.appEnv,
    releaseStage: appRuntime.releaseStage,
    actorUserEmail: input.actorUserEmail,
    reason: input.reason,
    minimumSeverity: input.minimumSeverity,
    dispatchAlerts: input.dispatchAlerts,
    triggerIncidents: input.triggerIncidents,
    alertCount: null,
    workerTelemetry: null,
    snapshot: null,
    incidentTriggers: null,
    dispatch: null,
    errorMessage: input.errorMessage
  });

  return mapAutomationRunRecord(
    {
      version: 1,
      status: "FAILED",
      trigger: input.trigger,
      generatedAt,
      actorUserEmail: input.actorUserEmail,
      reason: input.reason,
      minimumSeverity: input.minimumSeverity,
      dispatchAlerts: input.dispatchAlerts,
      triggerIncidents: input.triggerIncidents,
      errorMessage: input.errorMessage
    },
    reportPath,
    generatedAt
  );
}

export async function buildObservabilityAutomationPosture(
  input: {
    actorUserEmail: string;
    now?: string;
  },
  client: DatabaseClient = prisma
) {
  const actor = await resolveAutomationActor(input.actorUserEmail, client);
  const metrics = readPublishedApiRuntimeTelemetry();

  if (!metrics) {
    throw new AtlasObservabilityOperationsError(
      "Observability automation requires a published API runtime snapshot. Start the API and generate runtime traffic first.",
      "bad_request"
    );
  }

  const workerTelemetry = readPublishedWorkerTelemetry(input.now);
  const overview = await getOperatorOverview(actor, client);
  const activeIncidentTriggers = await listObservabilityIncidentTriggers(
    actor,
    {
      limit: 50,
      status: "ACTIVE"
    },
    client
  );
  const alerts = buildAtlasObservabilityAlerts({
    metrics,
    overview,
    configurationStatus: metrics.configurationStatus,
    releaseStage: appRuntime.releaseStage,
    workerTelemetry,
    generatedAt: input.now
  });
  const incidentReadiness = buildAtlasIncidentReadinessRecord({
    releaseStage: appRuntime.releaseStage,
    configurationStatus: metrics.configurationStatus,
    hasRequestCorrelation: true,
    hasDistributedTracing:
      metrics.traceCoverageRate === 1 &&
      (!workerTelemetry.snapshot ||
        workerTelemetry.snapshot.processedCount === 0 ||
        workerTelemetry.snapshot.traceCoverageRate === 1),
    hasMetricsEndpoint: true,
    hasHealthEndpoints: true,
    hasRollbackVerification: true,
    hasBackupRestoreRunbook: true,
    hasExternalPaging:
      observabilityRuntime.alertDispatchMode === "command" &&
      isAtlasPagingProvider(observabilityRuntime.alertDispatchProvider),
    pagingProvider: isAtlasPagingProvider(observabilityRuntime.alertDispatchProvider)
      ? observabilityRuntime.alertDispatchProvider
      : null,
    hasAutomatedIncidentTriggers: observabilityRuntime.automationTriggerIncidents,
    workerTelemetryStatus: workerTelemetry.status,
    activeAlertCount: alerts.length,
    activeIncidentTriggerCount: activeIncidentTriggers.length
  });

  return {
    actor,
    metrics,
    workerTelemetry,
    overview,
    alerts,
    incidentReadiness,
    activeIncidentTriggers
  };
}

export async function executeObservabilityAutomation(
  input: {
    actorUserEmail: string;
    reason: string;
    minimumSeverity?: AtlasObservabilityAlertSeverity;
    dispatchAlerts?: boolean;
    triggerIncidents?: boolean;
    trigger?: AtlasObservabilityAutomationTrigger;
    now?: string;
    trace?: ReturnType<typeof createOwnedExecutionTraceContext>;
  },
  client: DatabaseClient = prisma
) {
  const reason = normalizeReason(input.reason);
  const posture = await buildObservabilityAutomationPosture(
    {
      actorUserEmail: input.actorUserEmail,
      now: input.now
    },
    client
  );
  const minimumSeverity =
    input.minimumSeverity === "critical" || input.minimumSeverity === "warning" || input.minimumSeverity === "info"
      ? input.minimumSeverity
      : observabilityRuntime.automationDefaultMinimumSeverity;
  const trace = input.trace ?? createOwnedExecutionTraceContext("worker");
  const snapshot = await persistObservabilitySnapshot(
    {
      actor: posture.actor,
      metrics: posture.metrics,
      alerts: posture.alerts,
      incidentReadiness: posture.incidentReadiness,
      reason
    },
    client
  );
  const incidentTriggers =
    input.triggerIncidents ?? observabilityRuntime.automationTriggerIncidents
      ? await syncObservabilityIncidentTriggers(
          {
            actor: posture.actor,
            minimumSeverity: observabilityRuntime.incidentMinimumSeverity,
            reason,
            alerts: posture.alerts,
            metrics: posture.metrics,
            incidentReadiness: posture.incidentReadiness,
            workerTelemetry: posture.workerTelemetry
          },
          client
        )
      : null;
  const dispatch = input.dispatchAlerts
    ? await dispatchObservabilityAlerts(
        {
          actor: posture.actor,
          minimumSeverity,
          reason,
          alerts: posture.alerts,
          metrics: posture.metrics,
          incidentReadiness: posture.incidentReadiness,
          trace
        },
        client
      )
    : null;
  await applyObservabilityRetentionPolicy(client);
  const report = {
    version: 1 as const,
    status: "SUCCEEDED" as const,
    trigger: input.trigger ?? "manual",
    generatedAt: input.now ?? new Date().toISOString(),
    appEnv: appRuntime.appEnv,
    releaseStage: appRuntime.releaseStage,
    actorUserEmail: posture.actor.user.email,
    reason,
    minimumSeverity,
    dispatchAlerts: Boolean(input.dispatchAlerts),
    triggerIncidents: input.triggerIncidents ?? observabilityRuntime.automationTriggerIncidents,
    metrics: posture.metrics,
    workerTelemetry: posture.workerTelemetry,
    alertCount: posture.alerts.length,
    incidentReadiness: posture.incidentReadiness,
    snapshot,
    incidentTriggers,
    dispatch,
    errorMessage: null
  };
  const reportPath = writeObservabilityAutomationReport(report);

  return {
    report,
    reportPath,
    snapshot,
    incidentTriggers,
    dispatch,
    workerTelemetry: posture.workerTelemetry
  };
}
