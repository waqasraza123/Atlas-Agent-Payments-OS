import { Injectable } from "@nestjs/common";
import { listDomainSummaries } from "../shared/domain-summary";

@Injectable()
export class PlatformService {
  listModules() {
    return {
      modules: listDomainSummaries()
    };
  }
}
