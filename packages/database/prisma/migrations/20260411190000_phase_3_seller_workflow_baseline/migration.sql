CREATE TYPE "ServiceStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TYPE "ServiceVisibilityMode" AS ENUM ('PRIVATE', 'TRUSTED_BUYERS', 'PUBLIC');

CREATE TYPE "ServicePricingModel" AS ENUM ('FIXED');

ALTER TABLE "SpendRequest"
ADD COLUMN "serviceKey" TEXT;

UPDATE "SpendRequest"
SET "serviceKey" = "requestPayload"->>'serviceKey'
WHERE "serviceKey" IS NULL;

CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "ServiceStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "ServiceVisibilityMode" NOT NULL DEFAULT 'PRIVATE',
    "pricingModel" "ServicePricingModel" NOT NULL DEFAULT 'FIXED',
    "priceMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Service_organizationId_key_key" ON "Service"("organizationId", "key");

CREATE INDEX "Service_organizationId_status_idx" ON "Service"("organizationId", "status");

CREATE INDEX "SpendRequest_sellerOrganizationId_serviceKey_idx" ON "SpendRequest"("sellerOrganizationId", "serviceKey");

ALTER TABLE "Service"
ADD CONSTRAINT "Service_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
