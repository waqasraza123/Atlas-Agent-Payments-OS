import { Module } from "@nestjs/common";
import { ActorModule } from "../actor/actor.module";
import { AgentsController } from "./agents.controller";
import { AgentsService } from "./agents.service";

@Module({
  imports: [ActorModule],
  controllers: [AgentsController],
  providers: [AgentsService]
})
export class AgentsModule {}
