import { Module } from "@nestjs/common";
import { ActorModule } from "../actor/actor.module";
import { OperatorControlsController } from "./operator-controls.controller";
import { OperatorControlsService } from "./operator-controls.service";

@Module({
  imports: [ActorModule],
  controllers: [OperatorControlsController],
  providers: [OperatorControlsService]
})
export class OperatorControlsModule {}
