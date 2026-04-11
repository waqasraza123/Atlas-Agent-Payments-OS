import type { AtlasActorContext } from "@atlas/auth";
import {
  getSellerAnalytics,
  getSellerProfile,
  listSellerRequests,
  listSellerTeamMembers,
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
      item: await getSellerProfile(actor.organization.id)
    };
  }

  async team(actor: AtlasActorContext) {
    return {
      items: await listSellerTeamMembers(actor.organization.id)
    };
  }

  async analytics(actor: AtlasActorContext) {
    return {
      item: await getSellerAnalytics(actor.organization.id)
    };
  }

  async requests(actor: AtlasActorContext) {
    return {
      items: await listSellerRequests(actor.organization.id)
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
