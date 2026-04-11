import type { AtlasActorContext } from "@atlas/auth";
import { getSellerProfile, listSellerRequests, listSellerTeamMembers } from "@atlas/database";
import { Injectable } from "@nestjs/common";
import { createDomainSummary } from "../shared/domain-summary";

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

  async requests(actor: AtlasActorContext) {
    return {
      items: await listSellerRequests(actor.organization.id)
    };
  }
}
