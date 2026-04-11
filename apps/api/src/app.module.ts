import { Module } from "@nestjs/common";
import { ActorModule } from "./modules/actor/actor.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [HealthModule, ActorModule]
})
export class AppModule {}
