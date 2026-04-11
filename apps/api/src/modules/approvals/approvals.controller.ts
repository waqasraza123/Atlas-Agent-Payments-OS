import type { AtlasActorContext } from "@atlas/auth";
import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireWorkspaces } from "../actor/actor.decorators";
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
}
