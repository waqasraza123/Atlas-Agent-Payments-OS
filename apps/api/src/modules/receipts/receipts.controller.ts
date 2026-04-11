import type { AtlasActorContext } from "@atlas/auth";
import { Controller, Get, Inject, Param, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireWorkspaces } from "../actor/actor.decorators";
import { ActorGuard } from "../actor/actor.guard";
import { ReceiptsService } from "./receipts.service";

@Controller("receipts")
@UseGuards(ActorGuard)
@RequireWorkspaces("BUYER", "SELLER", "OPERATOR")
export class ReceiptsController {
  constructor(@Inject(ReceiptsService) private readonly receiptsService: ReceiptsService) {
    this.summary = this.summary.bind(this);
  }

  @Get("summary")
  summary(@CurrentActor() actor: AtlasActorContext) {
    return this.receiptsService.getSummary(actor);
  }

  @Get()
  list(@CurrentActor() actor: AtlasActorContext) {
    return this.receiptsService.list(actor);
  }

  @Get(":receiptId")
  get(@CurrentActor() actor: AtlasActorContext, @Param("receiptId") receiptId: string) {
    return this.receiptsService.get(actor, receiptId);
  }
}
