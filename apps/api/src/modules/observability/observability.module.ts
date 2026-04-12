import { Module } from "@nestjs/common";
import { ActorModule } from "../actor/actor.module";
import { HealthModule } from "../health/health.module";
import { ObservabilityController } from "./observability.controller";
import { ObservabilityService } from "./observability.service";

@Module({
  imports: [ActorModule, HealthModule],
  controllers: [ObservabilityController],
  providers: [ObservabilityService]
})
export class ObservabilityModule {}
