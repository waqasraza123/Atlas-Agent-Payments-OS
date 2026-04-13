import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AtlasActorContext } from "@atlas/auth";
import { appRuntime, observabilityRuntime } from "@atlas/config";
import {
  buildAtlasIncidentReadinessRecord,
  buildAtlasObservabilityAlerts,
  buildAtlasWorkerTelemetryRecord,
  type AtlasApiRuntimeTelemetryRecord,
  type AtlasObservabilityAlertSeverity,
  type AtlasWorkerRuntimeMetricsSnapshot,
  type AtlasWorkerTelemetryRecord
} from "@atlas/domain";
import { type PrismaClient } from "./generated/client/index.js";
import { prisma } from "./client";
import { getOperatorOverview } from "./operator-workflow";
import {
  AtlasObservabilityOperationsError,
  dispatchObservabilityAlerts,
  listObservabilityIncidentTriggers,
  persistObservabilitySnapshot,
  syncObservabilityIncidentTriggers
} from "./observability-operations";

type DatabaseClient = PrismaClient;

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
    now?: string;
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
          incidentReadiness: posture.incidentReadiness
        },
        client
      )
    : null;
  const reportPath = resolveAutomationReportPath();
  const report = {
    version: 1,
    generatedAt: input.now ?? new Date().toISOString(),
    appEnv: appRuntime.appEnv,
    releaseStage: appRuntime.releaseStage,
    actorUserEmail: posture.actor.user.email,
    reason,
    minimumSeverity,
    dispatchAlerts: Boolean(input.dispatchAlerts),
    metrics: posture.metrics,
    workerTelemetry: posture.workerTelemetry,
    alertCount: posture.alerts.length,
    incidentReadiness: posture.incidentReadiness,
    snapshot,
    incidentTriggers,
    dispatch
  };

  mkdirSync(dirname(reportPath), {
    recursive: true
  });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return {
    report,
    reportPath,
    snapshot,
    incidentTriggers,
    dispatch,
    workerTelemetry: posture.workerTelemetry
  };
}
