import type { AtlasActorContext } from "@atlas/auth";
import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireRoles, RequireWorkspaces, RequireWorkspace } from "../actor/actor.decorators";
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

  @Get()
  @RequireWorkspace("SELLER")
  list(@CurrentActor() actor: AtlasActorContext) {
    return this.servicesService.list(actor);
  }

  @Get(":serviceId")
  @RequireWorkspace("SELLER")
  get(@CurrentActor() actor: AtlasActorContext, @Param("serviceId") serviceId: string) {
    return this.servicesService.get(actor, serviceId);
  }

  @Post()
  @RequireWorkspace("SELLER")
  @RequireRoles("OWNER", "ADMIN")
  create(@CurrentActor() actor: AtlasActorContext, @Body() body: unknown) {
    return this.servicesService.create(actor, body);
  }

  @Patch(":serviceId")
  @RequireWorkspace("SELLER")
  @RequireRoles("OWNER", "ADMIN")
  update(@CurrentActor() actor: AtlasActorContext, @Param("serviceId") serviceId: string, @Body() body: unknown) {
    return this.servicesService.update(actor, serviceId, body);
  }
}
