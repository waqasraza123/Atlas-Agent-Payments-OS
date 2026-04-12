import type { AtlasActorContext } from "@atlas/auth";
import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireRoles, RequireWorkspace } from "../actor/actor.decorators";
import { ActorGuard } from "../actor/actor.guard";
import { RolloutService } from "./rollout.service";

@Controller("rollout")
@UseGuards(ActorGuard)
@RequireWorkspace("OPERATOR")
export class RolloutController {
  constructor(@Inject(RolloutService) private readonly rolloutService: RolloutService) {
    this.summary = this.summary.bind(this);
    this.integrations = this.integrations.bind(this);
    this.executions = this.executions.bind(this);
  }

  @Get("summary")
  @RequireRoles("OWNER", "ADMIN", "OPERATOR")
  summary(@CurrentActor() actor: AtlasActorContext) {
    return this.rolloutService.getSummary(actor);
  }

  @Get("integrations")
  @RequireRoles("OWNER", "ADMIN")
  integrations(@CurrentActor() actor: AtlasActorContext) {
    return this.rolloutService.listIntegrations(actor);
  }

  @Get("executions")
  @RequireRoles("OWNER", "ADMIN", "OPERATOR")
  executions(@CurrentActor() actor: AtlasActorContext) {
    return this.rolloutService.listExecutions(actor);
  }
}
