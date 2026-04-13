import type { AtlasActorContext } from "@atlas/auth";
import { buildAtlasObservabilityAlerts } from "@atlas/domain";
import {
  getObservabilityAutomationStatus,
  getOperatorOverview,
  listObservabilityAlertDispatches,
  listObservabilityAutomationRuns,
  listObservabilityIncidentTriggers,
  listObservabilitySnapshots,
  readPublishedWorkerTelemetry
} from "@atlas/database";
import { Injectable } from "@nestjs/common";
import { HealthService } from "../health/health.service";
import { createDomainSummary } from "../shared/domain-summary";

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
    const [overview, metrics] = await Promise.all([
      getOperatorOverview(actor),
      Promise.resolve(this.healthService.getMetrics().item)
    ]);
    const startup = this.healthService.getStartup();
    const workerTelemetry = readPublishedWorkerTelemetry();

    return {
      items: buildAtlasObservabilityAlerts({
        metrics,
        overview,
        configurationStatus: startup.configurationStatus,
        releaseStage: startup.releaseStage,
        workerTelemetry
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

  getWorkerTelemetry() {
    return {
      item: readPublishedWorkerTelemetry()
    };
  }
}
