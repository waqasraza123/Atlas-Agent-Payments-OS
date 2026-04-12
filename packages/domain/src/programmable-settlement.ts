import { z } from "zod";
import {
  paymentRails,
  programmableSettlementChains,
  programmableSettlementChainLabels,
  walletVerificationStatuses,
  type PaymentRail,
  type ProgrammableSettlementChain,
  type WalletVerificationStatus
} from "@atlas/types";

const atlasWalletAddressPattern = /^0x[a-fA-F0-9]{40}$/;

export const atlasProgrammableSettlementSettingsSchema = z
  .object({
    allowedRails: z.array(z.enum(paymentRails)).min(1),
    preferredRail: z.enum(paymentRails).nullable().optional()
  })
  .transform((value) => ({
    allowedRails: Array.from(new Set(value.allowedRails)),
    preferredRail: value.preferredRail ?? null
  }))
  .superRefine((value, context) => {
    if (value.preferredRail && !value.allowedRails.includes(value.preferredRail)) {
      context.addIssue({
        code: "custom",
        message: "Preferred rail must also be included in allowed rails.",
        path: ["preferredRail"]
      });
    }
  });

export type AtlasProgrammableSettlementSettings = z.infer<typeof atlasProgrammableSettlementSettingsSchema>;

export const atlasProgrammableWalletCreateSchema = z.object({
  label: z.string().trim().min(2).max(80),
  address: z.string().trim().regex(atlasWalletAddressPattern, "Wallet address must be a 42-character 0x-prefixed hex value."),
  chain: z.enum(programmableSettlementChains),
  ownershipLabel: z.string().trim().min(2).max(120),
  isDefault: z.boolean().default(false)
});

export type AtlasProgrammableWalletCreateInput = z.infer<typeof atlasProgrammableWalletCreateSchema>;

export const atlasProgrammableWalletVerificationSchema = z.object({
  status: z.enum(walletVerificationStatuses),
  note: z.string().trim().min(8).max(240)
});

export type AtlasProgrammableWalletVerificationInput = z.infer<typeof atlasProgrammableWalletVerificationSchema>;

export type AtlasProgrammableChainRecord = {
  key: ProgrammableSettlementChain;
  chainId: number;
  label: string;
  networkName: string;
  assetSymbol: string;
  explorerBaseUrl: string;
  requiredConfirmations: number;
  enabled: boolean;
};

export type AtlasOrganizationWalletRecord = {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationKind: string;
  label: string;
  address: string;
  chain: ProgrammableSettlementChain;
  chainLabel: string;
  verificationStatus: WalletVerificationStatus;
  ownershipLabel: string;
  isDefault: boolean;
  verificationNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AtlasProgrammableSettlementReadiness = {
  ready: boolean;
  reasons: string[];
};

export type AtlasOrganizationProgrammableSettlementRecord = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationKind: string;
  settings: AtlasProgrammableSettlementSettings;
  supportedChain: AtlasProgrammableChainRecord;
  wallets: AtlasOrganizationWalletRecord[];
  readiness: AtlasProgrammableSettlementReadiness;
};

export function normalizeAtlasWalletAddress(address: string) {
  return address.trim().toLowerCase();
}

export function formatAtlasProgrammableChainLabel(chain: ProgrammableSettlementChain) {
  return programmableSettlementChainLabels[chain];
}

export function formatAtlasWalletVerificationStatusLabel(status: WalletVerificationStatus) {
  return status.toLowerCase().replace(/(^|\s)\w/g, (character) => character.toUpperCase());
}

export function createAtlasProgrammableSettlementSettings(
  input: AtlasProgrammableSettlementSettings
): AtlasProgrammableSettlementSettings {
  return atlasProgrammableSettlementSettingsSchema.parse(input);
}

export function deriveAtlasProgrammableSettlementReadiness(input: {
  runtimeEnabled: boolean;
  programmableRailAllowed: boolean;
  defaultVerifiedWallet: AtlasOrganizationWalletRecord | null;
  counterpartyVerifiedWallet: AtlasOrganizationWalletRecord | null;
  requireCounterpartyWallet?: boolean;
}) {
  const reasons: string[] = [];

  if (!input.runtimeEnabled) {
    reasons.push("Programmable settlement is disabled in this environment.");
  }

  if (!input.programmableRailAllowed) {
    reasons.push("This organization has not allowed the programmable USDC rail.");
  }

  if (!input.defaultVerifiedWallet) {
    reasons.push("A verified default organization wallet is required.");
  }

  if ((input.requireCounterpartyWallet ?? true) && !input.counterpartyVerifiedWallet) {
    reasons.push("A verified counterparty wallet is required.");
  }

  return {
    ready: reasons.length === 0,
    reasons
  } satisfies AtlasProgrammableSettlementReadiness;
}

export function createAtlasProgrammableSettlementEvidenceSummary(input: {
  chainLabel: string | null;
  assetSymbol: string | null;
  transactionHash: string | null;
  confirmations: number | null;
  buyerWalletAddress: string | null;
  sellerWalletAddress: string | null;
}) {
  return [
    input.chainLabel ? `Chain ${input.chainLabel}` : null,
    input.assetSymbol ? `Asset ${input.assetSymbol}` : null,
    input.transactionHash ? `Transaction ${input.transactionHash}` : null,
    input.confirmations !== null ? `Confirmations ${input.confirmations}` : null,
    input.buyerWalletAddress ? `Buyer wallet ${input.buyerWalletAddress}` : null,
    input.sellerWalletAddress ? `Seller wallet ${input.sellerWalletAddress}` : null
  ].filter((value): value is string => Boolean(value));
}
