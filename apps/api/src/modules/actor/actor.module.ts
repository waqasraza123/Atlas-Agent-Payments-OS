import { Module } from "@nestjs/common";
import { ActorController } from "./actor.controller";
import { ActorGuard } from "./actor.guard";

@Module({
  controllers: [ActorController],
  providers: [ActorGuard],
  exports: [ActorGuard]
})
export class ActorModule {}
