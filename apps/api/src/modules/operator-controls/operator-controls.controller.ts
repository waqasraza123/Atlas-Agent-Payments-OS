import type { AtlasActorContext } from "@atlas/auth";
import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireWorkspace } from "../actor/actor.decorators";
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
}
