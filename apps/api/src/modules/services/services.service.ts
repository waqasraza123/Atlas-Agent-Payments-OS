import type { AtlasActorContext } from "@atlas/auth";
import {
  AtlasSellerWorkflowError,
  createSellerService,
  getSellerService,
  listSellerServices,
  updateSellerService
} from "@atlas/database";
import { Injectable } from "@nestjs/common";
import { createDomainSummary } from "../shared/domain-summary";
import { rethrowSellerWorkflowError } from "../shared/workflow-error";

@Injectable()
export class ServicesService {
  getSummary(actor: AtlasActorContext) {
    return createDomainSummary("services", actor);
  }

  async list(actor: AtlasActorContext) {
    return {
      items: await listSellerServices(actor.organization.id)
    };
  }

  async get(actor: AtlasActorContext, serviceId: string) {
    try {
      const item = await getSellerService(actor.organization.id, serviceId);

      if (!item) {
        throw new AtlasSellerWorkflowError("The selected seller service is not available in this organization.", "not_found");
      }

      return {
        item
      };
    } catch (error) {
      rethrowSellerWorkflowError(error);
    }
  }

  async create(actor: AtlasActorContext, input: unknown) {
    try {
      return {
        item: await createSellerService(actor, input)
      };
    } catch (error) {
      rethrowSellerWorkflowError(error);
    }
  }

  async update(actor: AtlasActorContext, serviceId: string, input: unknown) {
    try {
      return {
        item: await updateSellerService(actor, serviceId, input)
      };
    } catch (error) {
      rethrowSellerWorkflowError(error);
    }
  }
}
