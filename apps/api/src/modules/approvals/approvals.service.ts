import type { AtlasActorContext } from "@atlas/auth";
import {
  AtlasBuyerWorkflowError,
  decideBuyerApproval,
  getBuyerApprovalForActor,
  getBuyerApprovalRoleGuard,
  listBuyerApprovalsForActor
} from "@atlas/database";
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
      items: await listBuyerApprovalsForActor(actor)
    };
  }

  async get(actor: AtlasActorContext, approvalId: string) {
    try {
      const item = await getBuyerApprovalForActor(actor, approvalId);

      if (!item) {
        throw new AtlasBuyerWorkflowError("The selected approval is not available in this buyer organization.", "not_found");
      }

      return {
        item
      };
    } catch (error) {
      rethrowBuyerWorkflowError(error);
    }
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
