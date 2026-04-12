import type { AtlasActorContext } from "@atlas/auth";
import { Controller, Get, Header, Inject, Query, UseGuards } from "@nestjs/common";
import { CurrentActor, RequireRoles, RequireWorkspace } from "../actor/actor.decorators";
import { ActorGuard } from "../actor/actor.guard";
import { AnalyticsService } from "./analytics.service";

@Controller("analytics")
@UseGuards(ActorGuard)
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analyticsService: AnalyticsService) {}

  @Get("buyer/overview")
  @RequireWorkspace("BUYER")
  getBuyerOverview(@CurrentActor() actor: AtlasActorContext) {
    return this.analyticsService.getBuyerOverview(actor);
  }

  @Get("buyer/requests")
  @RequireWorkspace("BUYER")
  listBuyerRequests(@CurrentActor() actor: AtlasActorContext, @Query() query: Record<string, string | string[] | undefined>) {
    return this.analyticsService.listBuyerRequests(actor, query);
  }

  @Get("buyer/activity")
  @RequireWorkspace("BUYER")
  listBuyerActivity(@CurrentActor() actor: AtlasActorContext, @Query() query: Record<string, string | string[] | undefined>) {
    return this.analyticsService.listBuyerActivity(actor, query);
  }

  @Get("buyer/requests.csv")
  @RequireWorkspace("BUYER")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="buyer-requests.csv"')
  exportBuyerRequests(@CurrentActor() actor: AtlasActorContext, @Query() query: Record<string, string | string[] | undefined>) {
    return this.analyticsService.exportBuyerRequests(actor, query);
  }

  @Get("seller/overview")
  @RequireWorkspace("SELLER")
  getSellerOverview(@CurrentActor() actor: AtlasActorContext) {
    return this.analyticsService.getSellerOverview(actor);
  }

  @Get("seller/requests")
  @RequireWorkspace("SELLER")
  listSellerRequests(@CurrentActor() actor: AtlasActorContext, @Query() query: Record<string, string | string[] | undefined>) {
    return this.analyticsService.listSellerRequests(actor, query);
  }

  @Get("seller/requests.csv")
  @RequireWorkspace("SELLER")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="seller-requests.csv"')
  exportSellerRequests(@CurrentActor() actor: AtlasActorContext, @Query() query: Record<string, string | string[] | undefined>) {
    return this.analyticsService.exportSellerRequests(actor, query);
  }

  @Get("platform/overview")
  @RequireWorkspace("OPERATOR")
  getPlatformOverview(@CurrentActor() actor: AtlasActorContext) {
    return this.analyticsService.getPlatformOverview(actor);
  }

  @Get("platform/transactions")
  @RequireWorkspace("OPERATOR")
  listPlatformTransactions(@CurrentActor() actor: AtlasActorContext, @Query() query: Record<string, string | string[] | undefined>) {
    return this.analyticsService.listPlatformTransactions(actor, query);
  }

  @Get("platform/organizations")
  @RequireWorkspace("OPERATOR")
  listPlatformOrganizations(@CurrentActor() actor: AtlasActorContext) {
    return this.analyticsService.listPlatformOrganizations(actor);
  }

  @Get("platform/transactions.csv")
  @RequireWorkspace("OPERATOR")
  @RequireRoles("OWNER", "ADMIN", "OPERATOR", "FINANCE")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="platform-transactions.csv"')
  exportPlatformTransactions(@CurrentActor() actor: AtlasActorContext, @Query() query: Record<string, string | string[] | undefined>) {
    return this.analyticsService.exportPlatformTransactions(actor, query);
  }
}
