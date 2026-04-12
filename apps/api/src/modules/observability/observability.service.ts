import type { AtlasActorContext } from "@atlas/auth";
import { buildAtlasObservabilityAlerts } from "@atlas/domain";
import { getOperatorOverview } from "@atlas/database";
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

    return {
      items: buildAtlasObservabilityAlerts({
        metrics,
        overview,
        configurationStatus: startup.configurationStatus,
        releaseStage: startup.releaseStage
      })
    };
  }

  async getIncidentReadiness(actor: AtlasActorContext) {
    return {
      item: await this.healthService.getIncidentReadiness(actor)
    };
  }
}
