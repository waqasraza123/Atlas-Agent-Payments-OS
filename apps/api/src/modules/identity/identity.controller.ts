import type { AtlasActorContext } from "@atlas/auth";
import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { ActorGuard } from "../actor/actor.guard";
import { CurrentActor } from "../actor/actor.decorators";
import { IdentityService } from "./identity.service";

@Controller("identity")
@UseGuards(ActorGuard)
export class IdentityController {
  constructor(@Inject(IdentityService) private readonly identityService: IdentityService) {
    this.session = this.session.bind(this);
    this.listExternalAssignments = this.listExternalAssignments.bind(this);
    this.provisionExternalAssignment = this.provisionExternalAssignment.bind(this);
    this.updateExternalAssignmentLifecycle = this.updateExternalAssignmentLifecycle.bind(this);
  }

  @Get("session")
  session(@CurrentActor() actor: AtlasActorContext) {
    return this.identityService.getSummary(actor);
  }

  @Get("external-assignments")
  listExternalAssignments(@CurrentActor() actor: AtlasActorContext) {
    return this.identityService.listExternalAssignments(actor);
  }

  @Post("external-assignments")
  provisionExternalAssignment(
    @CurrentActor() actor: AtlasActorContext,
    @Body()
    body: {
      provider: string;
      externalEmail: string;
      targetOrganizationSlug: string;
      targetRole: "OWNER" | "ADMIN" | "OPERATOR" | "REVIEWER" | "FINANCE";
      userName?: string | null;
      reason: string;
    }
  ) {
    return this.identityService.provisionExternalAssignment(actor, body);
  }

  @Post("external-assignments/:assignmentId/lifecycle")
  updateExternalAssignmentLifecycle(
    @CurrentActor() actor: AtlasActorContext,
    @Param("assignmentId") assignmentId: string,
    @Body()
    body: {
      action: "SUSPEND" | "REACTIVATE" | "REVOKE";
      reason: string;
    }
  ) {
    return this.identityService.updateExternalAssignmentLifecycle(actor, assignmentId, body);
  }
}
