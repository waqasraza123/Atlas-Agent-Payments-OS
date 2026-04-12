import { describe, expect, it } from "vitest";
import {
  atlasProgrammableSettlementSettingsSchema,
  atlasProgrammableWalletCreateSchema,
  createAtlasProgrammableSettlementEvidenceSummary,
  deriveAtlasProgrammableSettlementReadiness,
  formatAtlasProgrammableChainLabel,
  formatAtlasWalletVerificationStatusLabel,
  normalizeAtlasWalletAddress
} from "./programmable-settlement";

describe("atlas programmable settlement contracts", () => {
  it("normalizes wallet input and settlement settings", () => {
    expect(
      atlasProgrammableWalletCreateSchema.parse({
        label: "Buyer Treasury",
        address: "0x1234567890abcdef1234567890abcdef12345678",
        chain: "BASE_SEPOLIA",
        ownershipLabel: "Atlas Demo Buyer Treasury",
        isDefault: true
      }).address
    ).toBe("0x1234567890abcdef1234567890abcdef12345678");

    expect(
      atlasProgrammableSettlementSettingsSchema.parse({
        allowedRails: ["INTERNAL_SIMULATED", "PROGRAMMABLE_USDC", "PROGRAMMABLE_USDC"],
        preferredRail: "PROGRAMMABLE_USDC"
      })
    ).toEqual({
      allowedRails: ["INTERNAL_SIMULATED", "PROGRAMMABLE_USDC"],
      preferredRail: "PROGRAMMABLE_USDC"
    });
  });

  it("derives programmable readiness from runtime, governance, and wallet posture", () => {
    expect(
      deriveAtlasProgrammableSettlementReadiness({
        runtimeEnabled: true,
        programmableRailAllowed: true,
        defaultVerifiedWallet: {
          id: "wallet-1",
          organizationId: "org-1",
          organizationName: "Buyer",
          organizationKind: "BUYER",
          label: "Buyer Treasury",
          address: "0x1234567890abcdef1234567890abcdef12345678",
          chain: "BASE_SEPOLIA",
          chainLabel: "Base Sepolia",
          verificationStatus: "VERIFIED",
          ownershipLabel: "Treasury",
          isDefault: true,
          verificationNote: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        counterpartyVerifiedWallet: null
      })
    ).toEqual({
      ready: false,
      reasons: ["A verified counterparty wallet is required."]
    });
  });

  it("formats labels and evidence summaries", () => {
    expect(formatAtlasProgrammableChainLabel("BASE_MAINNET")).toBe("Base Mainnet");
    expect(formatAtlasWalletVerificationStatusLabel("VERIFIED")).toBe("Verified");
    expect(normalizeAtlasWalletAddress(" 0xABCDEF1234567890ABCDEF1234567890ABCDEF12 ")).toBe(
      "0xabcdef1234567890abcdef1234567890abcdef12"
    );
    expect(
      createAtlasProgrammableSettlementEvidenceSummary({
        chainLabel: "Base Sepolia",
        assetSymbol: "USDC",
        transactionHash: "0xtx123",
        confirmations: 3,
        buyerWalletAddress: "0xbuyer",
        sellerWalletAddress: "0xseller"
      })
    ).toEqual([
      "Chain Base Sepolia",
      "Asset USDC",
      "Transaction 0xtx123",
      "Confirmations 3",
      "Buyer wallet 0xbuyer",
      "Seller wallet 0xseller"
    ]);
  });
});
