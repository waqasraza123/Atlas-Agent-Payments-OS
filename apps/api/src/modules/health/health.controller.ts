import { Controller, Get, Inject } from "@nestjs/common";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {
    this.health = this.health.bind(this);
    this.live = this.live.bind(this);
    this.startup = this.startup.bind(this);
    this.ready = this.ready.bind(this);
    this.metrics = this.metrics.bind(this);
  }

  @Get()
  async health() {
    return this.healthService.getSummary();
  }

  @Get("live")
  live() {
    return this.healthService.getLiveness();
  }

  @Get("startup")
  startup() {
    return this.healthService.getStartup();
  }

  @Get("ready")
  async ready() {
    return this.healthService.getReadiness();
  }

  @Get("metrics")
  metrics() {
    return this.healthService.getMetrics();
  }
}
