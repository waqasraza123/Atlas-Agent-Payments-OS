import type { AtlasActorContext } from "@atlas/auth";
import { Injectable } from "@nestjs/common";
import { createDomainSummary } from "../shared/domain-summary";

@Injectable()
export class ApprovalsService {
  getSummary(actor: AtlasActorContext) {
    return createDomainSummary("approvals", actor);
  }
}
