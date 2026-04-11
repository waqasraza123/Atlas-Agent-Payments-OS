import type { AtlasActorContext } from "@atlas/auth";
import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireRoles, RequireWorkspace } from "../actor/actor.decorators";
import { ActorGuard } from "../actor/actor.guard";
import { OperatorControlsService } from "./operator-controls.service";

@Controller("operator-controls")
@UseGuards(ActorGuard)
@RequireWorkspace("OPERATOR")
export class OperatorControlsController {
  constructor(
    @Inject(OperatorControlsService) private readonly operatorControlsService: OperatorControlsService
  ) {
    this.summary = this.summary.bind(this);
  }

  @Get("summary")
  summary(@CurrentActor() actor: AtlasActorContext) {
    return this.operatorControlsService.getSummary(actor);
  }

  @Get("overview")
  overview(@CurrentActor() actor: AtlasActorContext) {
    return this.operatorControlsService.getOverview(actor);
  }

  @Get("cases")
  listCases(@CurrentActor() actor: AtlasActorContext, @Query() query: Record<string, string | string[] | undefined>) {
    return this.operatorControlsService.listCases(actor, query);
  }

  @Get("cases/:caseId")
  getCase(@CurrentActor() actor: AtlasActorContext, @Param("caseId") caseId: string) {
    return this.operatorControlsService.getCase(actor, caseId);
  }

  @Post("cases/:caseId/actions")
  @RequireRoles("OWNER", "ADMIN", "OPERATOR")
  actOnCase(
    @CurrentActor() actor: AtlasActorContext,
    @Param("caseId") caseId: string,
    @Body() body: unknown
  ) {
    return this.operatorControlsService.actOnCase(actor, caseId, body);
  }

  @Get("notifications")
  listNotifications(@CurrentActor() actor: AtlasActorContext) {
    return this.operatorControlsService.listNotifications(actor);
  }
}
