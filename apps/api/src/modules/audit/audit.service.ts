import type { AtlasActorContext } from "@atlas/auth";
import {
  AtlasBuyerWorkflowError,
  getBuyerAuditEventForActor,
  getOperatorAuditEvent,
  listOperatorAuditEvents
} from "@atlas/database";
import { Injectable } from "@nestjs/common";
import { createDomainSummary } from "../shared/domain-summary";
import { rethrowBuyerWorkflowError, rethrowOperatorWorkflowError } from "../shared/workflow-error";

@Injectable()
export class AuditService {
  getSummary(actor: AtlasActorContext) {
    return createDomainSummary("audit", actor);
  }

  async listEvents(actor: AtlasActorContext, filters: unknown) {
    try {
      return {
        items: await listOperatorAuditEvents(actor, filters)
      };
    } catch (error) {
      rethrowOperatorWorkflowError(error);
    }
  }

  async getEvent(actor: AtlasActorContext, eventId: string) {
    if (actor.workspace === "BUYER") {
      try {
        const item = await getBuyerAuditEventForActor(actor, eventId);

        if (!item) {
          throw new AtlasBuyerWorkflowError("The selected audit event is not available in this buyer organization.", "not_found");
        }

        return {
          item
        };
      } catch (error) {
        rethrowBuyerWorkflowError(error);
      }
    }

    try {
      const item = await getOperatorAuditEvent(actor, eventId);

      if (!item) {
        throw new Error("The selected audit event is not available.");
      }

      return {
        item
      };
    } catch (error) {
      rethrowOperatorWorkflowError(error);
    }
  }
}
