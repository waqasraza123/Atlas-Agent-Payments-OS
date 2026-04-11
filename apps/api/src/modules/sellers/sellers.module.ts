import { Module } from "@nestjs/common";
import { ActorModule } from "../actor/actor.module";
import { SellersController } from "./sellers.controller";
import { SellersService } from "./sellers.service";

@Module({
  imports: [ActorModule],
  controllers: [SellersController],
  providers: [SellersService]
})
export class SellersModule {}
