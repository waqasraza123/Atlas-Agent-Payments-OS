import type { AtlasActorContext } from "@atlas/auth";
import {
  createOrganizationWallet,
  getAtlasSupportedProgrammableSettlementChain,
  getOrganizationProgrammableSettlement,
  listOrganizationWallets,
  listProgrammableSettlementOrganizations,
  updateOrganizationProgrammableSettlementSettings,
  verifyOrganizationWallet
} from "@atlas/database";
import { Injectable } from "@nestjs/common";
import { createDomainSummary } from "../shared/domain-summary";
import { rethrowProgrammableSettlementError } from "../shared/workflow-error";

@Injectable()
export class ProgrammableSettlementService {
  getSummary(actor: AtlasActorContext) {
    return createDomainSummary("programmable-settlement", actor);
  }

  getChains() {
    return {
      items: [getAtlasSupportedProgrammableSettlementChain()]
    };
  }

  async getOrganization(actor: AtlasActorContext) {
    try {
      return {
        item: await getOrganizationProgrammableSettlement(actor)
      };
    } catch (error) {
      rethrowProgrammableSettlementError(error);
    }
  }

  async listWallets(actor: AtlasActorContext) {
    try {
      return {
        items: await listOrganizationWallets(actor)
      };
    } catch (error) {
      rethrowProgrammableSettlementError(error);
    }
  }

  async createWallet(actor: AtlasActorContext, input: unknown) {
    try {
      return {
        item: await createOrganizationWallet(actor, input)
      };
    } catch (error) {
      rethrowProgrammableSettlementError(error);
    }
  }

  async updateSettings(actor: AtlasActorContext, input: unknown) {
    try {
      return {
        item: await updateOrganizationProgrammableSettlementSettings(actor, input)
      };
    } catch (error) {
      rethrowProgrammableSettlementError(error);
    }
  }

  async listOrganizations(actor: AtlasActorContext) {
    try {
      return {
        module: createDomainSummary("programmable-settlement", actor).module,
        items: await listProgrammableSettlementOrganizations()
      };
    } catch (error) {
      rethrowProgrammableSettlementError(error);
    }
  }

  async verifyWallet(actor: AtlasActorContext, walletId: string, input: unknown) {
    try {
      return {
        item: await verifyOrganizationWallet(actor, walletId, input)
      };
    } catch (error) {
      rethrowProgrammableSettlementError(error);
    }
  }
}
