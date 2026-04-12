import type { AtlasActorContext } from "@atlas/auth";
import {
  listAtlasPromotionExecutionReports,
  listAtlasRestoreDrillReports,
  listAtlasRolloutAutomationSummary,
  listAtlasSecretRotationExecutionReports,
  listAtlasUpstreamIdentityLifecycleReports,
  listOperationalIntegrations
} from "@atlas/database";
import { Injectable } from "@nestjs/common";
import { createDomainSummary } from "../shared/domain-summary";
import { rethrowOperationalIntegrationWorkflowError } from "../shared/workflow-error";

@Injectable()
export class RolloutService {
  getSummary(actor: AtlasActorContext) {
    return {
      ...createDomainSummary("rollout", actor),
      automation: listAtlasRolloutAutomationSummary(),
      reports: {
        restoreDrills: listAtlasRestoreDrillReports(5),
        secretRotations: listAtlasSecretRotationExecutionReports(5),
        promotions: listAtlasPromotionExecutionReports(5),
        upstreamIdentity: listAtlasUpstreamIdentityLifecycleReports(5)
      }
    };
  }

  async listIntegrations(actor: AtlasActorContext) {
    try {
      return {
        items: await listOperationalIntegrations(actor)
      };
    } catch (error) {
      rethrowOperationalIntegrationWorkflowError(error);
    }
  }
}
