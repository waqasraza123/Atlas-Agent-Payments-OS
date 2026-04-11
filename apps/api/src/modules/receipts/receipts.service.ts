import type { AtlasActorContext } from "@atlas/auth";
import { getReceiptRecord, listReceiptRecords } from "@atlas/database";
import { Injectable, NotFoundException } from "@nestjs/common";
import { createDomainSummary } from "../shared/domain-summary";

@Injectable()
export class ReceiptsService {
  getSummary(actor: AtlasActorContext) {
    return createDomainSummary("receipts", actor);
  }

  async list(actor: AtlasActorContext) {
    return {
      items: await listReceiptRecords(actor)
    };
  }

  async get(actor: AtlasActorContext, receiptId: string) {
    const item = await getReceiptRecord(actor, receiptId);

    if (!item) {
      throw new NotFoundException("Receipt record not available in this workspace.");
    }

    return {
      item
    };
  }
}
