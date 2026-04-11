import { Injectable } from "@nestjs/common";
import { listDomainSummaries } from "../shared/domain-summary";
import { listQueueSummaries } from "../shared/queue-summary";

@Injectable()
export class PlatformService {
  listModules() {
    return {
      modules: listDomainSummaries()
    };
  }

  listQueues() {
    return {
      queues: listQueueSummaries()
    };
  }
}
