import type { AtlasActorContext } from "@atlas/auth";
import { createBuyerAgent, listBuyerAgentsForActor, updateBuyerAgent } from "@atlas/database";
import { Injectable } from "@nestjs/common";
import { createDomainSummary } from "../shared/domain-summary";
import { rethrowBuyerWorkflowError } from "../shared/workflow-error";

@Injectable()
export class AgentsService {
  getSummary(actor: AtlasActorContext) {
    return createDomainSummary("agents", actor);
  }

  async list(actor: AtlasActorContext) {
    return {
      items: await listBuyerAgentsForActor(actor)
    };
  }

  async create(actor: AtlasActorContext, input: unknown) {
    try {
      return {
        item: await createBuyerAgent(actor, input)
      };
    } catch (error) {
      rethrowBuyerWorkflowError(error);
    }
  }

  async update(actor: AtlasActorContext, agentId: string, input: unknown) {
    try {
      return {
        item: await updateBuyerAgent(actor, agentId, input)
      };
    } catch (error) {
      rethrowBuyerWorkflowError(error);
    }
  }
}
