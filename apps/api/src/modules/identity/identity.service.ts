import type { AtlasActorContext } from "@atlas/auth";
import {
  listExternalIdentityAssignments,
  provisionExternalIdentityAssignment,
  updateExternalIdentityAssignmentLifecycle
} from "@atlas/database";
import { Injectable } from "@nestjs/common";
import { createDomainSummary } from "../shared/domain-summary";
import { rethrowExternalIdentityAccessWorkflowError } from "../shared/workflow-error";

@Injectable()
export class IdentityService {
  getSummary(actor: AtlasActorContext) {
    return createDomainSummary("identity", actor);
  }

  async listExternalAssignments(actor: AtlasActorContext) {
    try {
      return {
        items: await listExternalIdentityAssignments(actor)
      };
    } catch (error) {
      rethrowExternalIdentityAccessWorkflowError(error);
    }
  }

  async provisionExternalAssignment(
    actor: AtlasActorContext,
    input: {
      provider: string;
      externalEmail: string;
      targetOrganizationSlug: string;
      targetRole: "OWNER" | "ADMIN" | "OPERATOR" | "REVIEWER" | "FINANCE";
      userName?: string | null;
      reason: string;
    }
  ) {
    try {
      return {
        item: await provisionExternalIdentityAssignment(actor, input)
      };
    } catch (error) {
      rethrowExternalIdentityAccessWorkflowError(error);
    }
  }

  async updateExternalAssignmentLifecycle(
    actor: AtlasActorContext,
    assignmentId: string,
    input: {
      action: "SUSPEND" | "REACTIVATE" | "REVOKE";
      reason: string;
    }
  ) {
    try {
      return await updateExternalIdentityAssignmentLifecycle(actor, assignmentId, input);
    } catch (error) {
      rethrowExternalIdentityAccessWorkflowError(error);
    }
  }
}
