import type { AtlasActorContext } from "@atlas/auth";
import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { ActorGuard } from "../actor/actor.guard";
import { CurrentActor } from "../actor/actor.decorators";
import { IdentityService } from "./identity.service";

@Controller("identity")
@UseGuards(ActorGuard)
export class IdentityController {
  constructor(@Inject(IdentityService) private readonly identityService: IdentityService) {
    this.session = this.session.bind(this);
  }

  @Get("session")
  session(@CurrentActor() actor: AtlasActorContext) {
    return this.identityService.getSummary(actor);
  }
}
