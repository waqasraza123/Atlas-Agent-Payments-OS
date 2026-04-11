import type { AtlasActorContext } from "@atlas/auth";
import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireRoles, RequireWorkspaces } from "../actor/actor.decorators";
import { ActorGuard } from "../actor/actor.guard";
import { RequestsService } from "./requests.service";

@Controller("requests")
@UseGuards(ActorGuard)
@RequireWorkspaces("BUYER", "SELLER", "OPERATOR")
export class RequestsController {
  constructor(@Inject(RequestsService) private readonly requestsService: RequestsService) {
    this.summary = this.summary.bind(this);
  }

  @Get("summary")
  summary(@CurrentActor() actor: AtlasActorContext) {
    return this.requestsService.getSummary(actor);
  }

  @Get()
  @RequireWorkspaces("BUYER")
  list(@CurrentActor() actor: AtlasActorContext) {
    return this.requestsService.list(actor);
  }

  @Post()
  @RequireWorkspaces("BUYER")
  @RequireRoles("OWNER", "ADMIN", "REVIEWER", "FINANCE")
  create(@CurrentActor() actor: AtlasActorContext, @Body() body: unknown) {
    return this.requestsService.create(actor, body);
  }
}
