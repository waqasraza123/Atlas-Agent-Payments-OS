import type { AtlasActorContext } from "@atlas/auth";
import { createBuyerPolicy, listBuyerPoliciesForActor, updateBuyerPolicy } from "@atlas/database";
import { Injectable } from "@nestjs/common";
import { createDomainSummary } from "../shared/domain-summary";
import { rethrowBuyerWorkflowError } from "../shared/workflow-error";

@Injectable()
export class PoliciesService {
  getSummary(actor: AtlasActorContext) {
    return createDomainSummary("policies", actor);
  }

  async list(actor: AtlasActorContext) {
    return {
      items: await listBuyerPoliciesForActor(actor)
    };
  }

  async create(actor: AtlasActorContext, input: unknown) {
    try {
      return {
        item: await createBuyerPolicy(actor, input)
      };
    } catch (error) {
      rethrowBuyerWorkflowError(error);
    }
  }

  async update(actor: AtlasActorContext, policyId: string, input: unknown) {
    try {
      return {
        item: await updateBuyerPolicy(actor, policyId, input)
      };
    } catch (error) {
      rethrowBuyerWorkflowError(error);
    }
  }
}
