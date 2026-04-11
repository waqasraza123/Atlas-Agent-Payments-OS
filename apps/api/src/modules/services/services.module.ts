import { Module } from "@nestjs/common";
import { ActorModule } from "../actor/actor.module";
import { ServicesController } from "./services.controller";
import { ServicesService } from "./services.service";

@Module({
  imports: [ActorModule],
  controllers: [ServicesController],
  providers: [ServicesService]
})
export class ServicesModule {}
