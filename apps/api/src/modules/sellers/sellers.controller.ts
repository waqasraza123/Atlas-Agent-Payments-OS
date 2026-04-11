import type { AtlasActorContext } from "@atlas/auth";
import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireWorkspaces, RequireWorkspace } from "../actor/actor.decorators";
import { ActorGuard } from "../actor/actor.guard";
import { SellersService } from "./sellers.service";

@Controller("sellers")
@UseGuards(ActorGuard)
@RequireWorkspaces("BUYER", "OPERATOR", "SELLER")
export class SellersController {
  constructor(@Inject(SellersService) private readonly sellersService: SellersService) {
    this.summary = this.summary.bind(this);
  }

  @Get("summary")
  summary(@CurrentActor() actor: AtlasActorContext) {
    return this.sellersService.getSummary(actor);
  }

  @Get("profile")
  @RequireWorkspace("SELLER")
  profile(@CurrentActor() actor: AtlasActorContext) {
    return this.sellersService.profile(actor);
  }

  @Get("team")
  @RequireWorkspace("SELLER")
  team(@CurrentActor() actor: AtlasActorContext) {
    return this.sellersService.team(actor);
  }

  @Get("requests")
  @RequireWorkspace("SELLER")
  requests(@CurrentActor() actor: AtlasActorContext) {
    return this.sellersService.requests(actor);
  }
}
