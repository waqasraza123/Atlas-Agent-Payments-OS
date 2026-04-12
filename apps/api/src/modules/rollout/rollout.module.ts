import { Module } from "@nestjs/common";
import { ActorModule } from "../actor/actor.module";
import { RolloutController } from "./rollout.controller";
import { RolloutService } from "./rollout.service";

@Module({
  imports: [ActorModule],
  controllers: [RolloutController],
  providers: [RolloutService]
})
export class RolloutModule {}
