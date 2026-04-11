import type { AtlasActorContext } from "@atlas/auth";
import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireRoles, RequireWorkspaces, RequireWorkspace } from "../actor/actor.decorators";
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

  @Get("analytics")
  @RequireWorkspace("SELLER")
  analytics(@CurrentActor() actor: AtlasActorContext) {
    return this.sellersService.analytics(actor);
  }

  @Get("requests")
  @RequireWorkspace("SELLER")
  requests(@CurrentActor() actor: AtlasActorContext) {
    return this.sellersService.requests(actor);
  }

  @Post("requests/:requestId/fulfillment")
  @RequireWorkspace("SELLER")
  @RequireRoles("OWNER", "ADMIN", "OPERATOR")
  recordRequestFulfillment(
    @CurrentActor() actor: AtlasActorContext,
    @Param("requestId") requestId: string,
    @Body() body: unknown
  ) {
    return this.sellersService.recordRequestFulfillment(actor, requestId, body);
  }
}
