import { Module } from "@nestjs/common";
import { ActorModule } from "../actor/actor.module";
import { PoliciesController } from "./policies.controller";
import { PoliciesService } from "./policies.service";

@Module({
  imports: [ActorModule],
  controllers: [PoliciesController],
  providers: [PoliciesService]
})
export class PoliciesModule {}
