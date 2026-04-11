import type { AtlasActorContext } from "@atlas/auth";
import { decideBuyerApproval, getBuyerApprovalRoleGuard, listBuyerApprovals } from "@atlas/database";
import { Injectable } from "@nestjs/common";
import { createDomainSummary } from "../shared/domain-summary";
import { rethrowBuyerWorkflowError } from "../shared/workflow-error";

@Injectable()
export class ApprovalsService {
  getSummary(actor: AtlasActorContext) {
    return createDomainSummary("approvals", actor);
  }

  async list(actor: AtlasActorContext) {
    return {
      items: await listBuyerApprovals(actor.organization.id)
    };
  }

  async decide(actor: AtlasActorContext, approvalId: string, input: unknown) {
    try {
      await getBuyerApprovalRoleGuard(actor);

      return {
        item: await decideBuyerApproval(actor, approvalId, input)
      };
    } catch (error) {
      rethrowBuyerWorkflowError(error);
    }
  }
}
