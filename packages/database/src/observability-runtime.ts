import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AtlasActorContext } from "@atlas/auth";
import { appRuntime, observabilityRuntime } from "@atlas/config";
import {
  buildAtlasIncidentReadinessRecord,
  buildAtlasObservabilityAlerts,
  buildAtlasObservabilityTelemetryRemediation,
  getAtlasObservabilityDeliveryKind,
  isAtlasPagingProvider,
  buildAtlasWorkerTelemetryRecord,
  type AtlasApiRuntimeTelemetryRecord,
  type AtlasIncidentReadinessRecord,
  type AtlasObservabilityAlertRecord,
  type AtlasObservabilityAlertSeverity,
  type AtlasObservabilityAutomationRunRecord,
  type AtlasObservabilityAutomationStatusRecord,
  type AtlasObservabilityTelemetryRemediationAction,
  type AtlasObservabilityTelemetryRemediationActionRecord,
  type AtlasObservabilityTelemetryRemediationOwnershipRecord,
  type AtlasObservabilityTelemetryRecoveryEscalationRecord,
  type AtlasObservabilityTelemetryOwnershipPolicy,
  type AtlasObservabilityTelemetryRecoveryStatus,
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
  telemetryPolicy?: AtlasObservabilityTelemetryOwnershipPolicy;
  telemetryRecovery?: {
    status?: AtlasObservabilityTelemetryRecoveryStatus;
    beforeOwnership?: AtlasObservabilityTelemetryOwnershipRecord[];
    afterOwnership?: AtlasObservabilityTelemetryOwnershipRecord[];
    recoveredKeys?: AtlasObservabilityTelemetryOwnershipRecord["key"][];
    remainingKeys?: AtlasObservabilityTelemetryOwnershipRecord["key"][];
  } | null;
  reportPath?: string;
  errorMessage?: string | null;
};

