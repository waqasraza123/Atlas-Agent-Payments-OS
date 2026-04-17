import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AtlasActorContext } from "@atlas/auth";
import { appRuntime, observabilityRuntime } from "@atlas/config";
import {
  buildAtlasIncidentReadinessRecord,
  buildAtlasObservabilityAlerts,
  buildAtlasObservabilityTelemetryRemediation,
  buildAtlasWorkerTelemetryRecord,
  getAtlasObservabilityDeliveryKind,
  isAtlasPagingProvider,
  type AtlasApiRuntimeTelemetryRecord,
  type AtlasIncidentReadinessRecord,
  type AtlasObservabilityAlertRecord,
  type AtlasObservabilityAlertSeverity,
  type AtlasObservabilityAutomationRunRecord,
  type AtlasObservabilityAutomationStatusRecord,
  type AtlasObservabilityTelemetryRemediationAction,
  type AtlasObservabilityTelemetryRemediationAccountabilityRecord,
  type AtlasObservabilityTelemetryRemediationActionRecord,
  type AtlasObservabilityTelemetryRemediationFollowUpRecord,
  type AtlasObservabilityTelemetryRemediationFollowThroughRecord,
  type AtlasObservabilityTelemetryRemediationRecord,
  type AtlasObservabilityTelemetryRemediationOwnershipRecord,
  type AtlasObservabilityTelemetryRecoveryEscalationRecord,
  type AtlasObservabilityTelemetryOwnershipPolicy,
  type AtlasObservabilityTelemetryRecoveryStatus,
  type AtlasObservabilityTelemetryOwnershipRecord,
  type AtlasWorkerRuntimeMetricsSnapshot,
  type AtlasWorkerTelemetryRecord
} from "@atlas/domain";
import { Prisma, type PrismaClient } from "./generated/client/index.js";
import { prisma } from "./client";
import {
  appendTelemetryOwnershipSample,
  createTelemetryOwnershipSample,
  deriveTelemetryOwnershipState,
  listTelemetryOwnershipSamples
} from "./observability-ownership";
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

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

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
    activeBreachStartedAt?: string | null;
    activeBreachMinutes?: number | null;
    endedBreach?: boolean;
    ownershipSampleCount?: number | null;
  } | null;
  reportPath?: string;
  errorMessage?: string | null;
};

