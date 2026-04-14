import type { AtlasActorContext } from "@atlas/auth";
import {
  getSellerAnalytics,
  getSellerProfileForActor,
  listSellerRequestsForActor,
  listSellerTeamMembersForActor,
  recordSellerRequestFulfillment
} from "@atlas/database";
import { Injectable } from "@nestjs/common";
import { createDomainSummary } from "../shared/domain-summary";
import { rethrowSellerWorkflowError } from "../shared/workflow-error";

@Injectable()
export class SellersService {
  getSummary(actor: AtlasActorContext) {
    return createDomainSummary("sellers", actor);
  }

  async profile(actor: AtlasActorContext) {
    return {
      item: await getSellerProfileForActor(actor)
    };
  }

  async team(actor: AtlasActorContext) {
    return {
      items: await listSellerTeamMembersForActor(actor)
    };
  }

  async analytics(actor: AtlasActorContext) {
    return {
      item: await getSellerAnalytics(actor.organization.id)
    };
  }

  async requests(actor: AtlasActorContext) {
    return {
      items: await listSellerRequestsForActor(actor)
    };
  }

  async recordRequestFulfillment(actor: AtlasActorContext, requestId: string, input: unknown) {
    try {
      return {
        item: await recordSellerRequestFulfillment(actor, requestId, input)
      };
    } catch (error) {
      rethrowSellerWorkflowError(error);
    }
  }
}
