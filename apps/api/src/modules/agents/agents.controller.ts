import type { AtlasActorContext } from "@atlas/auth";
import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireRoles, RequireWorkspace } from "../actor/actor.decorators";
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

  @Get()
  list(@CurrentActor() actor: AtlasActorContext) {
    return this.agentsService.list(actor);
  }

  @Post()
  @RequireRoles("OWNER", "ADMIN")
  create(@CurrentActor() actor: AtlasActorContext, @Body() body: unknown) {
    return this.agentsService.create(actor, body);
  }

  @Patch(":agentId")
  @RequireRoles("OWNER", "ADMIN")
  update(@CurrentActor() actor: AtlasActorContext, @Param("agentId") agentId: string, @Body() body: unknown) {
    return this.agentsService.update(actor, agentId, body);
  }
}
