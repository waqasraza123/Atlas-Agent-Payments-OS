import type { AtlasActorContext } from "@atlas/auth";
import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireWorkspaces } from "../actor/actor.decorators";
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
}
