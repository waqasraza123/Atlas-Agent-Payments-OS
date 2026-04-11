import { Module } from "@nestjs/common";
import { ActorController } from "./actor.controller";
import { ActorGuard } from "./actor.guard";
import { ActorResolutionService } from "./actor.service";

@Module({
  controllers: [ActorController],
  providers: [ActorGuard, ActorResolutionService],
  exports: [ActorGuard, ActorResolutionService]
})
export class ActorModule {}
