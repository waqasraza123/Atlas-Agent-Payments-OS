import type { AtlasActorContext } from "@atlas/auth";
import { createBuyerRequest, listBuyerRequestsForActor } from "@atlas/database";
import { Injectable } from "@nestjs/common";
import { createDomainSummary } from "../shared/domain-summary";
import { rethrowBuyerWorkflowError } from "../shared/workflow-error";

@Injectable()
export class RequestsService {
  getSummary(actor: AtlasActorContext) {
    return createDomainSummary("requests", actor);
  }

  async list(actor: AtlasActorContext) {
    return {
      items: await listBuyerRequestsForActor(actor)
    };
  }

  async create(actor: AtlasActorContext, input: unknown) {
    try {
      return {
        item: await createBuyerRequest(actor, input)
      };
    } catch (error) {
      rethrowBuyerWorkflowError(error);
    }
  }
}
