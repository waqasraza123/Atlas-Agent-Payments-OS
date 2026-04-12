import type { AtlasActorContext } from "@atlas/auth";
import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireRoles, RequireWorkspaces } from "../actor/actor.decorators";
import { ActorGuard } from "../actor/actor.guard";
import { ProgrammableSettlementService } from "./programmable-settlement.service";

@Controller("programmable-settlement")
@UseGuards(ActorGuard)
@RequireWorkspaces("BUYER", "SELLER", "OPERATOR")
export class ProgrammableSettlementController {
  constructor(
    @Inject(ProgrammableSettlementService)
    private readonly programmableSettlementService: ProgrammableSettlementService
  ) {
    this.summary = this.summary.bind(this);
  }

  @Get("summary")
  summary(@CurrentActor() actor: AtlasActorContext) {
    return this.programmableSettlementService.getSummary(actor);
  }

  @Get("chains")
  getChains() {
    return this.programmableSettlementService.getChains();
  }

  @Get("organization")
  @RequireWorkspaces("BUYER", "SELLER")
  getOrganization(@CurrentActor() actor: AtlasActorContext) {
    return this.programmableSettlementService.getOrganization(actor);
  }

  @Get("wallets")
  @RequireWorkspaces("BUYER", "SELLER")
  listWallets(@CurrentActor() actor: AtlasActorContext) {
    return this.programmableSettlementService.listWallets(actor);
  }

  @Post("wallets")
  @RequireWorkspaces("BUYER", "SELLER")
  @RequireRoles("OWNER", "ADMIN", "FINANCE", "OPERATOR")
  createWallet(@CurrentActor() actor: AtlasActorContext, @Body() body: unknown) {
    return this.programmableSettlementService.createWallet(actor, body);
  }

  @Patch("settings")
  @RequireWorkspaces("BUYER", "SELLER")
  @RequireRoles("OWNER", "ADMIN", "FINANCE", "OPERATOR")
  updateSettings(@CurrentActor() actor: AtlasActorContext, @Body() body: unknown) {
    return this.programmableSettlementService.updateSettings(actor, body);
  }

  @Get("organizations")
  @RequireWorkspaces("OPERATOR")
  listOrganizations(@CurrentActor() actor: AtlasActorContext) {
    return this.programmableSettlementService.listOrganizations(actor);
  }

  @Patch("wallets/:walletId/verification")
  @RequireWorkspaces("OPERATOR")
  @RequireRoles("OPERATOR", "ADMIN")
  verifyWallet(@CurrentActor() actor: AtlasActorContext, @Param("walletId") walletId: string, @Body() body: unknown) {
    return this.programmableSettlementService.verifyWallet(actor, walletId, body);
  }
}
