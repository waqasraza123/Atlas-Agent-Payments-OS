import type { AtlasActorContext } from "@atlas/auth";
import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireRoles, RequireWorkspace } from "../actor/actor.decorators";
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

  @Get()
  list(@CurrentActor() actor: AtlasActorContext) {
    return this.policiesService.list(actor);
  }

  @Post()
  @RequireRoles("OWNER", "ADMIN")
  create(@CurrentActor() actor: AtlasActorContext, @Body() body: unknown) {
    return this.policiesService.create(actor, body);
  }

  @Patch(":policyId")
  @RequireRoles("OWNER", "ADMIN")
  update(@CurrentActor() actor: AtlasActorContext, @Param("policyId") policyId: string, @Body() body: unknown) {
    return this.policiesService.update(actor, policyId, body);
  }
}
