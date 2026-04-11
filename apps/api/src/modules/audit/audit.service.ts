import type { AtlasActorContext } from "@atlas/auth";
import { listOperatorAuditEvents } from "@atlas/database";
import { Injectable } from "@nestjs/common";
import { createDomainSummary } from "../shared/domain-summary";
import { rethrowOperatorWorkflowError } from "../shared/workflow-error";

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
}
