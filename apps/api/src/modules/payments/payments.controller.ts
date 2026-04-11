import type { AtlasActorContext } from "@atlas/auth";
import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireRoles, RequireWorkspaces, RequireWorkspace } from "../actor/actor.decorators";
import { ActorGuard } from "../actor/actor.guard";
import { PaymentsService } from "./payments.service";

@Controller("payments")
@UseGuards(ActorGuard)
@RequireWorkspaces("BUYER", "SELLER", "OPERATOR")
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {
    this.summary = this.summary.bind(this);
  }

  @Get("summary")
  summary(@CurrentActor() actor: AtlasActorContext) {
    return this.paymentsService.getSummary(actor);
  }

  @Get()
  list(@CurrentActor() actor: AtlasActorContext) {
    return this.paymentsService.list(actor);
  }

  @Get(":paymentId")
  get(@CurrentActor() actor: AtlasActorContext, @Param("paymentId") paymentId: string) {
    return this.paymentsService.get(actor, paymentId);
  }

  @Post("requests/:requestId/execute")
  @RequireWorkspace("BUYER")
  @RequireRoles("OWNER", "ADMIN", "REVIEWER", "FINANCE")
  execute(@CurrentActor() actor: AtlasActorContext, @Param("requestId") requestId: string, @Body() body: unknown) {
    return this.paymentsService.execute(actor, requestId, body);
  }
}
