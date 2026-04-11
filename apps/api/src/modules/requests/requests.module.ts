import { Module } from "@nestjs/common";
import { ActorModule } from "../actor/actor.module";
import { RequestsController } from "./requests.controller";
import { RequestsService } from "./requests.service";

@Module({
  imports: [ActorModule],
  controllers: [RequestsController],
  providers: [RequestsService]
})
export class RequestsModule {}
