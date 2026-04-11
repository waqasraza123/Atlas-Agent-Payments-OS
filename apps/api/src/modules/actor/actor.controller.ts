import type { AtlasActorContext } from "@atlas/auth";
import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireRoles, RequireWorkspace } from "./actor.decorators";
import { ActorGuard } from "./actor.guard";

@Controller("actor")
@UseGuards(ActorGuard)
export class ActorController {
  @Get("context")
  context(@CurrentActor() actor: AtlasActorContext) {
    return actor;
  }

  @Get("buyer")
  @RequireWorkspace("BUYER")
  buyer(@CurrentActor() actor: AtlasActorContext) {
    return {
      workspace: "BUYER",
      actor
    };
  }

  @Get("operator")
  @RequireWorkspace("OPERATOR")
  @RequireRoles("OWNER", "ADMIN", "OPERATOR")
  operator(@CurrentActor() actor: AtlasActorContext) {
    return {
      workspace: "OPERATOR",
      actor
    };
  }
}
