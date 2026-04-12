import { Controller, Get } from "@nestjs/common";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  private readonly healthService = new HealthService();

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
}
