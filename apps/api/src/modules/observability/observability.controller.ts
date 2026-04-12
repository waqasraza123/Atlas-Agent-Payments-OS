import type { AtlasActorContext } from "@atlas/auth";
import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireRoles, RequireWorkspace } from "../actor/actor.decorators";
import { ActorGuard } from "../actor/actor.guard";
import { ObservabilityService } from "./observability.service";

@Controller("observability")
@UseGuards(ActorGuard)
@RequireWorkspace("OPERATOR")
export class ObservabilityController {
  constructor(@Inject(ObservabilityService) private readonly observabilityService: ObservabilityService) {
    this.summary = this.summary.bind(this);
    this.metrics = this.metrics.bind(this);
    this.alerts = this.alerts.bind(this);
    this.incidents = this.incidents.bind(this);
  }

  @Get("summary")
  summary(@CurrentActor() actor: AtlasActorContext) {
    return this.observabilityService.getSummary(actor);
  }

  @Get("metrics")
  @RequireRoles("OWNER", "ADMIN", "OPERATOR", "FINANCE")
  metrics() {
    return this.observabilityService.getMetrics();
  }

  @Get("alerts")
  @RequireRoles("OWNER", "ADMIN", "OPERATOR")
  alerts(@CurrentActor() actor: AtlasActorContext) {
    return this.observabilityService.listAlerts(actor);
  }

  @Get("incidents")
  @RequireRoles("OWNER", "ADMIN", "OPERATOR")
  incidents(@CurrentActor() actor: AtlasActorContext) {
    return this.observabilityService.getIncidentReadiness(actor);
  }
}
