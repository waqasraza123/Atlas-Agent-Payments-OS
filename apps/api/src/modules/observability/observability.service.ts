import type { AtlasActorContext } from "@atlas/auth";
import type { AtlasObservabilityAlertSeverity, AtlasObservabilityTelemetryRemediationAction } from "@atlas/domain";
import { buildAtlasObservabilityAlerts } from "@atlas/domain";
import {
  getObservabilityAutomationStatus,
  getOperatorOverview,
  listObservabilityAlertDispatches,
  listObservabilityAutomationRuns,
  listObservabilityIncidentTriggers,
  listObservabilitySnapshots,
  recordObservabilityTelemetryRemediationAction,
  recoverObservabilityTelemetryOwnership,
  readPublishedWorkerTelemetry
} from "@atlas/database";
import { Injectable } from "@nestjs/common";
import { createOwnedExecutionTraceContext } from "@atlas/database";
import { HealthService } from "../health/health.service";
import { createDomainSummary } from "../shared/domain-summary";
import { rethrowObservabilityOperationsError } from "../shared/workflow-error";

function readStringField(body: unknown, key: string) {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const value = body[key as keyof typeof body];

  return typeof value === "string" ? value : undefined;
}

function readBooleanField(body: unknown, key: string) {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const value = body[key as keyof typeof body];

  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

function readSeverityField(body: unknown): AtlasObservabilityAlertSeverity | undefined {
  const value = readStringField(body, "minimumSeverity");

  return value === "info" || value === "warning" || value === "critical" ? value : undefined;
}

function readRemediationAction(body: unknown): AtlasObservabilityTelemetryRemediationAction {
  const value = readStringField(body, "action");

  if (
    value === "ACKNOWLEDGED" ||
    value === "ASSIGNED" ||
    value === "REACKNOWLEDGED" ||
    value === "ESCALATED" ||
    value === "TRANSFERRED" ||
    value === "RESOLVED"
  ) {
    return value;
  }

  return "ACKNOWLEDGED";
}

@Injectable()
export class ObservabilityService {
  constructor(private readonly healthService: HealthService) {}

  getSummary(actor: AtlasActorContext) {
    return createDomainSummary("observability", actor);
  }

  async getMetrics() {
    return this.healthService.getMetrics();
  }

  async listAlerts(actor: AtlasActorContext) {
    const [overview, metrics, automation] = await Promise.all([
      getOperatorOverview(actor),
      Promise.resolve(this.healthService.getMetrics().item),
      Promise.resolve(
        getObservabilityAutomationStatus(actor, {
          limit: 12
        })
      )
    ]);
    const startup = this.healthService.getStartup();
    const workerTelemetry = readPublishedWorkerTelemetry();

    return {
      items: buildAtlasObservabilityAlerts({
        metrics,
        overview,
        configurationStatus: startup.configurationStatus,
        releaseStage: startup.releaseStage,
        workerTelemetry,
        telemetryOwnership: automation.telemetryOwnership,
        latestAutomationRun: automation.recentRuns?.[0] ?? null,
        telemetryRecoveryEscalation: automation.telemetryRecoveryEscalation
      })
    };
  }

  async getIncidentReadiness(actor: AtlasActorContext) {
    return {
      item: await this.healthService.getIncidentReadiness(actor)
    };
  }

  async listSnapshots(actor: AtlasActorContext) {
    return {
      items: await listObservabilitySnapshots(actor, {
        limit: 12
      })
    };
  }

  async listDispatches(actor: AtlasActorContext) {
    return {
      items: await listObservabilityAlertDispatches(actor, {
        limit: 12
      })
    };
  }

  async listIncidentTriggers(actor: AtlasActorContext) {
    return {
      items: await listObservabilityIncidentTriggers(actor, {
        limit: 12
      })
    };
  }

  async getAutomationStatus(actor: AtlasActorContext) {
    return {
      item: await Promise.resolve(
        getObservabilityAutomationStatus(actor, {
          limit: 12
        })
      )
    };
  }

  async listAutomationRuns(actor: AtlasActorContext) {
    return {
      items: await Promise.resolve(
        listObservabilityAutomationRuns(actor, {
          limit: 12
        })
      )
    };
  }

  async recoverTelemetryOwnership(actor: AtlasActorContext, body: unknown) {
    try {
      return {
        item: await recoverObservabilityTelemetryOwnership({
          actorUserEmail: actor.user.email,
          reason: readStringField(body, "reason") ?? "Run operator-requested telemetry remediation recovery.",
          minimumSeverity: readSeverityField(body),
          dispatchAlerts: readBooleanField(body, "dispatchAlerts"),
          triggerIncidents: readBooleanField(body, "triggerIncidents"),
          trace: createOwnedExecutionTraceContext("api")
        })
      };
    } catch (error) {
      rethrowObservabilityOperationsError(error);
    }
  }

  async recordTelemetryRemediationAction(actor: AtlasActorContext, body: unknown) {
    try {
      return {
        item: await recordObservabilityTelemetryRemediationAction(actor, {
          action: readRemediationAction(body),
          reason: readStringField(body, "reason") ?? "",
          ownerUserEmail: readStringField(body, "ownerUserEmail")
        })
      };
    } catch (error) {
      rethrowObservabilityOperationsError(error);
    }
  }

  getWorkerTelemetry() {
    return {
      item: readPublishedWorkerTelemetry()
    };
  }
}
