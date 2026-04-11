import type { AtlasActorContext } from "@atlas/auth";
import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireWorkspaces } from "../actor/actor.decorators";
import { ActorGuard } from "../actor/actor.guard";
import { ServicesService } from "./services.service";

@Controller("services")
@UseGuards(ActorGuard)
@RequireWorkspaces("SELLER", "BUYER")
export class ServicesController {
  constructor(@Inject(ServicesService) private readonly servicesService: ServicesService) {
    this.summary = this.summary.bind(this);
  }

  @Get("summary")
  summary(@CurrentActor() actor: AtlasActorContext) {
    return this.servicesService.getSummary(actor);
  }
}