type AtlasObservabilityTelemetryRemediationReportPayload = {
  version: 1;
  action: AtlasObservabilityTelemetryRemediationAction;
  generatedAt: string;
  actorUserEmail: string;
  reason: string;
  remediationStatus: "ready" | "action_required" | "escalated";
  affectedOwnershipKeys: AtlasObservabilityTelemetryOwnershipRecord["key"][];
  latestAutomationReportPath: string | null;
  reportPath?: string;
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

function resolveRemediationReportPath() {
  return resolve(
    import.meta.dirname,
    "../../..",
    observabilityRuntime.remediationReportDirectory,
    appRuntime.appEnv,
    `${new Date().toISOString().replace(/[:.]/g, "-")}-telemetry-remediation.json`
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

function listDegradedTelemetryOwnershipKeys(items: AtlasObservabilityTelemetryOwnershipRecord[]) {
  return items.filter((item) => item.status !== "healthy").map((item) => item.key);
}

function normalizeTelemetryOwnershipPolicy(
  value: AtlasObservabilityTelemetryOwnershipPolicy | string | null | undefined
): AtlasObservabilityTelemetryOwnershipPolicy {
  return value === "recover" ? "recover" : "monitor";
}

function normalizeTelemetryRecoveryStatus(
  value: AtlasObservabilityTelemetryRecoveryStatus | string | null | undefined
): AtlasObservabilityTelemetryRecoveryStatus {
  return value === "no_action" ||
    value === "failed" ||
    value === "recovered" ||
    value === "partial" ||
    value === "unchanged"
    ? value
    : "not_requested";
}

function isTelemetryRecoveryBreach(run: Pick<
  AtlasObservabilityAutomationRunRecord,
  "status" | "telemetryPolicy" | "telemetryRecoveryStatus"
>) {
  if (run.telemetryPolicy !== "recover") {
    return false;
  }

  return (
    run.status === "FAILED" ||
    run.telemetryRecoveryStatus === "failed" ||
    run.telemetryRecoveryStatus === "partial" ||
    run.telemetryRecoveryStatus === "unchanged"
  );
}

function buildTelemetryRecoveryEscalation(
  recentRuns: AtlasObservabilityAutomationRunRecord[]
): AtlasObservabilityTelemetryRecoveryEscalationRecord {
  const threshold = Math.max(1, observabilityRuntime.automationTelemetryEscalationThreshold);
  let consecutiveBreachedRuns = 0;

  for (const run of recentRuns) {
    if (!isTelemetryRecoveryBreach(run)) {
      break;
    }

    consecutiveBreachedRuns += 1;
  }

  return {
    status: consecutiveBreachedRuns >= threshold ? "triggered" : "idle",
    consecutiveBreachedRuns,
    threshold,
    detail:
      consecutiveBreachedRuns >= threshold
        ? `Telemetry auto-recovery has breached its target for ${consecutiveBreachedRuns} consecutive run${consecutiveBreachedRuns === 1 ? "" : "s"}.`
        : consecutiveBreachedRuns === 0
          ? "Recent telemetry auto-recovery runs are not currently breaching the escalation threshold."
          : `Telemetry auto-recovery has breached its target for ${consecutiveBreachedRuns} consecutive run${consecutiveBreachedRuns === 1 ? "" : "s"}, below the escalation threshold of ${threshold}.`
  };
}

function mapAutomationRunRecord(
  payload: AtlasObservabilityAutomationReportPayload,
  reportPath: string,
  generatedAtFallback: string
): AtlasObservabilityAutomationRunRecord {
  const telemetryRecovery = payload.telemetryRecovery;

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
    telemetryPolicy: normalizeTelemetryOwnershipPolicy(payload.telemetryPolicy),
    telemetryRecoveryStatus: normalizeTelemetryRecoveryStatus(telemetryRecovery?.status),
    recoveredOwnershipCount: Array.isArray(telemetryRecovery?.recoveredKeys) ? telemetryRecovery.recoveredKeys.length : 0,
    remainingOwnershipCount: Array.isArray(telemetryRecovery?.remainingKeys) ? telemetryRecovery.remainingKeys.length : 0,
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

function mapTelemetryRemediationActionRecord(
  payload: AtlasObservabilityTelemetryRemediationReportPayload,
  reportPath: string,
  generatedAtFallback: string
): AtlasObservabilityTelemetryRemediationActionRecord {
  return {
    id: reportPath,
    action: payload.action === "RESOLVED" ? "RESOLVED" : "ACKNOWLEDGED",
    generatedAt: payload.generatedAt ?? generatedAtFallback,
    actorUserEmail: payload.actorUserEmail,
    reason: payload.reason,
    remediationStatus:
      payload.remediationStatus === "ready" ||
      payload.remediationStatus === "action_required" ||
      payload.remediationStatus === "escalated"
        ? payload.remediationStatus
        : "action_required",
    affectedOwnershipKeys: Array.isArray(payload.affectedOwnershipKeys) ? payload.affectedOwnershipKeys : [],
    latestAutomationReportPath: typeof payload.latestAutomationReportPath === "string" ? payload.latestAutomationReportPath : null,
    reportPath
  };
}

function writeTelemetryRemediationReport(payload: AtlasObservabilityTelemetryRemediationReportPayload) {
  const reportPath = resolveRemediationReportPath();

  mkdirSync(dirname(reportPath), {
    recursive: true
  });
  writeFileSync(reportPath, `${JSON.stringify({ ...payload, reportPath }, null, 2)}\n`, "utf8");

  return reportPath;
}

function buildTelemetryRemediationOwnership(
  remediation: AtlasObservabilityAutomationStatusRecord["telemetryRemediation"],
  recentActions: AtlasObservabilityTelemetryRemediationActionRecord[]
): AtlasObservabilityTelemetryRemediationOwnershipRecord {
  const latestAction = recentActions[0] ?? null;

  if (!latestAction) {
    return {
      status: "unassigned",
      actorUserEmail: null,
      reason: null,
      updatedAt: null,
      reportPath: null,
      detail:
        remediation.status === "ready"
          ? "Telemetry ownership is healthy and no remediation owner is currently assigned."
          : "No operator has acknowledged the current telemetry remediation posture yet."
    };
  }

  if (remediation.status === "ready" && latestAction.action === "RESOLVED") {
    return {
      status: "resolved",
      actorUserEmail: latestAction.actorUserEmail,
      reason: latestAction.reason,
      updatedAt: latestAction.generatedAt,
      reportPath: latestAction.reportPath,
      detail: `Telemetry remediation was resolved by ${latestAction.actorUserEmail}.`
    };
  }

  if (
    remediation.status !== "ready" &&
    latestAction.action === "ACKNOWLEDGED" &&
    latestAction.affectedOwnershipKeys.some((key) => remediation.affectedOwnershipKeys.includes(key))
  ) {
    return {
      status: "acknowledged",
      actorUserEmail: latestAction.actorUserEmail,
      reason: latestAction.reason,
      updatedAt: latestAction.generatedAt,
      reportPath: latestAction.reportPath,
      detail: `Telemetry remediation is currently acknowledged by ${latestAction.actorUserEmail}.`
    };
  }

  return {
    status: "unassigned",
    actorUserEmail: null,
    reason: null,
    updatedAt: null,
    reportPath: null,
    detail:
      remediation.status === "ready"
        ? "Telemetry ownership is healthy and awaiting explicit resolution closure."
        : "The current telemetry remediation posture is not acknowledged by an active operator owner."
  };
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

function buildObservabilityAutomationAlertState(input: {
  metrics: AtlasApiRuntimeTelemetryRecord;
  overview: Awaited<ReturnType<typeof getOperatorOverview>>;
  workerTelemetry: AtlasWorkerTelemetryRecord;
  telemetryOwnership: AtlasObservabilityTelemetryOwnershipRecord[];
  latestAutomationRun: AtlasObservabilityAutomationRunRecord | null;
  telemetryRecoveryEscalation: AtlasObservabilityTelemetryRecoveryEscalationRecord;
  activeIncidentTriggerCount: number;
  now?: string;
}) {
  const alerts = buildAtlasObservabilityAlerts({
    metrics: input.metrics,
    overview: input.overview,
    configurationStatus: input.metrics.configurationStatus,
    releaseStage: appRuntime.releaseStage,
    workerTelemetry: input.workerTelemetry,
    telemetryOwnership: input.telemetryOwnership,
    latestAutomationRun: input.latestAutomationRun,
    telemetryRecoveryEscalation: input.telemetryRecoveryEscalation,
    generatedAt: input.now
  });
  const incidentReadiness = buildAtlasIncidentReadinessRecord({
    releaseStage: appRuntime.releaseStage,
    configurationStatus: input.metrics.configurationStatus,
    hasRequestCorrelation: true,
    hasDistributedTracing:
      input.metrics.traceCoverageRate === 1 &&
      (!input.workerTelemetry.snapshot ||
        input.workerTelemetry.snapshot.processedCount === 0 ||
        input.workerTelemetry.snapshot.traceCoverageRate === 1),
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
    workerTelemetryStatus: input.workerTelemetry.status,
    activeAlertCount: alerts.length,
    activeIncidentTriggerCount: input.activeIncidentTriggerCount
  });

  return {
    alerts,
    incidentReadiness
  };
}

type AtlasPerformedObservabilityAutomation = {
  generatedAt: string;
  trigger: AtlasObservabilityAutomationTrigger;
  actor: AtlasActorContext;
  reason: string;
  minimumSeverity: AtlasObservabilityAlertSeverity;
  dispatchAlerts: boolean;
  triggerIncidents: boolean;
  alertCount: number;
  snapshot: Awaited<ReturnType<typeof persistObservabilitySnapshot>>;
  incidentTriggers: Awaited<ReturnType<typeof syncObservabilityIncidentTriggers>> | null;
  dispatch: Awaited<ReturnType<typeof dispatchObservabilityAlerts>> | null;
  workerTelemetry: AtlasWorkerTelemetryRecord;
};

type AtlasRecordedObservabilityAutomationFailure = {
  reportPath: string;
  snapshotId: string | null;
  dispatchId: string | null;
  activeIncidentCount: number;
  escalationErrorMessage: string | null;
};

type AtlasObservabilityAutomationPolicyExecutionResult = {
  reportPath: string;
  telemetryPolicy: AtlasObservabilityTelemetryOwnershipPolicy;
  telemetryRecoveryStatus: AtlasObservabilityTelemetryRecoveryStatus;
  recoveredKeys: AtlasObservabilityTelemetryOwnershipRecord["key"][];
  remainingKeys: AtlasObservabilityTelemetryOwnershipRecord["key"][];
  snapshotId: string | null;
  dispatchId: string | null;
  activeIncidentCount: number;
};

function createObservabilityAutomationReportPayload(input: {
  generatedAt: string;
  trigger: AtlasObservabilityAutomationTrigger;
  actorUserEmail: string | null;
  reason: string | null;
  minimumSeverity: AtlasObservabilityAlertSeverity;
  dispatchAlerts: boolean;
  triggerIncidents: boolean;
  telemetryPolicy: AtlasObservabilityTelemetryOwnershipPolicy;
  telemetryRecoveryStatus: AtlasObservabilityTelemetryRecoveryStatus;
  beforeOwnership?: AtlasObservabilityTelemetryOwnershipRecord[];
  afterOwnership?: AtlasObservabilityTelemetryOwnershipRecord[];
  recoveredKeys?: AtlasObservabilityTelemetryOwnershipRecord["key"][];
  remainingKeys?: AtlasObservabilityTelemetryOwnershipRecord["key"][];
  alertCount?: number | null;
  workerTelemetryStatus?: AtlasWorkerTelemetryRecord["status"] | null;
  snapshotId?: string | null;
  activeIncidentCount?: number | null;
  dispatchId?: string | null;
  automation?: AtlasPerformedObservabilityAutomation | null;
  errorMessage?: string | null;
}): AtlasObservabilityAutomationReportPayload {
  return {
    version: 1,
    status: input.errorMessage ? "FAILED" : "SUCCEEDED",
    trigger: input.trigger,
    generatedAt: input.generatedAt,
    appEnv: appRuntime.appEnv,
    releaseStage: appRuntime.releaseStage,
    actorUserEmail: input.actorUserEmail,
    reason: input.reason,
    minimumSeverity: input.minimumSeverity,
    dispatchAlerts: input.dispatchAlerts,
    triggerIncidents: input.triggerIncidents,
    telemetryPolicy: input.telemetryPolicy,
    telemetryRecovery: {
      status: input.telemetryRecoveryStatus,
      beforeOwnership: input.beforeOwnership,
      afterOwnership: input.afterOwnership,
      recoveredKeys: input.recoveredKeys ?? [],
      remainingKeys: input.remainingKeys ?? []
    },
    alertCount: input.alertCount ?? input.automation?.alertCount ?? null,
    workerTelemetry:
      input.workerTelemetryStatus === undefined
        ? (input.automation?.workerTelemetry ?? null)
        : input.workerTelemetryStatus === null
          ? null
        : {
            status: input.workerTelemetryStatus
          },
    snapshot:
      input.snapshotId === undefined
        ? (input.automation?.snapshot ?? null)
        : {
            id: input.snapshotId
          },
    incidentTriggers:
      input.activeIncidentCount === undefined
        ? (input.automation?.incidentTriggers ?? null)
        : {
            activeCount: input.activeIncidentCount
          },
    dispatch:
      input.dispatchId === undefined
        ? (input.automation?.dispatch ?? null)
        : {
            id: input.dispatchId
          },
    errorMessage: input.errorMessage ?? null
  };
}

function createEmptyOperatorOverview(): Awaited<ReturnType<typeof getOperatorOverview>> {
  return {
    openCaseCount: 0,
    criticalCaseCount: 0,
    actionRequiredCount: 0,
    unreadNotificationCount: 0,
    delayedCaseCount: 0,
    failedCaseCount: 0,
    recentCases: [],
    recentNotifications: [],
    recentAuditEvents: []
  };
}

function createFallbackApiRuntimeTelemetryRecord(generatedAt: string): AtlasApiRuntimeTelemetryRecord {
  return {
    service: "api",
    startedAt: generatedAt,
    uptimeSeconds: 0,
    totalRequests: 0,
    successCount: 0,
    errorCount: 0,
    tracedRequestCount: 0,
    traceCoverageRate: 1,
    averageDurationMs: 0,
    maxDurationMs: 0,
    inFlightRequests: 0,
    lastReadinessStatus: "unknown",
    lastReadinessAt: null,
    routeMetrics: [],
    recentTraces: [],
    configurationStatus: "valid",
    verificationCommand: "pnpm verify:release",
    revision: "unknown",
    deploymentSlot: appRuntime.appEnv,
    recordedAt: generatedAt
  };
}

async function executeObservabilityAutomationArtifacts(
  input: {
    actor: AtlasActorContext;
    reason: string;
    minimumSeverity: AtlasObservabilityAlertSeverity;
    dispatchAlerts: boolean;
    triggerIncidents: boolean;
    trace: ReturnType<typeof createOwnedExecutionTraceContext>;
    metrics: AtlasApiRuntimeTelemetryRecord;
    workerTelemetry: AtlasWorkerTelemetryRecord;
    alerts: AtlasObservabilityAlertRecord[];
    incidentReadiness: AtlasIncidentReadinessRecord;
  },
  client: DatabaseClient
) {
  const snapshot = await persistObservabilitySnapshot(
    {
      actor: input.actor,
      metrics: input.metrics,
      alerts: input.alerts,
      incidentReadiness: input.incidentReadiness,
      reason: input.reason
    },
    client
  );
  const incidentTriggers = input.triggerIncidents
    ? await syncObservabilityIncidentTriggers(
        {
          actor: input.actor,
          minimumSeverity: observabilityRuntime.incidentMinimumSeverity,
          reason: input.reason,
          alerts: input.alerts,
          metrics: input.metrics,
          incidentReadiness: input.incidentReadiness,
          workerTelemetry: input.workerTelemetry
        },
        client
      )
    : null;
  const dispatch = input.dispatchAlerts
    ? await dispatchObservabilityAlerts(
        {
          actor: input.actor,
          minimumSeverity: input.minimumSeverity,
          reason: input.reason,
          alerts: input.alerts,
          metrics: input.metrics,
          incidentReadiness: input.incidentReadiness,
          trace: input.trace
        },
        client
      )
    : null;

  await applyObservabilityRetentionPolicy(client);

  return {
    snapshot,
    incidentTriggers,
    dispatch
  };
}

async function executeObservabilityAutomationArtifactsBestEffort(
  input: {
    actor: AtlasActorContext;
    reason: string;
    minimumSeverity: AtlasObservabilityAlertSeverity;
    dispatchAlerts: boolean;
    triggerIncidents: boolean;
    trace: ReturnType<typeof createOwnedExecutionTraceContext>;
    metrics: AtlasApiRuntimeTelemetryRecord;
    workerTelemetry: AtlasWorkerTelemetryRecord;
    alerts: AtlasObservabilityAlertRecord[];
    incidentReadiness: AtlasIncidentReadinessRecord;
  },
  client: DatabaseClient
) {
  let snapshot: Awaited<ReturnType<typeof persistObservabilitySnapshot>> | null = null;
  let incidentTriggers: Awaited<ReturnType<typeof syncObservabilityIncidentTriggers>> | null = null;
  let dispatch: Awaited<ReturnType<typeof dispatchObservabilityAlerts>> | null = null;
  const errors: string[] = [];

  try {
    snapshot = await persistObservabilitySnapshot(
      {
        actor: input.actor,
        metrics: input.metrics,
        alerts: input.alerts,
        incidentReadiness: input.incidentReadiness,
        reason: input.reason
      },
      client
    );
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  if (input.triggerIncidents) {
    try {
      incidentTriggers = await syncObservabilityIncidentTriggers(
        {
          actor: input.actor,
          minimumSeverity: observabilityRuntime.incidentMinimumSeverity,
          reason: input.reason,
          alerts: input.alerts,
          metrics: input.metrics,
          incidentReadiness: input.incidentReadiness,
          workerTelemetry: input.workerTelemetry
        },
        client
      );
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (input.dispatchAlerts) {
    try {
      dispatch = await dispatchObservabilityAlerts(
        {
          actor: input.actor,
          minimumSeverity: input.minimumSeverity,
          reason: input.reason,
          alerts: input.alerts,
          metrics: input.metrics,
          incidentReadiness: input.incidentReadiness,
          trace: input.trace
        },
        client
      );
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  try {
    await applyObservabilityRetentionPolicy(client);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return {
    snapshot,
    incidentTriggers,
    dispatch,
    escalationErrorMessage: errors.length > 0 ? errors.join(" | ") : null
  };
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

export function listObservabilityTelemetryRemediationActions(
  actor: AtlasActorContext,
  options: {
    limit?: number;
  } = {}
) {
  assertObservabilityViewer(actor);

  return collectJsonArtifactFiles(resolve(import.meta.dirname, "../../..", observabilityRuntime.remediationReportDirectory))
    .map((filePath) => {
      const payload = readJsonFile<AtlasObservabilityTelemetryRemediationReportPayload>(filePath);

      if (!payload) {
        return null;
      }

      try {
        return mapTelemetryRemediationActionRecord(payload, filePath, statSync(filePath).mtime.toISOString());
      } catch {
        return null;
      }
    })
    .filter((item): item is AtlasObservabilityTelemetryRemediationActionRecord => item !== null)
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
  const recentTelemetryRemediationActions = listObservabilityTelemetryRemediationActions(actor, options);
  const latestRun = recentRuns[0] ?? null;
  const now = new Date(options.now ?? new Date().toISOString());
  const workerTelemetry = readPublishedWorkerTelemetry(options.now);
  const telemetryOwnership = [
    buildApiTelemetryOwnershipRecord(now),
    buildWorkerTelemetryOwnershipRecord(workerTelemetry),
    buildAutomationCadenceOwnershipRecord(now, latestRun)
  ];
  const telemetryRecoveryEscalation = buildTelemetryRecoveryEscalation(recentRuns);
  const telemetryRemediation = buildAtlasObservabilityTelemetryRemediation({
    telemetryOwnership,
    latestAutomationRun: latestRun,
    telemetryRecoveryEscalation,
    dispatchAlerts: observabilityRuntime.automationDispatchAlerts,
    triggerIncidents: observabilityRuntime.automationTriggerIncidents,
    minimumSeverity: observabilityRuntime.automationDefaultMinimumSeverity
  });

  return {
    scheduleMode: observabilityRuntime.automationScheduleMode,
    intervalMinutes: observabilityRuntime.automationScheduleIntervalMinutes,
    startupDelaySeconds: observabilityRuntime.automationScheduleStartupDelaySeconds,
    telemetryPolicy: observabilityRuntime.automationTelemetryOwnershipPolicy,
    telemetryRecoveryEscalation,
    telemetryRemediation,
    telemetryRemediationOwnership: buildTelemetryRemediationOwnership(
      telemetryRemediation,
      recentTelemetryRemediationActions
    ),
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
      remediationRetentionDays: observabilityRuntime.remediationRetentionDays,
      automationRetentionDays: observabilityRuntime.automationRetentionDays
    },
    lastRunAt: latestRun?.generatedAt ?? null,
    lastRunStatus: latestRun?.status ?? null,
    lastReportPath: latestRun?.reportPath ?? null,
    telemetryOwnership,
    recentTelemetryRemediationActions,
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
  telemetryPolicy?: AtlasObservabilityTelemetryOwnershipPolicy;
  telemetryRecoveryStatus?: AtlasObservabilityTelemetryRecoveryStatus;
  beforeOwnership?: AtlasObservabilityTelemetryOwnershipRecord[];
  afterOwnership?: AtlasObservabilityTelemetryOwnershipRecord[];
  recoveredKeys?: AtlasObservabilityTelemetryOwnershipRecord["key"][];
  remainingKeys?: AtlasObservabilityTelemetryOwnershipRecord["key"][];
  alertCount?: number | null;
  workerTelemetryStatus?: AtlasWorkerTelemetryRecord["status"] | null;
  snapshotId?: string | null;
  activeIncidentCount?: number | null;
  dispatchId?: string | null;
  generatedAt?: string;
  errorMessage: string;
}) {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const reportPath = writeObservabilityAutomationReport(
    createObservabilityAutomationReportPayload({
      generatedAt,
      trigger: input.trigger,
      actorUserEmail: input.actorUserEmail,
      reason: input.reason,
      minimumSeverity: input.minimumSeverity,
      dispatchAlerts: input.dispatchAlerts,
      triggerIncidents: input.triggerIncidents,
      telemetryPolicy: input.telemetryPolicy ?? observabilityRuntime.automationTelemetryOwnershipPolicy,
      telemetryRecoveryStatus: input.telemetryRecoveryStatus ?? "not_requested",
      beforeOwnership: input.beforeOwnership,
      afterOwnership: input.afterOwnership,
      recoveredKeys: input.recoveredKeys,
      remainingKeys: input.remainingKeys,
      alertCount: input.alertCount,
      workerTelemetryStatus: input.workerTelemetryStatus,
      snapshotId: input.snapshotId,
      activeIncidentCount: input.activeIncidentCount,
      dispatchId: input.dispatchId,
      errorMessage: input.errorMessage
    })
  );

  return mapAutomationRunRecord(
    createObservabilityAutomationReportPayload({
      generatedAt,
      trigger: input.trigger,
      actorUserEmail: input.actorUserEmail,
      reason: input.reason,
      minimumSeverity: input.minimumSeverity,
      dispatchAlerts: input.dispatchAlerts,
      triggerIncidents: input.triggerIncidents,
      telemetryPolicy: input.telemetryPolicy ?? observabilityRuntime.automationTelemetryOwnershipPolicy,
      telemetryRecoveryStatus: input.telemetryRecoveryStatus ?? "not_requested",
      beforeOwnership: input.beforeOwnership,
      afterOwnership: input.afterOwnership,
      recoveredKeys: input.recoveredKeys,
      remainingKeys: input.remainingKeys,
      alertCount: input.alertCount,
      workerTelemetryStatus: input.workerTelemetryStatus,
      snapshotId: input.snapshotId,
      activeIncidentCount: input.activeIncidentCount,
      dispatchId: input.dispatchId,
      errorMessage: input.errorMessage
    }),
    reportPath,
    generatedAt
  );
}

export async function recordObservabilityAutomationFailure(
  input: {
    actorUserEmail: string;
    reason: string;
    minimumSeverity?: AtlasObservabilityAlertSeverity;
    dispatchAlerts?: boolean;
    triggerIncidents?: boolean;
    trigger?: AtlasObservabilityAutomationTrigger;
    telemetryPolicy?: AtlasObservabilityTelemetryOwnershipPolicy;
    telemetryRecoveryStatus?: AtlasObservabilityTelemetryRecoveryStatus;
    generatedAt?: string;
    trace?: ReturnType<typeof createOwnedExecutionTraceContext>;
    errorMessage: string;
  },
  client: DatabaseClient = prisma
): Promise<AtlasRecordedObservabilityAutomationFailure> {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const minimumSeverity =
    input.minimumSeverity === "critical" || input.minimumSeverity === "warning" || input.minimumSeverity === "info"
      ? input.minimumSeverity
      : observabilityRuntime.automationDefaultMinimumSeverity;
  const dispatchAlerts = Boolean(input.dispatchAlerts);
  const triggerIncidents = input.triggerIncidents ?? observabilityRuntime.automationTriggerIncidents;
  const telemetryPolicy = normalizeTelemetryOwnershipPolicy(
    input.telemetryPolicy ?? observabilityRuntime.automationTelemetryOwnershipPolicy
  );
  const telemetryRecoveryStatus = normalizeTelemetryRecoveryStatus(
    input.telemetryRecoveryStatus ?? (telemetryPolicy === "recover" ? "failed" : "not_requested")
  );

  const actor = await resolveAutomationActor(input.actorUserEmail, client);
  const currentStatus = getObservabilityAutomationStatus(actor, {
    limit: 12,
    now: generatedAt
  });
  const beforeOwnership = currentStatus.telemetryOwnership;
  const metrics = readPublishedApiRuntimeTelemetry() ?? createFallbackApiRuntimeTelemetryRecord(generatedAt);
  const workerTelemetry = readPublishedWorkerTelemetry(generatedAt);
  let overview = createEmptyOperatorOverview();
  let activeIncidentTriggerCount = 0;

  try {
    overview = await getOperatorOverview(actor, client);
  } catch {}

  try {
    activeIncidentTriggerCount = (
      await listObservabilityIncidentTriggers(
        actor,
        {
          limit: 50,
          status: "ACTIVE"
        },
        client
      )
    ).length;
  } catch {}

  const failedRunRecord = {
    id: "pending-telemetry-failure",
    status: "FAILED" as const,
    trigger: input.trigger ?? "scheduled",
    generatedAt,
    actorUserEmail: actor.user.email,
    reason: normalizeReason(input.reason),
    minimumSeverity,
    dispatchAlerts,
    triggerIncidents,
    telemetryPolicy,
    telemetryRecoveryStatus,
    recoveredOwnershipCount: 0,
    remainingOwnershipCount: 0,
    alertCount: null,
    activeIncidentCount: null,
    snapshotId: null,
    dispatchId: null,
    workerTelemetryStatus: workerTelemetry.status,
    reportPath: "pending-telemetry-failure",
    errorMessage: input.errorMessage
  } satisfies AtlasObservabilityAutomationRunRecord;
  const afterOwnership = [
    buildApiTelemetryOwnershipRecord(new Date(generatedAt)),
    buildWorkerTelemetryOwnershipRecord(workerTelemetry),
    buildAutomationCadenceOwnershipRecord(new Date(generatedAt), failedRunRecord)
  ];
  const remainingKeys = listDegradedTelemetryOwnershipKeys(afterOwnership);
  const telemetryRecoveryEscalation = buildTelemetryRecoveryEscalation([
    {
      ...failedRunRecord,
      remainingOwnershipCount: remainingKeys.length
    },
    ...currentStatus.recentRuns
  ]);
  const { alerts, incidentReadiness } = buildObservabilityAutomationAlertState({
    metrics,
    overview,
    workerTelemetry,
    telemetryOwnership: afterOwnership,
    latestAutomationRun: {
      ...failedRunRecord,
      remainingOwnershipCount: remainingKeys.length
    },
    telemetryRecoveryEscalation,
    activeIncidentTriggerCount,
    now: generatedAt
  });
  const artifacts = await executeObservabilityAutomationArtifactsBestEffort(
    {
      actor,
      reason: normalizeReason(input.reason),
      minimumSeverity,
      dispatchAlerts,
      triggerIncidents,
      trace: input.trace ?? createOwnedExecutionTraceContext("worker"),
      metrics,
      workerTelemetry,
      alerts,
      incidentReadiness
    },
    client
  );
  const report = writeObservabilityAutomationFailureReport({
    trigger: input.trigger ?? "scheduled",
    actorUserEmail: actor.user.email,
    reason: failedRunRecord.reason,
    minimumSeverity,
    dispatchAlerts,
    triggerIncidents,
    telemetryPolicy,
    telemetryRecoveryStatus,
    beforeOwnership,
    afterOwnership,
    recoveredKeys: [],
    remainingKeys,
    alertCount: alerts.length,
    workerTelemetryStatus: workerTelemetry.status,
    snapshotId: artifacts.snapshot?.id ?? null,
    activeIncidentCount: artifacts.incidentTriggers?.activeCount ?? activeIncidentTriggerCount,
    dispatchId: artifacts.dispatch?.id ?? null,
    generatedAt,
    errorMessage: input.errorMessage
  });

  return {
    reportPath: report.reportPath,
    snapshotId: artifacts.snapshot?.id ?? null,
    dispatchId: artifacts.dispatch?.id ?? null,
    activeIncidentCount: artifacts.incidentTriggers?.activeCount ?? activeIncidentTriggerCount,
    escalationErrorMessage: artifacts.escalationErrorMessage
  };
}

export async function recordObservabilityTelemetryRemediationAction(
  actor: AtlasActorContext,
  input: {
    action: AtlasObservabilityTelemetryRemediationAction;
    reason: string;
    now?: string;
  }
) {
  assertObservabilityViewer(actor);
  const reason = normalizeReason(input.reason);
  const status = getObservabilityAutomationStatus(actor, {
    limit: 12,
    now: input.now
  });

  if (input.action === "ACKNOWLEDGED") {
    if (status.telemetryRemediation.recommendedAction === "none") {
      throw new AtlasObservabilityOperationsError(
        "Telemetry ownership is currently healthy, so there is no remediation posture to acknowledge.",
        "bad_request"
      );
    }

    if (status.telemetryRemediationOwnership.status === "acknowledged") {
      throw new AtlasObservabilityOperationsError(
        "The current telemetry remediation posture is already acknowledged.",
        "bad_request"
      );
    }
  }

  if (input.action === "RESOLVED") {
    if (status.telemetryRemediation.recommendedAction !== "none") {
      throw new AtlasObservabilityOperationsError(
        "Telemetry remediation cannot be resolved while ownership signals are still degraded.",
        "bad_request"
      );
    }

    if (status.telemetryRemediationOwnership.status === "resolved") {
      throw new AtlasObservabilityOperationsError(
        "The current telemetry remediation posture is already resolved.",
        "bad_request"
      );
    }
  }

  const generatedAt = input.now ?? new Date().toISOString();
  const affectedOwnershipKeys =
    input.action === "RESOLVED"
      ? (status.recentTelemetryRemediationActions[0]?.affectedOwnershipKeys ?? [])
      : status.telemetryRemediation.affectedOwnershipKeys;
  const reportPath = writeTelemetryRemediationReport({
    version: 1,
    action: input.action,
    generatedAt,
    actorUserEmail: actor.user.email,
    reason,
    remediationStatus: status.telemetryRemediation.status,
    affectedOwnershipKeys,
    latestAutomationReportPath: status.lastReportPath
  });
  await applyObservabilityRetentionPolicy();

  return mapTelemetryRemediationActionRecord(
    {
      version: 1,
      action: input.action,
      generatedAt,
      actorUserEmail: actor.user.email,
      reason,
      remediationStatus: status.telemetryRemediation.status,
      affectedOwnershipKeys,
      latestAutomationReportPath: status.lastReportPath
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
  const automationStatus = getObservabilityAutomationStatus(actor, {
    limit: 12,
    now: input.now
  });
  const telemetryOwnership = automationStatus.telemetryOwnership;
  const { alerts, incidentReadiness } = buildObservabilityAutomationAlertState({
    metrics,
    overview,
    workerTelemetry,
    telemetryOwnership,
    latestAutomationRun: automationStatus.recentRuns?.[0] ?? null,
    telemetryRecoveryEscalation: automationStatus.telemetryRecoveryEscalation,
    activeIncidentTriggerCount: activeIncidentTriggers.length,
    now: input.now
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

async function performObservabilityAutomation(
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
  client: DatabaseClient
): Promise<AtlasPerformedObservabilityAutomation> {
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
  const generatedAt = input.now ?? new Date().toISOString();
  const dispatchAlerts = Boolean(input.dispatchAlerts);
  const triggerIncidents = input.triggerIncidents ?? observabilityRuntime.automationTriggerIncidents;
  const artifacts = await executeObservabilityAutomationArtifacts(
    {
      actor: posture.actor,
      reason,
      minimumSeverity,
      dispatchAlerts,
      triggerIncidents,
      trace,
      metrics: posture.metrics,
      workerTelemetry: posture.workerTelemetry,
      alerts: posture.alerts,
      incidentReadiness: posture.incidentReadiness
    },
    client
  );

  return {
    generatedAt,
    trigger: input.trigger ?? "manual",
    actor: posture.actor,
    reason,
    minimumSeverity,
    dispatchAlerts,
    triggerIncidents,
    alertCount: posture.alerts.length,
    snapshot: artifacts.snapshot,
    incidentTriggers: artifacts.incidentTriggers,
    dispatch: artifacts.dispatch,
    workerTelemetry: posture.workerTelemetry
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
  const automation = await performObservabilityAutomation(input, client);
  const report = createObservabilityAutomationReportPayload({
    generatedAt: automation.generatedAt,
    trigger: automation.trigger,
    actorUserEmail: automation.actor.user.email,
    reason: automation.reason,
    minimumSeverity: automation.minimumSeverity,
    dispatchAlerts: automation.dispatchAlerts,
    triggerIncidents: automation.triggerIncidents,
    telemetryPolicy: "monitor",
    telemetryRecoveryStatus: "not_requested",
    automation
  });
  const reportPath = writeObservabilityAutomationReport(report);

  return {
    report,
    reportPath,
    snapshot: automation.snapshot,
    incidentTriggers: automation.incidentTriggers,
    dispatch: automation.dispatch,
    workerTelemetry: automation.workerTelemetry
  };
}

export async function recoverObservabilityTelemetryOwnership(
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
  const actor = await resolveAutomationActor(input.actorUserEmail, client);
  const reason = normalizeReason(input.reason);
  const minimumSeverity =
    input.minimumSeverity === "critical" || input.minimumSeverity === "warning" || input.minimumSeverity === "info"
      ? input.minimumSeverity
      : observabilityRuntime.automationDefaultMinimumSeverity;
  const generatedAt = input.now ?? new Date().toISOString();
  const currentStatus = getObservabilityAutomationStatus(actor, {
    limit: 12,
    now: input.now
  });
  const beforeOwnership = currentStatus.telemetryOwnership;
  const degradedBeforeKeys = listDegradedTelemetryOwnershipKeys(beforeOwnership);

  if (degradedBeforeKeys.length === 0) {
    const reportPath = writeObservabilityAutomationReport(
      createObservabilityAutomationReportPayload({
        generatedAt,
        trigger: input.trigger ?? "manual",
        actorUserEmail: actor.user.email,
        reason,
        minimumSeverity,
        dispatchAlerts: Boolean(input.dispatchAlerts),
        triggerIncidents: input.triggerIncidents ?? observabilityRuntime.automationTriggerIncidents,
        telemetryPolicy: "recover",
        telemetryRecoveryStatus: "no_action",
        beforeOwnership,
        afterOwnership: beforeOwnership
      })
    );

    return {
      status: "no_action" as AtlasObservabilityTelemetryRecoveryStatus,
      reportPath,
      beforeOwnership,
      afterOwnership: beforeOwnership,
      recoveredKeys: [] as AtlasObservabilityTelemetryOwnershipRecord["key"][],
      remainingKeys: [] as AtlasObservabilityTelemetryOwnershipRecord["key"][],
      automation: null
    };
  }

  const posture = await buildObservabilityAutomationPosture(
    {
      actorUserEmail: input.actorUserEmail,
      now: generatedAt
    },
    client
  );
  const trace = input.trace ?? createOwnedExecutionTraceContext("worker");
  const dispatchAlerts = Boolean(input.dispatchAlerts);
  const triggerIncidents = input.triggerIncidents ?? observabilityRuntime.automationTriggerIncidents;
  const afterRunRecordBase = {
    id: "pending-telemetry-recovery",
    status: "SUCCEEDED" as const,
    trigger: input.trigger ?? "manual",
    generatedAt,
    actorUserEmail: posture.actor.user.email,
    reason,
    minimumSeverity,
    dispatchAlerts,
    triggerIncidents,
    telemetryPolicy: "recover" as const,
    telemetryRecoveryStatus: "unchanged" as const,
    recoveredOwnershipCount: 0,
    remainingOwnershipCount: 0,
    alertCount: null,
    activeIncidentCount: null,
    snapshotId: null,
    dispatchId: null,
    workerTelemetryStatus: posture.workerTelemetry.status,
    reportPath: "pending-telemetry-recovery",
    errorMessage: null
  };
  const afterOwnership = [
    buildApiTelemetryOwnershipRecord(new Date(generatedAt)),
    buildWorkerTelemetryOwnershipRecord(readPublishedWorkerTelemetry(generatedAt)),
    buildAutomationCadenceOwnershipRecord(new Date(generatedAt), afterRunRecordBase)
  ];
  const degradedAfterKeys = new Set(listDegradedTelemetryOwnershipKeys(afterOwnership));
  const recoveredKeys = degradedBeforeKeys.filter((key) => !degradedAfterKeys.has(key));
  const remainingKeys = [...degradedAfterKeys];
  const status =
    remainingKeys.length === 0
      ? ("recovered" as AtlasObservabilityTelemetryRecoveryStatus)
      : recoveredKeys.length > 0
        ? ("partial" as AtlasObservabilityTelemetryRecoveryStatus)
        : ("unchanged" as AtlasObservabilityTelemetryRecoveryStatus);
  const afterRunRecord = {
    ...afterRunRecordBase,
    telemetryRecoveryStatus: status,
    recoveredOwnershipCount: recoveredKeys.length,
    remainingOwnershipCount: remainingKeys.length
  } satisfies AtlasObservabilityAutomationRunRecord;
  const telemetryRecoveryEscalation = buildTelemetryRecoveryEscalation([afterRunRecord, ...currentStatus.recentRuns]);
  const afterState = buildObservabilityAutomationAlertState({
    metrics: posture.metrics,
    overview: posture.overview,
    workerTelemetry: posture.workerTelemetry,
    telemetryOwnership: afterOwnership,
    latestAutomationRun: afterRunRecord,
    telemetryRecoveryEscalation,
    activeIncidentTriggerCount: posture.activeIncidentTriggers.length,
    now: generatedAt
  });
  const artifacts = await executeObservabilityAutomationArtifacts(
    {
      actor: posture.actor,
      reason,
      minimumSeverity,
      dispatchAlerts,
      triggerIncidents,
      trace,
      metrics: posture.metrics,
      workerTelemetry: posture.workerTelemetry,
      alerts: afterState.alerts,
      incidentReadiness: afterState.incidentReadiness
    },
    client
  );
  const automation = {
    generatedAt,
    trigger: input.trigger ?? "manual",
    actor: posture.actor,
    reason,
    minimumSeverity,
    dispatchAlerts,
    triggerIncidents,
    alertCount: afterState.alerts.length,
    snapshot: artifacts.snapshot,
    incidentTriggers: artifacts.incidentTriggers,
    dispatch: artifacts.dispatch,
    workerTelemetry: posture.workerTelemetry
  } satisfies AtlasPerformedObservabilityAutomation;
  const reportPath = writeObservabilityAutomationReport(
    createObservabilityAutomationReportPayload({
      generatedAt: automation.generatedAt,
      trigger: automation.trigger,
      actorUserEmail: automation.actor.user.email,
      reason: automation.reason,
      minimumSeverity: automation.minimumSeverity,
      dispatchAlerts: automation.dispatchAlerts,
      triggerIncidents: automation.triggerIncidents,
      telemetryPolicy: "recover",
      telemetryRecoveryStatus: status,
      beforeOwnership,
      afterOwnership,
      recoveredKeys,
      remainingKeys,
      automation
    })
  );

  return {
    status,
    reportPath,
    beforeOwnership,
    afterOwnership,
    recoveredKeys,
    remainingKeys,
    automation: {
      reportPath,
      snapshot: automation.snapshot,
      incidentTriggers: automation.incidentTriggers,
      dispatch: automation.dispatch,
      workerTelemetry: automation.workerTelemetry
    }
  };
}

export async function executeObservabilityAutomationPolicy(
  input: {
    actorUserEmail: string;
    reason: string;
    minimumSeverity?: AtlasObservabilityAlertSeverity;
    dispatchAlerts?: boolean;
    triggerIncidents?: boolean;
    trigger?: AtlasObservabilityAutomationTrigger;
    telemetryPolicy?: AtlasObservabilityTelemetryOwnershipPolicy;
    now?: string;
    trace?: ReturnType<typeof createOwnedExecutionTraceContext>;
  },
  client: DatabaseClient = prisma
): Promise<AtlasObservabilityAutomationPolicyExecutionResult> {
  const telemetryPolicy = normalizeTelemetryOwnershipPolicy(
    input.telemetryPolicy ?? observabilityRuntime.automationTelemetryOwnershipPolicy
  );

  if (telemetryPolicy === "recover") {
    const recovery = await recoverObservabilityTelemetryOwnership(
      {
        actorUserEmail: input.actorUserEmail,
        reason: input.reason,
        minimumSeverity: input.minimumSeverity,
        dispatchAlerts: input.dispatchAlerts,
        triggerIncidents: input.triggerIncidents,
        trigger: input.trigger,
        now: input.now,
        trace: input.trace
      },
      client
    );

    return {
      reportPath: recovery.reportPath,
      telemetryPolicy,
      telemetryRecoveryStatus: recovery.status,
      recoveredKeys: recovery.recoveredKeys,
      remainingKeys: recovery.remainingKeys,
      snapshotId: recovery.automation?.snapshot.id ?? null,
      dispatchId: recovery.automation?.dispatch?.id ?? null,
      activeIncidentCount: recovery.automation?.incidentTriggers?.activeCount ?? 0
    };
  }

  const automation = await performObservabilityAutomation(input, client);
  const report = createObservabilityAutomationReportPayload({
    generatedAt: automation.generatedAt,
    trigger: input.trigger ?? "manual",
    actorUserEmail: automation.actor.user.email,
    reason: automation.reason,
    minimumSeverity: automation.minimumSeverity,
    dispatchAlerts: automation.dispatchAlerts,
    triggerIncidents: automation.triggerIncidents,
    telemetryPolicy,
    telemetryRecoveryStatus: "not_requested",
    beforeOwnership: [],
    afterOwnership: [],
    automation
  });
  const reportPath = writeObservabilityAutomationReport(report);

  return {
    reportPath,
    telemetryPolicy,
    telemetryRecoveryStatus: "not_requested",
    recoveredKeys: [],
    remainingKeys: [],
    snapshotId: automation.snapshot.id,
    dispatchId: automation.dispatch?.id ?? null,
    activeIncidentCount: automation.incidentTriggers?.activeCount ?? 0
  };
}
