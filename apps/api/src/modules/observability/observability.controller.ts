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
    this.worker = this.worker.bind(this);
    this.snapshots = this.snapshots.bind(this);
    this.dispatches = this.dispatches.bind(this);
    this.automation = this.automation.bind(this);
    this.automationRuns = this.automationRuns.bind(this);
    this.incidentTriggers = this.incidentTriggers.bind(this);
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

  @Get("worker")
  @RequireRoles("OWNER", "ADMIN", "OPERATOR", "FINANCE")
  worker() {
    return this.observabilityService.getWorkerTelemetry();
  }

  @Get("snapshots")
  @RequireRoles("OWNER", "ADMIN", "OPERATOR", "FINANCE")
  snapshots(@CurrentActor() actor: AtlasActorContext) {
    return this.observabilityService.listSnapshots(actor);
  }

  @Get("dispatches")
  @RequireRoles("OWNER", "ADMIN", "OPERATOR")
  dispatches(@CurrentActor() actor: AtlasActorContext) {
    return this.observabilityService.listDispatches(actor);
  }

  @Get("automation")
  @RequireRoles("OWNER", "ADMIN", "OPERATOR")
  automation(@CurrentActor() actor: AtlasActorContext) {
    return this.observabilityService.getAutomationStatus(actor);
  }

  @Get("automation-runs")
  @RequireRoles("OWNER", "ADMIN", "OPERATOR")
  automationRuns(@CurrentActor() actor: AtlasActorContext) {
    return this.observabilityService.listAutomationRuns(actor);
  }

  @Get("incident-triggers")
  @RequireRoles("OWNER", "ADMIN", "OPERATOR")
  incidentTriggers(@CurrentActor() actor: AtlasActorContext) {
    return this.observabilityService.listIncidentTriggers(actor);
  }
}
