import type { AtlasActorContext } from "@atlas/auth";
import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireWorkspace } from "../actor/actor.decorators";
import { ActorGuard } from "../actor/actor.guard";
import { AgentsService } from "./agents.service";

@Controller("agents")
@UseGuards(ActorGuard)
@RequireWorkspace("BUYER")
export class AgentsController {
  constructor(@Inject(AgentsService) private readonly agentsService: AgentsService) {
    this.summary = this.summary.bind(this);
  }

  @Get("summary")
  summary(@CurrentActor() actor: AtlasActorContext) {
    return this.agentsService.getSummary(actor);
  }
}
