import type { AtlasActorContext } from "@atlas/auth";
import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireRoles, RequireWorkspaces } from "../actor/actor.decorators";
import { ActorGuard } from "../actor/actor.guard";
import { ApprovalsService } from "./approvals.service";

@Controller("approvals")
@UseGuards(ActorGuard)
@RequireWorkspaces("BUYER", "OPERATOR")
export class ApprovalsController {
  constructor(@Inject(ApprovalsService) private readonly approvalsService: ApprovalsService) {
    this.summary = this.summary.bind(this);
  }

  @Get("summary")
  summary(@CurrentActor() actor: AtlasActorContext) {
    return this.approvalsService.getSummary(actor);
  }

  @Get()
  @RequireWorkspaces("BUYER")
  list(@CurrentActor() actor: AtlasActorContext) {
    return this.approvalsService.list(actor);
  }

  @Get(":approvalId")
  @RequireWorkspaces("BUYER")
  get(@CurrentActor() actor: AtlasActorContext, @Param("approvalId") approvalId: string) {
    return this.approvalsService.get(actor, approvalId);
  }

  @Post(":approvalId/decision")
  @RequireWorkspaces("BUYER")
  @RequireRoles("OWNER", "ADMIN", "REVIEWER", "FINANCE")
  decide(@CurrentActor() actor: AtlasActorContext, @Param("approvalId") approvalId: string, @Body() body: unknown) {
    return this.approvalsService.decide(actor, approvalId, body);
  }
}
