import type { AtlasActorContext } from "@atlas/auth";
import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireWorkspace } from "../actor/actor.decorators";
import { ActorGuard } from "../actor/actor.guard";
import { PoliciesService } from "./policies.service";

@Controller("policies")
@UseGuards(ActorGuard)
@RequireWorkspace("BUYER")
export class PoliciesController {
  constructor(@Inject(PoliciesService) private readonly policiesService: PoliciesService) {
    this.summary = this.summary.bind(this);
  }

  @Get("summary")
  summary(@CurrentActor() actor: AtlasActorContext) {
    return this.policiesService.getSummary(actor);
  }
}
