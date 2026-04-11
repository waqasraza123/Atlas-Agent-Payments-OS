import type { AtlasActorContext } from "@atlas/auth";
import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireWorkspaces } from "../actor/actor.decorators";
import { ActorGuard } from "../actor/actor.guard";
import { SellersService } from "./sellers.service";

@Controller("sellers")
@UseGuards(ActorGuard)
@RequireWorkspaces("BUYER", "OPERATOR")
export class SellersController {
  constructor(@Inject(SellersService) private readonly sellersService: SellersService) {
    this.summary = this.summary.bind(this);
  }

  @Get("summary")
  summary(@CurrentActor() actor: AtlasActorContext) {
    return this.sellersService.getSummary(actor);
  }
}
