import type { AtlasActorContext } from "@atlas/auth";
import {
  exportBuyerRequestCsv,
  exportSellerRequestCsv,
  exportPlatformTransactionCsv,
  getBuyerAnalytics,
  getPlatformAnalytics,
  getSellerRevenueAnalytics,
  listBuyerActivityAnalytics,
  listBuyerRequestAnalytics,
  listPlatformOrganizations,
  listPlatformTransactions,
  listSellerRequestAnalytics
} from "@atlas/database";
import { Injectable } from "@nestjs/common";
import { rethrowAnalyticsReportingError } from "../shared/workflow-error";

@Injectable()
export class AnalyticsService {
  async getBuyerOverview(actor: AtlasActorContext) {
    try {
      return {
        item: await getBuyerAnalytics(actor.organization.id)
      };
    } catch (error) {
      rethrowAnalyticsReportingError(error);
    }
  }

  async listBuyerRequests(actor: AtlasActorContext, query: Record<string, string | string[] | undefined>) {
    try {
      return {
        items: await listBuyerRequestAnalytics(actor.organization.id, query)
      };
    } catch (error) {
      rethrowAnalyticsReportingError(error);
    }
  }

  async listBuyerActivity(actor: AtlasActorContext, query: Record<string, string | string[] | undefined>) {
    try {
      return {
        items: await listBuyerActivityAnalytics(actor.organization.id, query)
      };
    } catch (error) {
      rethrowAnalyticsReportingError(error);
    }
  }

  async exportBuyerRequests(actor: AtlasActorContext, query: Record<string, string | string[] | undefined>) {
    try {
      return exportBuyerRequestCsv(actor.organization.id, query);
    } catch (error) {
      rethrowAnalyticsReportingError(error);
    }
  }

  async getSellerOverview(actor: AtlasActorContext) {
    try {
      return {
        item: await getSellerRevenueAnalytics(actor.organization.id)
      };
    } catch (error) {
      rethrowAnalyticsReportingError(error);
    }
  }

  async listSellerRequests(actor: AtlasActorContext, query: Record<string, string | string[] | undefined>) {
    try {
      return {
        items: await listSellerRequestAnalytics(actor.organization.id, query)
      };
    } catch (error) {
      rethrowAnalyticsReportingError(error);
    }
  }

  async exportSellerRequests(actor: AtlasActorContext, query: Record<string, string | string[] | undefined>) {
    try {
      return exportSellerRequestCsv(actor.organization.id, query);
    } catch (error) {
      rethrowAnalyticsReportingError(error);
    }
  }

  async getPlatformOverview() {
    try {
      return {
        item: await getPlatformAnalytics()
      };
    } catch (error) {
      rethrowAnalyticsReportingError(error);
    }
  }

  async listPlatformTransactions(query: Record<string, string | string[] | undefined>) {
    try {
      return {
        items: await listPlatformTransactions(query)
      };
    } catch (error) {
      rethrowAnalyticsReportingError(error);
    }
  }

  async listPlatformOrganizations() {
    try {
      return {
        items: await listPlatformOrganizations()
      };
    } catch (error) {
      rethrowAnalyticsReportingError(error);
    }
  }

  async exportPlatformTransactions(query: Record<string, string | string[] | undefined>) {
    try {
      return exportPlatformTransactionCsv(query);
    } catch (error) {
      rethrowAnalyticsReportingError(error);
    }
  }
}

