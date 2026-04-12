import type { AtlasActorContext } from "@atlas/auth";
import {
  getOperationalExecutionSummary,
  listAtlasPromotionExecutionReports,
  listAtlasRestoreDrillReports,
  listAtlasRolloutAutomationSummary,
  listAtlasSecretRotationExecutionReports,
  listAtlasUpstreamIdentityLifecycleReports,
  listOperationalExecutions,
  listOperationalIntegrations
} from "@atlas/database";
import { Injectable } from "@nestjs/common";
import { createDomainSummary } from "../shared/domain-summary";
import {
  rethrowOperationalIntegrationWorkflowError,
  rethrowRolloutExecutionWorkflowError
} from "../shared/workflow-error";

@Injectable()
export class RolloutService {
  async getSummary(actor: AtlasActorContext) {
    return {
      ...createDomainSummary("rollout", actor),
      automation: listAtlasRolloutAutomationSummary(),
      executionSummary: await getOperationalExecutionSummary(actor),
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

  async listExecutions(actor: AtlasActorContext) {
    try {
      return {
        items: await listOperationalExecutions(actor, {
          limit: 20
        })
      };
    } catch (error) {
      rethrowRolloutExecutionWorkflowError(error);
    }
  }
}
