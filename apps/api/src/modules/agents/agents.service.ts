import type { AtlasActorContext } from "@atlas/auth";
import { Injectable } from "@nestjs/common";
import { createDomainSummary } from "../shared/domain-summary";

@Injectable()
export class AgentsService {
  getSummary(actor: AtlasActorContext) {
    return createDomainSummary("agents", actor);
  }
}
