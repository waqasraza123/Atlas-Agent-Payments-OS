import { Module } from "@nestjs/common";
import { ActorModule } from "../actor/actor.module";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";

@Module({
  imports: [ActorModule],
  controllers: [AuditController],
  providers: [AuditService]
})
export class AuditModule {}
