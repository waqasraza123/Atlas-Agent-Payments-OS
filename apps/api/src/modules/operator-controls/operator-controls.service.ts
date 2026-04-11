import type { AtlasActorContext } from "@atlas/auth";
import {
  AtlasOperatorWorkflowError,
  getOperatorCase,
  getOperatorOverview,
  listOperatorCases,
  listOperatorNotifications,
  performOperatorCaseAction
} from "@atlas/database";
import { Injectable } from "@nestjs/common";
import { createDomainSummary } from "../shared/domain-summary";
import { rethrowOperatorWorkflowError } from "../shared/workflow-error";

@Injectable()
export class OperatorControlsService {
  getSummary(actor: AtlasActorContext) {
    return createDomainSummary("operator-controls", actor);
  }

  async getOverview(actor: AtlasActorContext) {
    try {
      return {
        item: await getOperatorOverview(actor)
      };
    } catch (error) {
      rethrowOperatorWorkflowError(error);
    }
  }

  async listCases(actor: AtlasActorContext, filters: unknown) {
    try {
      return {
        items: await listOperatorCases(actor, filters)
      };
    } catch (error) {
      rethrowOperatorWorkflowError(error);
    }
  }

  async getCase(actor: AtlasActorContext, caseId: string) {
    try {
      const item = await getOperatorCase(actor, caseId);

      if (!item) {
        throw new AtlasOperatorWorkflowError("The selected operator case could not be found.", "not_found");
      }

      return {
        item
      };
    } catch (error) {
      rethrowOperatorWorkflowError(error);
    }
  }

  async listNotifications(actor: AtlasActorContext) {
    try {
      return {
        items: await listOperatorNotifications(actor)
      };
    } catch (error) {
      rethrowOperatorWorkflowError(error);
    }
  }

  async actOnCase(actor: AtlasActorContext, caseId: string, input: unknown) {
    try {
      return {
        item: await performOperatorCaseAction(actor, caseId, input)
      };
    } catch (error) {
      rethrowOperatorWorkflowError(error);
    }
  }
}