type AtlasObservabilityTelemetryRemediationReportPayload = {
  version: 1;
  action: AtlasObservabilityTelemetryRemediationAction;
  generatedAt: string;
  actorUserEmail: string;
  ownerUserEmail?: string | null;
  ownerAccountability?: AtlasObservabilityTelemetryRemediationAccountabilityRecord | null;
  reason: string;
  remediationStatus: "ready" | "action_required" | "escalated";
  affectedOwnershipKeys: AtlasObservabilityTelemetryOwnershipRecord["key"][];
  latestAutomationReportPath: string | null;
  resolvedIncidentTriggerCount?: number;
  activeIncidentTriggerCount?: number;
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
  const staleAfterMinutes = Math.max(1, observabilityRuntime.apiOwnershipStaleAfterMinutes);

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
  recentRuns: AtlasObservabilityAutomationRunRecord[],
  activeBreach: {
    startedAt: string | null;
    minutes: number | null;
  } | null = null
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
    ...(activeBreach
      ? {
          activeBreachStartedAt: activeBreach.startedAt,
          activeBreachMinutes: activeBreach.minutes
        }
      : {}),
    detail:
      consecutiveBreachedRuns >= threshold
        ? `Telemetry auto-recovery has breached its target for ${consecutiveBreachedRuns} consecutive run${consecutiveBreachedRuns === 1 ? "" : "s"}.`
        : consecutiveBreachedRuns === 0
          ? "Recent telemetry auto-recovery runs are not currently breaching the escalation threshold."
          : `Telemetry auto-recovery has breached its target for ${consecutiveBreachedRuns} consecutive run${consecutiveBreachedRuns === 1 ? "" : "s"}, below the escalation threshold of ${threshold}.`
  } satisfies AtlasObservabilityTelemetryRecoveryEscalationRecord & {
    activeBreachStartedAt?: string | null;
    activeBreachMinutes?: number | null;
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
    activeBreachStartedAt:
      typeof telemetryRecovery?.activeBreachStartedAt === "string" ? telemetryRecovery.activeBreachStartedAt : null,
    activeBreachMinutes:
      typeof telemetryRecovery?.activeBreachMinutes === "number" ? telemetryRecovery.activeBreachMinutes : null,
    endedBreach: telemetryRecovery?.endedBreach === true,
    ownershipSampleCount:
      typeof telemetryRecovery?.ownershipSampleCount === "number" ? telemetryRecovery.ownershipSampleCount : 0,
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

function summarizeActiveTelemetryBreach(
  windows: AtlasObservabilityAutomationStatusRecord["ownershipWindows"]
) {
  const activeWindows = windows.filter((window) => window.currentStatus !== "healthy" && window.breachStartedAt);

  if (activeWindows.length === 0) {
    return null;
  }

  const earliestWindow = activeWindows.sort(
    (left, right) => new Date(left.breachStartedAt ?? left.latestSampleAt ?? 0).getTime() - new Date(right.breachStartedAt ?? right.latestSampleAt ?? 0).getTime()
  )[0]!;

  return {
    startedAt: earliestWindow.breachStartedAt,
    minutes: earliestWindow.currentBreachMinutes
  };
}

function getTelemetryOwnershipState(now?: string) {
  return deriveTelemetryOwnershipState(listTelemetryOwnershipSamples(), {
    now
  });
}

function appendAutomationCadenceOwnershipSample(input: {
  generatedAt: string;
  status: AtlasObservabilityTelemetryOwnershipRecord["status"];
  detail: string;
}) {
  appendTelemetryOwnershipSample(
    createTelemetryOwnershipSample({
      key: "automation-cadence",
      status: input.status,
      recordedAt: input.generatedAt,
      source: "automation-run",
      detail: input.detail
    })
  );
}

function createFallbackOwnershipWindow(record: AtlasObservabilityTelemetryOwnershipRecord) {
  return {
    key: record.key,
    label: record.label,
    currentStatus: record.status,
    breachStartedAt: record.status === "healthy" ? null : record.lastRecordedAt,
    lastHealthyAt: record.status === "healthy" ? record.lastRecordedAt : null,
    lastRecoveredAt: null,
    currentBreachMinutes: null,
    latestSampleAt: record.lastRecordedAt,
    sampleCountInWindow: 0,
    detail: record.detail
  } satisfies AtlasObservabilityAutomationStatusRecord["ownershipWindows"][number];
}

function getRuntimeAwareTelemetryOwnershipState(input: {
  now?: string;
  latestRun?: AtlasObservabilityAutomationRunRecord | null;
}) {
  const now = new Date(input.now ?? new Date().toISOString());
  const workerTelemetry = readPublishedWorkerTelemetry(input.now);
  const derived = getTelemetryOwnershipState(input.now);
  const fallbackOwnership = [
    buildApiTelemetryOwnershipRecord(now),
    buildWorkerTelemetryOwnershipRecord(workerTelemetry),
    buildAutomationCadenceOwnershipRecord(now, input.latestRun ?? null)
  ];

  return {
    telemetryOwnership: derived.telemetryOwnership.map((item) => {
      const window = derived.ownershipWindows.find((entry) => entry.key === item.key);
      return window && window.sampleCountInWindow > 0
        ? item
        : (fallbackOwnership.find((entry) => entry.key === item.key) ?? item);
    }),
    ownershipWindows: derived.ownershipWindows.map((window) => {
      if (window.sampleCountInWindow > 0) {
        return window;
      }

      const fallback = fallbackOwnership.find((entry) => entry.key === window.key);
      return fallback ? createFallbackOwnershipWindow(fallback) : window;
    }),
    ownershipTrends: derived.ownershipTrends,
    latestOwnershipSamples: derived.latestOwnershipSamples
  };
}

function mapTelemetryRemediationActionRecord(
  payload: AtlasObservabilityTelemetryRemediationReportPayload,
  reportPath: string,
  generatedAtFallback: string
): AtlasObservabilityTelemetryRemediationActionRecord {
  return {
    id: reportPath,
    action:
      payload.action === "RESOLVED"
        ? "RESOLVED"
        : payload.action === "TRANSFERRED"
          ? "TRANSFERRED"
          : payload.action === "ASSIGNED"
            ? "ASSIGNED"
            : payload.action === "REACKNOWLEDGED"
              ? "REACKNOWLEDGED"
              : payload.action === "ESCALATED"
                ? "ESCALATED"
                : "ACKNOWLEDGED",
    generatedAt: payload.generatedAt ?? generatedAtFallback,
    actorUserEmail: payload.actorUserEmail,
    ownerUserEmail: payload.ownerUserEmail ?? null,
    ownerAccountability: payload.ownerAccountability ?? null,
    reason: payload.reason,
    remediationStatus:
      payload.remediationStatus === "ready" ||
      payload.remediationStatus === "action_required" ||
      payload.remediationStatus === "escalated"
        ? payload.remediationStatus
        : "action_required",
    affectedOwnershipKeys: Array.isArray(payload.affectedOwnershipKeys) ? payload.affectedOwnershipKeys : [],
    latestAutomationReportPath: typeof payload.latestAutomationReportPath === "string" ? payload.latestAutomationReportPath : null,
    resolvedIncidentTriggerCount:
      typeof payload.resolvedIncidentTriggerCount === "number" ? payload.resolvedIncidentTriggerCount : 0,
    activeIncidentTriggerCount: typeof payload.activeIncidentTriggerCount === "number" ? payload.activeIncidentTriggerCount : 0,
    reportPath
  };
}

function findLatestTelemetryRemediationAction(
  actions: AtlasObservabilityTelemetryRemediationActionRecord[],
  allowedActions: AtlasObservabilityTelemetryRemediationAction[]
) {
  return actions.find((action) => allowedActions.includes(action.action)) ?? null;
}

function findLatestAssignedTelemetryRemediationAction(
  ownerUserEmail: string,
  actions: AtlasObservabilityTelemetryRemediationActionRecord[]
) {
  return (
    actions.find(
      (action) =>
        (action.action === "ASSIGNED" || action.action === "TRANSFERRED") && action.ownerUserEmail === ownerUserEmail
    ) ?? null
  );
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
  const latestOwnershipAction = findLatestTelemetryRemediationAction(recentActions, [
    "ACKNOWLEDGED",
    "ASSIGNED",
    "TRANSFERRED",
    "REACKNOWLEDGED"
  ]);
  const latestResolution = findLatestTelemetryRemediationAction(recentActions, ["RESOLVED"]);

  if (!latestOwnershipAction && !latestResolution) {
    return {
      status: "unassigned",
      actorUserEmail: null,
      assignedByUserEmail: null,
      handoffAction: null,
      reason: null,
      updatedAt: null,
      reportPath: null,
      detail:
        remediation.status === "ready"
          ? "Telemetry ownership is healthy and no remediation owner is currently assigned."
          : "No operator has acknowledged the current telemetry remediation posture yet."
    };
  }

  if (remediation.status === "ready" && latestResolution) {
    return {
      status: "resolved",
      actorUserEmail: latestResolution.actorUserEmail,
      assignedByUserEmail: null,
      handoffAction: latestResolution.action,
      reason: latestResolution.reason,
      updatedAt: latestResolution.generatedAt,
      reportPath: latestResolution.reportPath,
      detail: `Telemetry remediation was resolved by ${latestResolution.actorUserEmail}.`
    };
  }

  if (remediation.status === "ready" && latestOwnershipAction) {
    const currentOwnerEmail = latestOwnershipAction.ownerUserEmail ?? latestOwnershipAction.actorUserEmail;
    const assignedByUserEmail =
      latestOwnershipAction.action === "ASSIGNED" || latestOwnershipAction.action === "TRANSFERRED"
        ? latestOwnershipAction.actorUserEmail
        : null;

    return {
      status: "acknowledged",
      actorUserEmail: currentOwnerEmail,
      assignedByUserEmail,
      handoffAction: latestOwnershipAction.action,
      reason: latestOwnershipAction.reason,
      updatedAt: latestOwnershipAction.generatedAt,
      reportPath: latestOwnershipAction.reportPath,
      detail: `Telemetry ownership is healthy, but remediation is still owned by ${currentOwnerEmail} until an operator records explicit closure.`
    };
  }

  if (remediation.status !== "ready" && latestOwnershipAction) {
    const currentOwnerEmail = latestOwnershipAction.ownerUserEmail ?? latestOwnershipAction.actorUserEmail;
    const assignedByUserEmail =
      latestOwnershipAction.action === "ASSIGNED" || latestOwnershipAction.action === "TRANSFERRED"
        ? latestOwnershipAction.actorUserEmail
        : null;
    const detail =
      latestOwnershipAction.action === "TRANSFERRED"
        ? `Telemetry remediation ownership is currently assigned to ${currentOwnerEmail} after transfer by ${latestOwnershipAction.actorUserEmail}.`
        : latestOwnershipAction.action === "ASSIGNED"
          ? `Telemetry remediation is currently assigned to ${currentOwnerEmail} by ${latestOwnershipAction.actorUserEmail}.`
          : latestOwnershipAction.action === "REACKNOWLEDGED"
            ? `Telemetry remediation is currently re-acknowledged by ${currentOwnerEmail}.`
            : `Telemetry remediation is currently acknowledged by ${currentOwnerEmail}.`;

    return {
      status: "acknowledged",
      actorUserEmail: currentOwnerEmail,
      assignedByUserEmail,
      handoffAction: latestOwnershipAction.action,
      reason: latestOwnershipAction.reason,
      updatedAt: latestOwnershipAction.generatedAt,
      reportPath: latestOwnershipAction.reportPath,
      detail
    };
  }

  return {
    status: "unassigned",
    actorUserEmail: null,
    assignedByUserEmail: null,
    handoffAction: null,
    reason: null,
    updatedAt: null,
    reportPath: null,
    detail:
      remediation.status === "ready"
        ? "Telemetry ownership is healthy and awaiting explicit resolution closure."
        : "The current telemetry remediation posture is not acknowledged by an active operator owner."
  };
}

function buildTelemetryRemediationFollowUp(
  telemetryOwnership: AtlasObservabilityTelemetryOwnershipRecord[],
  ownership: AtlasObservabilityTelemetryRemediationOwnershipRecord,
  now: Date
): AtlasObservabilityTelemetryRemediationFollowUpRecord {
  const thresholdMinutes = Math.max(1, observabilityRuntime.automationRemediationFollowUpMinutes);

  if (telemetryOwnership.every((item) => item.status === "healthy")) {
    return {
      status: "ready",
      thresholdMinutes,
      ageMinutes: null,
      detail: "Telemetry remediation is currently healthy and no follow-up timer is active."
    };
  }

  if (ownership.status !== "acknowledged" || !ownership.updatedAt) {
    return {
      status: "ready",
      thresholdMinutes,
      ageMinutes: null,
      detail: "Telemetry remediation has not been acknowledged yet, so Atlas is waiting for an active owner before follow-up timing begins."
    };
  }

  const ageMinutes = Math.max(0, Math.round((now.getTime() - new Date(ownership.updatedAt).getTime()) / 60000));

  if (ageMinutes <= thresholdMinutes) {
    return {
      status: "ready",
      thresholdMinutes,
      ageMinutes,
      detail: `Telemetry remediation was acknowledged ${formatAgeLabel(ageMinutes)} ago and remains inside the ${thresholdMinutes}-minute follow-up window.`
    };
  }

  if (ageMinutes <= thresholdMinutes * 2) {
    return {
      status: "warning",
      thresholdMinutes,
      ageMinutes,
      detail: `Telemetry remediation follow-up is ${formatAgeLabel(ageMinutes - thresholdMinutes)} overdue after ${formatAgeLabel(ageMinutes)} since acknowledgement.`
    };
  }

  return {
    status: "critical",
    thresholdMinutes,
    ageMinutes,
    detail: `Telemetry remediation follow-up is materially overdue after ${formatAgeLabel(ageMinutes)} since acknowledgement.`
  };
}

function buildTelemetryRemediationFollowThrough(
  ownership: AtlasObservabilityTelemetryRemediationOwnershipRecord,
  recentActions: AtlasObservabilityTelemetryRemediationActionRecord[],
  recentRuns: AtlasObservabilityAutomationRunRecord[],
  followUp: AtlasObservabilityTelemetryRemediationFollowUpRecord,
  now: Date
): AtlasObservabilityTelemetryRemediationFollowThroughRecord {
  const ownerUserEmail = ownership.actorUserEmail;

  if (ownership.status !== "acknowledged" || !ownerUserEmail || !ownership.updatedAt) {
    return {
      status: "not_owned",
      ownerUserEmail: null,
      assignedAt: null,
      ageMinutes: null,
      lastOwnerActionAt: null,
      lastOwnerActionType: null,
      detail: "Telemetry remediation does not currently have an active owner handoff to track."
    };
  }

  const assignmentTimestamp = new Date(ownership.updatedAt).getTime();
  const lastOwnerAction = [
    ...recentActions
      .filter((action) => {
        const actionTimestamp = new Date(action.generatedAt).getTime();

        return (
          actionTimestamp > assignmentTimestamp &&
          action.action !== "ESCALATED" &&
          (action.ownerUserEmail ?? action.actorUserEmail) === ownerUserEmail
        );
      })
      .map((action) => ({
        generatedAt: action.generatedAt,
        actionType: action.action as AtlasObservabilityTelemetryRemediationAction | "AUTOMATION_RUN"
      })),
    ...recentRuns
      .filter((run) => {
        const runTimestamp = new Date(run.generatedAt).getTime();

        return runTimestamp > assignmentTimestamp && run.actorUserEmail === ownerUserEmail;
      })
      .map((run) => ({
        generatedAt: run.generatedAt,
        actionType: "AUTOMATION_RUN" as const
      }))
  ].sort((left, right) => new Date(right.generatedAt).getTime() - new Date(left.generatedAt).getTime())[0] ?? null;
  const ageMinutes = Math.max(0, Math.round((now.getTime() - assignmentTimestamp) / 60000));

  if (lastOwnerAction) {
    return {
      status: "acted",
      ownerUserEmail,
      assignedAt: ownership.updatedAt,
      ageMinutes,
      lastOwnerActionAt: lastOwnerAction.generatedAt,
      lastOwnerActionType: lastOwnerAction.actionType,
      detail:
        lastOwnerAction.actionType === "AUTOMATION_RUN"
          ? `${ownerUserEmail} has run observability remediation since the current ownership handoff.`
          : `${ownerUserEmail} has recorded ${lastOwnerAction.actionType.toLowerCase()} remediation follow-through since the current ownership handoff.`
    };
  }

  if (ownership.handoffAction !== "ASSIGNED" && ownership.handoffAction !== "TRANSFERRED") {
    return {
      status: "pending",
      ownerUserEmail,
      assignedAt: ownership.updatedAt,
      ageMinutes,
      lastOwnerActionAt: null,
      lastOwnerActionType: null,
      detail: `${ownerUserEmail} currently owns telemetry remediation, and Atlas has not yet recorded a follow-through action after the latest acknowledgement.`
    };
  }

  if (followUp.status === "critical") {
    return {
      status: "critical",
      ownerUserEmail,
      assignedAt: ownership.updatedAt,
      ageMinutes,
      lastOwnerActionAt: null,
      lastOwnerActionType: null,
      detail: `${ownerUserEmail} was assigned telemetry remediation ${formatAgeLabel(ageMinutes)} ago, and Atlas has not recorded follow-through from that owner before the breach window expired.`
    };
  }

  if (followUp.status === "warning") {
    return {
      status: "warning",
      ownerUserEmail,
      assignedAt: ownership.updatedAt,
      ageMinutes,
      lastOwnerActionAt: null,
      lastOwnerActionType: null,
      detail: `${ownerUserEmail} was assigned telemetry remediation ${formatAgeLabel(ageMinutes)} ago, and Atlas has not yet recorded follow-through from that owner.`
    };
  }

  return {
    status: "pending",
    ownerUserEmail,
    assignedAt: ownership.updatedAt,
    ageMinutes,
    lastOwnerActionAt: null,
    lastOwnerActionType: null,
    detail: `${ownerUserEmail} was assigned telemetry remediation ${formatAgeLabel(ageMinutes)} ago, and Atlas is waiting for owner follow-through.`
  };
}

function buildTelemetryRemediationAccountability(
  ownerUserEmail: string | null,
  recentActions: AtlasObservabilityTelemetryRemediationActionRecord[],
  recentRuns: AtlasObservabilityAutomationRunRecord[],
  evaluationTrigger: AtlasObservabilityTelemetryRemediationAction,
  evaluatedAt: string
): AtlasObservabilityTelemetryRemediationAccountabilityRecord | null {
  if (!ownerUserEmail) {
    return null;
  }

  const latestAssignment = findLatestAssignedTelemetryRemediationAction(ownerUserEmail, recentActions);

  if (!latestAssignment) {
    return null;
  }

  const assignmentTimestamp = new Date(latestAssignment.generatedAt).getTime();
  const evaluationTimestamp = new Date(evaluatedAt).getTime();
  const lastOwnerAction = [
    ...recentActions
      .filter((action) => {
        const actionTimestamp = new Date(action.generatedAt).getTime();

        return (
          actionTimestamp > assignmentTimestamp &&
          actionTimestamp <= evaluationTimestamp &&
          action.action !== "ESCALATED" &&
          (action.ownerUserEmail ?? action.actorUserEmail) === ownerUserEmail
        );
      })
      .map((action) => ({
        generatedAt: action.generatedAt,
        actionType: action.action as AtlasObservabilityTelemetryRemediationAction | "AUTOMATION_RUN"
      })),
    ...recentRuns
      .filter((run) => {
        const runTimestamp = new Date(run.generatedAt).getTime();

        return runTimestamp > assignmentTimestamp && runTimestamp <= evaluationTimestamp && run.actorUserEmail === ownerUserEmail;
      })
      .map((run) => ({
        generatedAt: run.generatedAt,
        actionType: "AUTOMATION_RUN" as const
      }))
  ].sort((left, right) => new Date(right.generatedAt).getTime() - new Date(left.generatedAt).getTime())[0] ?? null;

  if (lastOwnerAction) {
    return {
      outcome: "met",
      ownerUserEmail,
      evaluatedAt,
      evaluationTrigger,
      lastOwnerActionAt: lastOwnerAction.generatedAt,
      lastOwnerActionType: lastOwnerAction.actionType,
      detail:
        evaluationTrigger === "ESCALATED"
          ? `${ownerUserEmail} recorded owner follow-through before Atlas escalated telemetry remediation.`
          : `${ownerUserEmail} recorded owner follow-through before telemetry remediation was reassigned.`
    };
  }

  return {
    outcome: "unmet",
    ownerUserEmail,
    evaluatedAt,
    evaluationTrigger,
    lastOwnerActionAt: null,
    lastOwnerActionType: null,
    detail:
      evaluationTrigger === "ESCALATED"
        ? `${ownerUserEmail} did not record owner follow-through before Atlas escalated telemetry remediation.`
        : `${ownerUserEmail} was reassigned off telemetry remediation without recorded owner follow-through.`
  };
}

function findLatestTelemetryRemediationAccountability(
  actions: AtlasObservabilityTelemetryRemediationActionRecord[]
) {
  return actions.find((action) => action.ownerAccountability) ?? null;
}

function buildTelemetryRemediationNotificationRecord(status: AtlasObservabilityAutomationStatusRecord) {
  const latestAccountabilityAction = findLatestTelemetryRemediationAccountability(status.recentTelemetryRemediationActions);
  const latestAccountability = latestAccountabilityAction?.ownerAccountability ?? null;
  const isActive = status.telemetryRemediation.recommendedAction !== "none";
  const isEscalated = status.telemetryRemediation.status === "escalated";
  const isAcknowledged = status.telemetryRemediationOwnership.status === "acknowledged";
  const hasOverdueFollowUp =
    status.telemetryRemediationFollowUp.status === "warning" ||
    status.telemetryRemediationFollowUp.status === "critical";
  const hasOwnerFollowThroughGap =
    status.telemetryRemediationFollowThrough.status === "warning" ||
    status.telemetryRemediationFollowThrough.status === "critical";
  const title = hasOverdueFollowUp
    ? status.telemetryRemediationFollowUp.status === "critical"
      ? "Telemetry remediation follow-up is overdue"
      : "Telemetry remediation follow-up needs review"
    : hasOwnerFollowThroughGap
      ? status.telemetryRemediationFollowThrough.status === "critical"
        ? "Assigned telemetry remediation owner has not acted"
        : "Assigned telemetry remediation owner follow-through needs review"
    : isEscalated
    ? "Telemetry remediation requires escalation"
    : isActive
      ? "Telemetry remediation requires operator follow-up"
      : "Telemetry remediation resolved";
  const description = hasOverdueFollowUp
    ? status.telemetryRemediationFollowUp.detail
    : hasOwnerFollowThroughGap
      ? status.telemetryRemediationFollowThrough.detail
    : latestAccountability?.outcome === "unmet"
      ? latestAccountability.detail
    : isEscalated
    ? isAcknowledged && status.telemetryRemediationOwnership.actorUserEmail
      ? `${status.telemetryRemediationOwnership.detail} Atlas is keeping the escalation surfaced until ownership is restored or explicitly closed.`
      : `${status.telemetryRemediation.detail} Atlas is keeping this issue surfaced until ownership is restored or explicitly closed.`
    : isActive
      ? isAcknowledged && status.telemetryRemediationOwnership.actorUserEmail
        ? `${status.telemetryRemediationOwnership.detail} ${status.telemetryRemediation.detail}`
        : `${status.telemetryRemediation.detail} Recommended response: ${status.telemetryRemediation.recommendedActionLabel}.`
      : status.telemetryRemediationOwnership.status === "resolved" &&
          status.telemetryRemediationOwnership.actorUserEmail &&
          status.telemetryRemediationOwnership.reason
        ? `${status.telemetryRemediationOwnership.actorUserEmail} resolved the latest telemetry remediation posture. ${status.telemetryRemediationOwnership.reason}`
        : "Telemetry ownership is currently healthy and no active remediation follow-up remains queued.";

  return {
    dedupeKey: `observability-remediation:${appRuntime.appEnv}`,
    title,
    description,
    status: isActive && (isEscalated || !isAcknowledged || hasOverdueFollowUp || hasOwnerFollowThroughGap) ? "UNREAD" : "READ",
    metadata: {
      remediationStatus: status.telemetryRemediation.status,
      ownershipStatus: status.telemetryRemediationOwnership.status,
      ownerUserEmail: status.telemetryRemediationOwnership.actorUserEmail,
      assignedByUserEmail: status.telemetryRemediationOwnership.assignedByUserEmail ?? null,
      handoffAction: status.telemetryRemediationOwnership.handoffAction ?? null,
      followUpStatus: status.telemetryRemediationFollowUp.status,
      followUpThresholdMinutes: status.telemetryRemediationFollowUp.thresholdMinutes,
      followUpAgeMinutes: status.telemetryRemediationFollowUp.ageMinutes,
      followThroughStatus: status.telemetryRemediationFollowThrough.status,
      followThroughOwnerUserEmail: status.telemetryRemediationFollowThrough.ownerUserEmail,
      followThroughAssignedAt: status.telemetryRemediationFollowThrough.assignedAt,
      followThroughAgeMinutes: status.telemetryRemediationFollowThrough.ageMinutes,
      followThroughLastOwnerActionAt: status.telemetryRemediationFollowThrough.lastOwnerActionAt,
      followThroughLastOwnerActionType: status.telemetryRemediationFollowThrough.lastOwnerActionType,
      latestAccountabilityOutcome: latestAccountability?.outcome ?? null,
      latestAccountabilityOwnerUserEmail: latestAccountability?.ownerUserEmail ?? null,
      latestAccountabilityEvaluatedAt: latestAccountability?.evaluatedAt ?? null,
      latestAccountabilityTrigger: latestAccountability?.evaluationTrigger ?? null,
      recommendedAction: status.telemetryRemediation.recommendedAction,
      affectedOwnershipKeys: status.telemetryRemediation.affectedOwnershipKeys,
      latestAutomationReportPath: status.telemetryRemediation.latestReportPath,
      remediationReportPath: status.telemetryRemediationOwnership.reportPath,
      remediationUpdatedAt: status.telemetryRemediationOwnership.updatedAt
    } satisfies Prisma.InputJsonObject
  } as const;
}

async function syncObservabilityTelemetryRemediationNotification(
  actor: AtlasActorContext,
  status: AtlasObservabilityAutomationStatusRecord,
  client: DatabaseClient
) {
  const notificationClient = client as unknown as {
    notification?: {
      upsert?: (args: {
        where: {
          dedupeKey: string;
        };
        create: {
          dedupeKey: string;
          organizationId: string;
          caseId: null;
          category: string;
          title: string;
          description: string;
          status: "UNREAD" | "READ";
          metadata: Prisma.InputJsonObject;
        };
        update: {
          organizationId: string;
          category: string;
          title: string;
          description: string;
          status: "UNREAD" | "READ";
          metadata: Prisma.InputJsonObject;
        };
      }) => Promise<unknown>;
    };
  };

  if (!notificationClient.notification?.upsert) {
    return;
  }

  const notification = buildTelemetryRemediationNotificationRecord(status);

  await notificationClient.notification.upsert({
    where: {
      dedupeKey: notification.dedupeKey
    },
    create: {
      dedupeKey: notification.dedupeKey,
      organizationId: actor.organization.id,
      caseId: null,
      category: "observability-remediation",
      title: notification.title,
      description: notification.description,
      status: notification.status,
      metadata: notification.metadata
    },
    update: {
      organizationId: actor.organization.id,
      category: "observability-remediation",
      title: notification.title,
      description: notification.description,
      status: notification.status,
      metadata: notification.metadata
    }
  });
}

async function createTelemetryRemediationAuditEvent(
  actor: AtlasActorContext,
  action: AtlasObservabilityTelemetryRemediationActionRecord,
  client: DatabaseClient
) {
  const auditClient = client as unknown as {
    auditEvent?: {
      create?: (args: {
        data: {
          organizationId: string;
          userId: string;
          actorType: "HUMAN";
          eventType: string;
          targetType: string;
          targetId: string;
          requestId: null;
          payload: Prisma.InputJsonValue;
        };
      }) => Promise<unknown>;
    };
  };

  if (!auditClient.auditEvent?.create) {
    return;
  }

  await auditClient.auditEvent.create({
    data: {
      organizationId: actor.organization.id,
      userId: actor.user.id,
      actorType: "HUMAN",
      eventType:
        action.action === "RESOLVED"
          ? "observability.telemetry_remediation_resolved"
          : action.action === "TRANSFERRED"
            ? "observability.telemetry_remediation_transferred"
            : action.action === "ASSIGNED"
              ? "observability.telemetry_remediation_assigned"
          : action.action === "REACKNOWLEDGED"
            ? "observability.telemetry_remediation_reacknowledged"
            : action.action === "ESCALATED"
              ? "observability.telemetry_remediation_escalated"
              : "observability.telemetry_remediation_acknowledged",
      targetType: "ObservabilityRemediation",
      targetId: action.reportPath,
      requestId: null,
      payload: {
        action: action.action,
        ownerUserEmail: action.ownerUserEmail,
        ownerAccountability: action.ownerAccountability,
        reason: action.reason,
        remediationStatus: action.remediationStatus,
        affectedOwnershipKeys: action.affectedOwnershipKeys,
        latestAutomationReportPath: action.latestAutomationReportPath,
        resolvedIncidentTriggerCount: action.resolvedIncidentTriggerCount,
        activeIncidentTriggerCount: action.activeIncidentTriggerCount,
        reportPath: action.reportPath
      } satisfies Prisma.InputJsonObject
    }
  });
}

async function persistTelemetryRemediationAction(
  actor: AtlasActorContext,
  input: {
    action: AtlasObservabilityTelemetryRemediationAction;
    ownerUserEmail?: string | null;
    ownerAccountability?: AtlasObservabilityTelemetryRemediationAccountabilityRecord | null;
    reason: string;
    remediationStatus: AtlasObservabilityTelemetryRemediationRecord["status"];
    affectedOwnershipKeys: AtlasObservabilityTelemetryOwnershipRecord["key"][];
    latestAutomationReportPath: string | null;
    resolvedIncidentTriggerCount?: number;
    activeIncidentTriggerCount?: number;
    generatedAt: string;
  },
  client: DatabaseClient
) {
  const reportPath = writeTelemetryRemediationReport({
    version: 1,
    action: input.action,
    generatedAt: input.generatedAt,
    actorUserEmail: actor.user.email,
    ownerUserEmail: input.ownerUserEmail ?? actor.user.email,
    ownerAccountability: input.ownerAccountability ?? null,
    reason: input.reason,
    remediationStatus: input.remediationStatus,
    affectedOwnershipKeys: input.affectedOwnershipKeys,
    latestAutomationReportPath: input.latestAutomationReportPath,
    resolvedIncidentTriggerCount: input.resolvedIncidentTriggerCount,
    activeIncidentTriggerCount: input.activeIncidentTriggerCount
  });

  return mapTelemetryRemediationActionRecord(
    {
      version: 1,
      action: input.action,
      generatedAt: input.generatedAt,
      actorUserEmail: actor.user.email,
      ownerUserEmail: input.ownerUserEmail ?? actor.user.email,
      ownerAccountability: input.ownerAccountability ?? null,
      reason: input.reason,
      remediationStatus: input.remediationStatus,
      affectedOwnershipKeys: input.affectedOwnershipKeys,
      latestAutomationReportPath: input.latestAutomationReportPath,
      resolvedIncidentTriggerCount: input.resolvedIncidentTriggerCount,
      activeIncidentTriggerCount: input.activeIncidentTriggerCount
    },
    reportPath,
    input.generatedAt
  );
}

async function persistTelemetryRemediationEscalationIfNeeded(
  actor: AtlasActorContext,
  status: AtlasObservabilityAutomationStatusRecord,
  generatedAt: string | undefined,
  client: DatabaseClient
) {
  if (status.telemetryRemediationFollowUp.status !== "critical") {
    return null;
  }

  const latestEscalation = findLatestTelemetryRemediationAction(status.recentTelemetryRemediationActions, ["ESCALATED"]);
  const latestAcknowledgement = findLatestTelemetryRemediationAction(status.recentTelemetryRemediationActions, [
    "ACKNOWLEDGED",
    "ASSIGNED",
    "TRANSFERRED",
    "REACKNOWLEDGED"
  ]);

  if (
    latestEscalation &&
    latestAcknowledgement &&
    new Date(latestEscalation.generatedAt).getTime() >= new Date(latestAcknowledgement.generatedAt).getTime()
  ) {
    return null;
  }

  const action = await persistTelemetryRemediationAction(
    actor,
    {
      action: "ESCALATED",
      ownerUserEmail: status.telemetryRemediationOwnership.actorUserEmail,
      ownerAccountability:
        findLatestTelemetryRemediationAction(status.recentTelemetryRemediationActions, ["ASSIGNED", "TRANSFERRED"])
          ? buildTelemetryRemediationAccountability(
              status.telemetryRemediationOwnership.actorUserEmail ??
                findLatestTelemetryRemediationAction(status.recentTelemetryRemediationActions, ["ASSIGNED", "TRANSFERRED"])
                  ?.ownerUserEmail ??
                null,
              status.recentTelemetryRemediationActions,
              status.recentRuns,
              "ESCALATED",
              generatedAt ?? new Date().toISOString()
            )
          : null,
      reason: `Atlas escalated telemetry remediation after the ${status.telemetryRemediationFollowUp.thresholdMinutes}-minute follow-up window was materially breached.`,
      remediationStatus: status.telemetryRemediation.status,
      affectedOwnershipKeys: status.telemetryRemediation.affectedOwnershipKeys,
      latestAutomationReportPath: status.lastReportPath,
      resolvedIncidentTriggerCount: 0,
      activeIncidentTriggerCount: 0,
      generatedAt: generatedAt ?? new Date().toISOString()
    },
    client
  );
  await createTelemetryRemediationAuditEvent(actor, action, client);

  return action;
}

async function syncTelemetryRemediationIncidentPosture(
  actor: AtlasActorContext,
  reason: string,
  now: string,
  client: DatabaseClient
) {
  const metrics = readPublishedApiRuntimeTelemetry();

  if (!metrics) {
    throw new AtlasObservabilityOperationsError(
      "Telemetry remediation resolution requires a published API runtime snapshot so current incident posture can be reconciled.",
      "bad_request"
    );
  }

  const [overview, activeIncidentTriggers] = await Promise.all([
    getOperatorOverview(actor, client),
    listObservabilityIncidentTriggers(
      actor,
      {
        limit: 50,
        status: "ACTIVE"
      },
      client
    )
  ]);
  const workerTelemetry = readPublishedWorkerTelemetry(now);
  const automationStatus = getObservabilityAutomationStatus(actor, {
    limit: 12,
    now
  });
  const { alerts, incidentReadiness } = buildObservabilityAutomationAlertState({
    metrics,
    overview,
    workerTelemetry,
    telemetryOwnership: automationStatus.telemetryOwnership,
    latestAutomationRun: automationStatus.recentRuns[0] ?? null,
    telemetryRecoveryEscalation: automationStatus.telemetryRecoveryEscalation,
    telemetryRemediationFollowUp: automationStatus.telemetryRemediationFollowUp,
    telemetryRemediationFollowThrough: automationStatus.telemetryRemediationFollowThrough,
    latestTelemetryRemediationAccountability:
      findLatestTelemetryRemediationAccountability(automationStatus.recentTelemetryRemediationActions)?.ownerAccountability ?? null,
    activeIncidentTriggerCount: activeIncidentTriggers.length,
    now
  });

  return syncObservabilityIncidentTriggers(
    {
      actor,
      minimumSeverity: observabilityRuntime.incidentMinimumSeverity,
      reason,
      alerts,
      metrics,
      incidentReadiness,
      workerTelemetry
    },
    client
  );
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

async function resolveTelemetryRemediationOwner(
  actor: AtlasActorContext,
  ownerUserEmail: string,
  client: DatabaseClient
) {
  const normalizedEmail = normalizeActorUserEmail(ownerUserEmail);
  const membership = await client.membership.findFirst({
    where: {
      role: {
        in: ["OWNER", "ADMIN", "OPERATOR"]
      },
      organization: {
        id: actor.organization.id,
        kind: "OPERATOR"
      },
      user: {
        email: normalizedEmail
      }
    },
    include: {
      user: true
    }
  });

  if (!membership) {
    throw new AtlasObservabilityOperationsError(
      "Telemetry remediation ownership can only be assigned to a real operator membership in the current operator organization.",
      "forbidden"
    );
  }

  return membership.user.email.toLowerCase();
}

function buildObservabilityAutomationAlertState(input: {
  metrics: AtlasApiRuntimeTelemetryRecord;
  overview: Awaited<ReturnType<typeof getOperatorOverview>>;
  workerTelemetry: AtlasWorkerTelemetryRecord;
  telemetryOwnership: AtlasObservabilityTelemetryOwnershipRecord[];
  latestAutomationRun: AtlasObservabilityAutomationRunRecord | null;
  telemetryRecoveryEscalation: AtlasObservabilityTelemetryRecoveryEscalationRecord;
  telemetryRemediationFollowUp?: AtlasObservabilityTelemetryRemediationFollowUpRecord | null;
  telemetryRemediationFollowThrough?: AtlasObservabilityTelemetryRemediationFollowThroughRecord | null;
  latestTelemetryRemediationAccountability?: AtlasObservabilityTelemetryRemediationAccountabilityRecord | null;
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
    telemetryRemediationFollowUp: input.telemetryRemediationFollowUp,
    telemetryRemediationFollowThrough: input.telemetryRemediationFollowThrough,
    latestTelemetryRemediationAccountability: input.latestTelemetryRemediationAccountability,
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
  activeBreachStartedAt?: string | null;
  activeBreachMinutes?: number | null;
  endedBreach?: boolean;
  ownershipSampleCount?: number | null;
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
      remainingKeys: input.remainingKeys ?? [],
      activeBreachStartedAt: input.activeBreachStartedAt ?? null,
      activeBreachMinutes: input.activeBreachMinutes ?? null,
      endedBreach: input.endedBreach ?? false,
      ownershipSampleCount: input.ownershipSampleCount ?? 0
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
    staleAfterMinutes: observabilityRuntime.workerOwnershipStaleAfterMinutes,
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
  const ownershipState = getRuntimeAwareTelemetryOwnershipState({
    now: options.now,
    latestRun
  });
  const telemetryOwnership = ownershipState.telemetryOwnership;
  const telemetryRecoveryEscalation = buildTelemetryRecoveryEscalation(
    recentRuns,
    summarizeActiveTelemetryBreach(ownershipState.ownershipWindows)
  );
  const telemetryRemediation = buildAtlasObservabilityTelemetryRemediation({
    telemetryOwnership,
    latestAutomationRun: latestRun,
    telemetryRecoveryEscalation,
    dispatchAlerts: observabilityRuntime.automationDispatchAlerts,
    triggerIncidents: observabilityRuntime.automationTriggerIncidents,
    minimumSeverity: observabilityRuntime.automationDefaultMinimumSeverity
  });
  const telemetryRemediationOwnership = buildTelemetryRemediationOwnership(
    telemetryRemediation,
    recentTelemetryRemediationActions
  );
  const telemetryRemediationFollowUp = buildTelemetryRemediationFollowUp(
    telemetryOwnership,
    telemetryRemediationOwnership,
    now
  );
  const telemetryRemediationFollowThrough = buildTelemetryRemediationFollowThrough(
    telemetryRemediationOwnership,
    recentTelemetryRemediationActions,
    recentRuns,
    telemetryRemediationFollowUp,
    now
  );
  const finalTelemetryRemediation = buildAtlasObservabilityTelemetryRemediation({
    telemetryOwnership,
    latestAutomationRun: latestRun,
    telemetryRecoveryEscalation,
    telemetryRemediationFollowUp,
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
    telemetryRemediation: finalTelemetryRemediation,
    telemetryRemediationOwnership,
    telemetryRemediationFollowUp,
    telemetryRemediationFollowThrough,
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
      automationRetentionDays: observabilityRuntime.automationRetentionDays,
      ownershipHistoryRetentionDays: observabilityRuntime.ownershipHistoryRetentionDays
    },
    lastRunAt: latestRun?.generatedAt ?? null,
    lastRunStatus: latestRun?.status ?? null,
    lastReportPath: latestRun?.reportPath ?? null,
    telemetryOwnership,
    ownershipWindows: ownershipState.ownershipWindows,
    ownershipTrends: ownershipState.ownershipTrends,
    latestOwnershipSamples: ownershipState.latestOwnershipSamples,
    recentTelemetryRemediationActions,
    recentRuns
  } satisfies AtlasObservabilityAutomationStatusRecord;
}

async function syncTelemetryRemediationNotificationFromCurrentStatus(
  actor: AtlasActorContext,
  input: {
    limit?: number;
    now?: string;
  },
  client: DatabaseClient
) {
  let status = getObservabilityAutomationStatus(actor, input);
  const escalationAction = await persistTelemetryRemediationEscalationIfNeeded(actor, status, input.now, client);

  if (escalationAction) {
    status = getObservabilityAutomationStatus(actor, input);
  }

  await syncObservabilityTelemetryRemediationNotification(actor, status, client);
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
  activeBreachStartedAt?: string | null;
  activeBreachMinutes?: number | null;
  endedBreach?: boolean;
  ownershipSampleCount?: number | null;
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
      activeBreachStartedAt: input.activeBreachStartedAt,
      activeBreachMinutes: input.activeBreachMinutes,
      endedBreach: input.endedBreach,
      ownershipSampleCount: input.ownershipSampleCount,
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
      activeBreachStartedAt: input.activeBreachStartedAt,
      activeBreachMinutes: input.activeBreachMinutes,
      endedBreach: input.endedBreach,
      ownershipSampleCount: input.ownershipSampleCount,
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
  const beforeActiveBreach = summarizeActiveTelemetryBreach(currentStatus.ownershipWindows);
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
    activeBreachStartedAt: beforeActiveBreach?.startedAt ?? null,
    activeBreachMinutes: beforeActiveBreach?.minutes ?? null,
    endedBreach: false,
    ownershipSampleCount: currentStatus.ownershipWindows.reduce((total, window) => total + window.sampleCountInWindow, 0),
    reportPath: "pending-telemetry-failure",
    errorMessage: input.errorMessage
  } satisfies AtlasObservabilityAutomationRunRecord;
  appendAutomationCadenceOwnershipSample({
    generatedAt,
    status: "critical",
    detail: `Automation run failed: ${input.errorMessage}`
  });
  const afterOwnershipState = getRuntimeAwareTelemetryOwnershipState({
    now: generatedAt,
    latestRun: failedRunRecord
  });
  const afterOwnership = afterOwnershipState.telemetryOwnership;
  const remainingKeys = listDegradedTelemetryOwnershipKeys(afterOwnership);
  const telemetryRecoveryEscalation = buildTelemetryRecoveryEscalation([
    {
      ...failedRunRecord,
      remainingOwnershipCount: remainingKeys.length
    },
    ...currentStatus.recentRuns
  ], summarizeActiveTelemetryBreach(afterOwnershipState.ownershipWindows));
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
    telemetryRemediationFollowUp: currentStatus.telemetryRemediationFollowUp,
    telemetryRemediationFollowThrough: currentStatus.telemetryRemediationFollowThrough,
    latestTelemetryRemediationAccountability:
      findLatestTelemetryRemediationAccountability(currentStatus.recentTelemetryRemediationActions)?.ownerAccountability ?? null,
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
    activeBreachStartedAt: beforeActiveBreach?.startedAt ?? null,
    activeBreachMinutes: beforeActiveBreach?.minutes ?? null,
    endedBreach: false,
    ownershipSampleCount: afterOwnershipState.ownershipWindows.reduce((total, window) => total + window.sampleCountInWindow, 0),
    alertCount: alerts.length,
    workerTelemetryStatus: workerTelemetry.status,
    snapshotId: artifacts.snapshot?.id ?? null,
    activeIncidentCount: artifacts.incidentTriggers?.activeCount ?? activeIncidentTriggerCount,
    dispatchId: artifacts.dispatch?.id ?? null,
    generatedAt,
    errorMessage: input.errorMessage
  });
  await persistTelemetryRemediationEscalationIfNeeded(
    actor,
    getObservabilityAutomationStatus(actor, {
      limit: 12,
      now: generatedAt
    }),
    generatedAt,
    client
  );
  await syncTelemetryRemediationNotificationFromCurrentStatus(
    actor,
    {
      limit: 12,
      now: generatedAt
    },
    client
  );

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
    ownerUserEmail?: string;
    now?: string;
  },
  client: DatabaseClient = prisma
) {
  assertObservabilityViewer(actor);
  const reason = normalizeReason(input.reason);
  const status = getObservabilityAutomationStatus(actor, {
    limit: 12,
    now: input.now
  });
  let ownerUserEmail: string | null = null;

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

  if (input.action === "ASSIGNED" || input.action === "TRANSFERRED") {
    if (status.telemetryRemediation.recommendedAction === "none") {
      throw new AtlasObservabilityOperationsError(
        "Telemetry ownership is currently healthy, so there is no remediation posture to assign.",
        "bad_request"
      );
    }

    ownerUserEmail = await resolveTelemetryRemediationOwner(actor, input.ownerUserEmail ?? "", client);

    if (input.action === "ASSIGNED" && status.telemetryRemediationOwnership.status === "acknowledged") {
      throw new AtlasObservabilityOperationsError(
        "Telemetry remediation already has an acknowledged owner. Transfer ownership instead of assigning it again.",
        "bad_request"
      );
    }

    if (input.action === "TRANSFERRED" && status.telemetryRemediationOwnership.status !== "acknowledged") {
      throw new AtlasObservabilityOperationsError(
        "Telemetry remediation must already have an acknowledged owner before it can be transferred.",
        "bad_request"
      );
    }

    if (input.action === "ASSIGNED" && ownerUserEmail === actor.user.email) {
      throw new AtlasObservabilityOperationsError(
        "Use acknowledgement when you are taking telemetry remediation ownership yourself.",
        "bad_request"
      );
    }

    if (
      status.telemetryRemediationOwnership.actorUserEmail &&
      ownerUserEmail === status.telemetryRemediationOwnership.actorUserEmail
    ) {
      throw new AtlasObservabilityOperationsError(
        "Telemetry remediation is already owned by the selected operator.",
        "bad_request"
      );
    }
  }

  if (input.action === "REACKNOWLEDGED") {
    assertTelemetryRemediationOwnerActionAllowed(
      actor,
      status.telemetryRemediationOwnership,
      "re-acknowledge telemetry remediation"
    );

    if (status.telemetryRemediation.recommendedAction === "none") {
      throw new AtlasObservabilityOperationsError(
        "Telemetry ownership is currently healthy, so there is no remediation posture to re-acknowledge.",
        "bad_request"
      );
    }

    if (status.telemetryRemediationOwnership.status !== "acknowledged") {
      throw new AtlasObservabilityOperationsError(
        "Telemetry remediation must be acknowledged before it can be re-acknowledged.",
        "bad_request"
      );
    }

    if (status.telemetryRemediationFollowUp.status === "ready") {
      throw new AtlasObservabilityOperationsError(
        "The current telemetry remediation posture does not yet require re-acknowledgement.",
        "bad_request"
      );
    }
  }

  if (input.action === "RESOLVED") {
    assertTelemetryRemediationOwnerActionAllowed(actor, status.telemetryRemediationOwnership, "resolve telemetry remediation");

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
  const ownerAccountability =
    input.action === "TRANSFERRED" &&
    findLatestAssignedTelemetryRemediationAction(
      status.telemetryRemediationOwnership.actorUserEmail ?? "",
      status.recentTelemetryRemediationActions
    )
      ? buildTelemetryRemediationAccountability(
          status.telemetryRemediationOwnership.actorUserEmail,
          status.recentTelemetryRemediationActions,
          status.recentRuns,
          "TRANSFERRED",
          generatedAt
        )
      : null;
  const affectedOwnershipKeys =
    input.action === "RESOLVED"
      ? (status.recentTelemetryRemediationActions[0]?.affectedOwnershipKeys ?? [])
      : status.telemetryRemediation.affectedOwnershipKeys;
  const incidentTriggerSync =
    input.action === "RESOLVED"
      ? await syncTelemetryRemediationIncidentPosture(actor, reason, generatedAt, client)
      : {
          items: [],
          createdCount: 0,
          resolvedCount: 0,
          activeCount: 0
        };
  const action = await persistTelemetryRemediationAction(
    actor,
    {
      action: input.action,
      ownerUserEmail,
      ownerAccountability,
      reason,
      remediationStatus: status.telemetryRemediation.status,
      affectedOwnershipKeys,
      latestAutomationReportPath: status.lastReportPath,
      resolvedIncidentTriggerCount: incidentTriggerSync.resolvedCount,
      activeIncidentTriggerCount: incidentTriggerSync.activeCount,
      generatedAt
    },
    client
  );
  await applyObservabilityRetentionPolicy();
  await syncTelemetryRemediationNotificationFromCurrentStatus(
    actor,
    {
      limit: 12,
      now: generatedAt
    },
    client
  );
  await createTelemetryRemediationAuditEvent(actor, action, client);

  return action;
}

function assertTelemetryRemediationOwnerActionAllowed(
  actor: AtlasActorContext,
  ownership: AtlasObservabilityAutomationStatusRecord["telemetryRemediationOwnership"],
  actionLabel: string
) {
  if (
    ownership.status === "acknowledged" &&
    ownership.actorUserEmail &&
    ownership.actorUserEmail !== actor.user.email
  ) {
    throw new AtlasObservabilityOperationsError(
      `Telemetry remediation is currently owned by ${ownership.actorUserEmail}. Transfer ownership before another operator can ${actionLabel}.`,
      "forbidden"
    );
  }
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
    telemetryRemediationFollowUp: automationStatus.telemetryRemediationFollowUp,
    telemetryRemediationFollowThrough: automationStatus.telemetryRemediationFollowThrough,
    latestTelemetryRemediationAccountability:
      findLatestTelemetryRemediationAccountability(automationStatus.recentTelemetryRemediationActions)?.ownerAccountability ?? null,
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
  appendAutomationCadenceOwnershipSample({
    generatedAt: automation.generatedAt,
    status: "healthy",
    detail: `Automation run completed with ${automation.alertCount} alert${automation.alertCount === 1 ? "" : "s"} reviewed.`
  });
  const afterOwnershipState = getRuntimeAwareTelemetryOwnershipState({
    now: automation.generatedAt
  });
  const activeBreach = summarizeActiveTelemetryBreach(afterOwnershipState.ownershipWindows);
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
    activeBreachStartedAt: activeBreach?.startedAt ?? null,
    activeBreachMinutes: activeBreach?.minutes ?? null,
    endedBreach: false,
    ownershipSampleCount: afterOwnershipState.ownershipWindows.reduce((total, window) => total + window.sampleCountInWindow, 0),
    automation
  });
  const reportPath = writeObservabilityAutomationReport(report);
  await syncTelemetryRemediationNotificationFromCurrentStatus(
    automation.actor,
    {
      limit: 12,
      now: automation.generatedAt
    },
    client
  );

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
  if ((input.trigger ?? "manual") !== "scheduled") {
    assertTelemetryRemediationOwnerActionAllowed(
      actor,
      currentStatus.telemetryRemediationOwnership,
      "run telemetry remediation recovery"
    );
  }
  const beforeOwnership = currentStatus.telemetryOwnership;
  const degradedBeforeKeys = listDegradedTelemetryOwnershipKeys(beforeOwnership);
  const beforeActiveBreach = summarizeActiveTelemetryBreach(currentStatus.ownershipWindows);

  if (degradedBeforeKeys.length === 0) {
    appendAutomationCadenceOwnershipSample({
      generatedAt,
      status: "healthy",
      detail: "Automation recovery was skipped because telemetry ownership was already healthy."
    });
    const afterState = getRuntimeAwareTelemetryOwnershipState({
      now: generatedAt
    });
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
        afterOwnership: afterState.telemetryOwnership,
        activeBreachStartedAt: beforeActiveBreach?.startedAt ?? null,
        activeBreachMinutes: beforeActiveBreach?.minutes ?? null,
        endedBreach: false,
        ownershipSampleCount: afterState.ownershipWindows.reduce((total, window) => total + window.sampleCountInWindow, 0)
      })
    );
    await syncTelemetryRemediationNotificationFromCurrentStatus(
      actor,
      {
        limit: 12,
        now: generatedAt
      },
      client
    );

    return {
      status: "no_action" as AtlasObservabilityTelemetryRecoveryStatus,
      reportPath,
      beforeOwnership,
      afterOwnership: afterState.telemetryOwnership,
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
    activeBreachStartedAt: beforeActiveBreach?.startedAt ?? null,
    activeBreachMinutes: beforeActiveBreach?.minutes ?? null,
    endedBreach: false,
    ownershipSampleCount: currentStatus.ownershipWindows.reduce((total, window) => total + window.sampleCountInWindow, 0),
    reportPath: "pending-telemetry-recovery",
    errorMessage: null
  };
  appendAutomationCadenceOwnershipSample({
    generatedAt,
    status: "healthy",
    detail: `Automation recovery ran with worker telemetry status ${posture.workerTelemetry.status}.`
  });
  const afterOwnershipState = getRuntimeAwareTelemetryOwnershipState({
    now: generatedAt,
    latestRun: afterRunRecordBase
  });
  const afterOwnership = afterOwnershipState.telemetryOwnership;
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
    remainingOwnershipCount: remainingKeys.length,
    endedBreach: beforeActiveBreach !== null && summarizeActiveTelemetryBreach(afterOwnershipState.ownershipWindows) === null,
    ownershipSampleCount: afterOwnershipState.ownershipWindows.reduce((total, window) => total + window.sampleCountInWindow, 0)
  } satisfies AtlasObservabilityAutomationRunRecord;
  const telemetryRecoveryEscalation = buildTelemetryRecoveryEscalation(
    [afterRunRecord, ...currentStatus.recentRuns],
    summarizeActiveTelemetryBreach(afterOwnershipState.ownershipWindows)
  );
  const afterTelemetryRemediation = buildAtlasObservabilityTelemetryRemediation({
    telemetryOwnership: afterOwnership,
    latestAutomationRun: afterRunRecord,
    telemetryRecoveryEscalation,
    dispatchAlerts: observabilityRuntime.automationDispatchAlerts,
    triggerIncidents,
    minimumSeverity
  });
  const afterTelemetryRemediationOwnership = buildTelemetryRemediationOwnership(
    afterTelemetryRemediation,
    currentStatus.recentTelemetryRemediationActions
  );
  const afterTelemetryRemediationFollowUp = buildTelemetryRemediationFollowUp(
    afterOwnership,
    afterTelemetryRemediationOwnership,
    new Date(generatedAt)
  );
  const afterAlertState = buildObservabilityAutomationAlertState({
    metrics: posture.metrics,
    overview: posture.overview,
    workerTelemetry: posture.workerTelemetry,
    telemetryOwnership: afterOwnership,
    latestAutomationRun: afterRunRecord,
    telemetryRecoveryEscalation,
    telemetryRemediationFollowUp: afterTelemetryRemediationFollowUp,
    telemetryRemediationFollowThrough: buildTelemetryRemediationFollowThrough(
      afterTelemetryRemediationOwnership,
      currentStatus.recentTelemetryRemediationActions,
      [afterRunRecord, ...currentStatus.recentRuns],
      afterTelemetryRemediationFollowUp,
      new Date(generatedAt)
    ),
    latestTelemetryRemediationAccountability:
      findLatestTelemetryRemediationAccountability(currentStatus.recentTelemetryRemediationActions)?.ownerAccountability ?? null,
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
      alerts: afterAlertState.alerts,
      incidentReadiness: afterAlertState.incidentReadiness
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
    alertCount: afterAlertState.alerts.length,
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
      activeBreachStartedAt: beforeActiveBreach?.startedAt ?? null,
      activeBreachMinutes: beforeActiveBreach?.minutes ?? null,
      endedBreach: beforeActiveBreach !== null && summarizeActiveTelemetryBreach(afterOwnershipState.ownershipWindows) === null,
      ownershipSampleCount: afterOwnershipState.ownershipWindows.reduce((total, window) => total + window.sampleCountInWindow, 0),
      automation
    })
  );
  await syncTelemetryRemediationNotificationFromCurrentStatus(
    posture.actor,
    {
      limit: 12,
      now: generatedAt
    },
    client
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
  await syncTelemetryRemediationNotificationFromCurrentStatus(
    automation.actor,
    {
      limit: 12,
      now: automation.generatedAt
    },
    client
  );

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
