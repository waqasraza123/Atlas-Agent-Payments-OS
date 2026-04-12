import { Module } from "@nestjs/common";
import { ActorModule } from "../actor/actor.module";
import { ProgrammableSettlementController } from "./programmable-settlement.controller";
import { ProgrammableSettlementService } from "./programmable-settlement.service";

@Module({
  imports: [ActorModule],
  controllers: [ProgrammableSettlementController],
  providers: [ProgrammableSettlementService]
})
export class ProgrammableSettlementModule {}
