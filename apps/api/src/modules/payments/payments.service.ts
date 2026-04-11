import type { AtlasActorContext } from "@atlas/auth";
import { executeBuyerPayment, getPaymentIntent, listPaymentIntents } from "@atlas/database";
import { Injectable, NotFoundException } from "@nestjs/common";
import { createDomainSummary } from "../shared/domain-summary";
import { rethrowPaymentsWorkflowError } from "../shared/workflow-error";

@Injectable()
export class PaymentsService {
  getSummary(actor: AtlasActorContext) {
    return createDomainSummary("payments", actor);
  }

  async list(actor: AtlasActorContext) {
    return {
      items: await listPaymentIntents(actor)
    };
  }

  async get(actor: AtlasActorContext, paymentId: string) {
    const item = await getPaymentIntent(actor, paymentId);

    if (!item) {
      throw new NotFoundException("Payment record not available in this workspace.");
    }

    return {
      item
    };
  }

  async execute(actor: AtlasActorContext, requestId: string, input: unknown) {
    try {
      return {
        item: await executeBuyerPayment(actor, requestId, input)
      };
    } catch (error) {
      rethrowPaymentsWorkflowError(error);
    }
  }
}
