import { Module } from "@nestjs/common";
import { ActorModule } from "../actor/actor.module";
import { IdentityController } from "./identity.controller";
import { IdentityService } from "./identity.service";

@Module({
  imports: [ActorModule],
  controllers: [IdentityController],
  providers: [IdentityService]
})
export class IdentityModule {}
