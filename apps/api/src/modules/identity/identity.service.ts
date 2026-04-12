import type { AtlasActorContext } from "@atlas/auth";
import {
  executeAtlasUpstreamIdentityLifecycle,
  listExternalIdentityAssignments,
  listAtlasUpstreamIdentityLifecycleReports,
  provisionExternalIdentityAssignment,
  updateExternalIdentityAssignmentLifecycle
} from "@atlas/database";
import { Injectable } from "@nestjs/common";
import { createDomainSummary } from "../shared/domain-summary";
import { rethrowExternalIdentityAccessWorkflowError, rethrowRolloutAutomationError } from "../shared/workflow-error";

@Injectable()
export class IdentityService {
  getSummary(actor: AtlasActorContext) {
    return createDomainSummary("identity", actor);
  }

  async listExternalAssignments(actor: AtlasActorContext) {
    try {
      return {
        items: await listExternalIdentityAssignments(actor),
        upstreamReports: listAtlasUpstreamIdentityLifecycleReports(10)
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
      syncUpstream?: boolean;
    }
  ) {
    try {
      const assignment = await provisionExternalIdentityAssignment(actor, input);
      const upstream =
        input.syncUpstream
          ? executeAtlasUpstreamIdentityLifecycle({
              actor,
              assignment,
              action: "PROVISION",
              reason: input.reason
            })
          : null;

      return {
        item: assignment,
        upstream
      };
    } catch (error) {
      rethrowRolloutAutomationError(error);
      rethrowExternalIdentityAccessWorkflowError(error);
    }
  }

  async updateExternalAssignmentLifecycle(
    actor: AtlasActorContext,
    assignmentId: string,
    input: {
      action: "SUSPEND" | "REACTIVATE" | "REVOKE";
      reason: string;
      syncUpstream?: boolean;
    }
  ) {
    try {
      const result = await updateExternalIdentityAssignmentLifecycle(actor, assignmentId, input);
      const upstream =
        input.syncUpstream
          ? executeAtlasUpstreamIdentityLifecycle({
              actor,
              assignment: result.assignment,
              action: input.action,
              reason: input.reason
            })
          : null;

      return {
        ...result,
        upstream
      };
    } catch (error) {
      rethrowRolloutAutomationError(error);
      rethrowExternalIdentityAccessWorkflowError(error);
    }
  }
}
