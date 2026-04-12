ALTER TYPE "PaymentRail" ADD VALUE IF NOT EXISTS 'PROGRAMMABLE_USDC';

CREATE TYPE "ProgrammableSettlementChain" AS ENUM ('BASE_SEPOLIA', 'BASE_MAINNET');

CREATE TYPE "WalletVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REVOKED');

ALTER TABLE "Organization"
ADD COLUMN "metadata" JSONB;

CREATE TABLE "OrganizationWallet" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "chain" "ProgrammableSettlementChain" NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ownershipLabel" TEXT NOT NULL,
    "verificationStatus" "WalletVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationNote" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationWallet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationWallet_organizationId_chain_address_key"
ON "OrganizationWallet"("organizationId", "chain", "address");

CREATE INDEX "OrganizationWallet_organizationId_verificationStatus_idx"
ON "OrganizationWallet"("organizationId", "verificationStatus");

ALTER TABLE "OrganizationWallet"
ADD CONSTRAINT "OrganizationWallet_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
