import {
  exportBuyerRequestCsvForActor,
  exportPlatformTransactionCsvForActor,
  exportSellerRequestCsvForActor,
  getBuyerAnalyticsForActor,
  getPlatformAnalyticsForActor,
  getSellerRevenueAnalyticsForActor,
  listBuyerActivityAnalyticsForActor,
  listBuyerRequestAnalyticsForActor,
  listPlatformOrganizationsForActor,
  listPlatformTransactionsForActor,
  listSellerRequestAnalyticsForActor
} from "@atlas/database";
import type { AtlasActorContext } from "@atlas/auth";
import { Injectable } from "@nestjs/common";
import { rethrowAnalyticsReportingError } from "../shared/workflow-error";

@Injectable()
export class AnalyticsService {
  async getBuyerOverview(actor: AtlasActorContext) {
    try {
      return {
        item: await getBuyerAnalyticsForActor(actor)
      };
    } catch (error) {
      rethrowAnalyticsReportingError(error);
    }
  }

  async listBuyerRequests(actor: AtlasActorContext, query: Record<string, string | string[] | undefined>) {
    try {
      return {
        items: await listBuyerRequestAnalyticsForActor(actor, query)
      };
    } catch (error) {
      rethrowAnalyticsReportingError(error);
    }
  }

  async listBuyerActivity(actor: AtlasActorContext, query: Record<string, string | string[] | undefined>) {
    try {
      return {
        items: await listBuyerActivityAnalyticsForActor(actor, query)
      };
    } catch (error) {
      rethrowAnalyticsReportingError(error);
    }
  }

  async exportBuyerRequests(actor: AtlasActorContext, query: Record<string, string | string[] | undefined>) {
    try {
      return exportBuyerRequestCsvForActor(actor, query);
    } catch (error) {
      rethrowAnalyticsReportingError(error);
    }
  }

  async getSellerOverview(actor: AtlasActorContext) {
    try {
      return {
        item: await getSellerRevenueAnalyticsForActor(actor)
      };
    } catch (error) {
      rethrowAnalyticsReportingError(error);
    }
  }

  async listSellerRequests(actor: AtlasActorContext, query: Record<string, string | string[] | undefined>) {
    try {
      return {
        items: await listSellerRequestAnalyticsForActor(actor, query)
      };
    } catch (error) {
      rethrowAnalyticsReportingError(error);
    }
  }

  async exportSellerRequests(actor: AtlasActorContext, query: Record<string, string | string[] | undefined>) {
    try {
      return exportSellerRequestCsvForActor(actor, query);
    } catch (error) {
      rethrowAnalyticsReportingError(error);
    }
  }

  async getPlatformOverview(actor: AtlasActorContext) {
    try {
      return {
        item: await getPlatformAnalyticsForActor(actor)
      };
    } catch (error) {
      rethrowAnalyticsReportingError(error);
    }
  }

  async listPlatformTransactions(actor: AtlasActorContext, query: Record<string, string | string[] | undefined>) {
    try {
      return {
        items: await listPlatformTransactionsForActor(actor, query)
      };
    } catch (error) {
      rethrowAnalyticsReportingError(error);
    }
  }

  async listPlatformOrganizations(actor: AtlasActorContext) {
    try {
      return {
        items: await listPlatformOrganizationsForActor(actor)
      };
    } catch (error) {
      rethrowAnalyticsReportingError(error);
    }
  }

  async exportPlatformTransactions(actor: AtlasActorContext, query: Record<string, string | string[] | undefined>) {
    try {
      return exportPlatformTransactionCsvForActor(actor, query);
    } catch (error) {
      rethrowAnalyticsReportingError(error);
    }
  }
}
