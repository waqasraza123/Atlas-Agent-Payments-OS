import type { AtlasActorContext } from "@atlas/auth";
import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireWorkspaces } from "../actor/actor.decorators";
import { ActorGuard } from "../actor/actor.guard";
import { AuditService } from "./audit.service";

@Controller("audit")
@UseGuards(ActorGuard)
@RequireWorkspaces("BUYER", "OPERATOR")
export class AuditController {
  constructor(@Inject(AuditService) private readonly auditService: AuditService) {
    this.summary = this.summary.bind(this);
  }

  @Get("summary")
  summary(@CurrentActor() actor: AtlasActorContext) {
    return this.auditService.getSummary(actor);
  }

  @Get("events")
  listEvents(@CurrentActor() actor: AtlasActorContext, @Query() query: Record<string, string | string[] | undefined>) {
    return this.auditService.listEvents(actor, query);
  }
}
