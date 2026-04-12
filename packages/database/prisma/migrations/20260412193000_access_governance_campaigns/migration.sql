CREATE TYPE "SupportAccessReviewCampaignStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELED');

CREATE TYPE "SupportAccessReviewCampaignItemStatus" AS ENUM ('PENDING', 'RECERTIFIED', 'REVOKED');

CREATE TABLE "SupportAccessReviewCampaign" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "SupportAccessReviewCampaignStatus" NOT NULL DEFAULT 'OPEN',
  "dueAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupportAccessReviewCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportAccessReviewCampaignItem" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "supportAccessGrantId" TEXT NOT NULL,
  "status" "SupportAccessReviewCampaignItemStatus" NOT NULL DEFAULT 'PENDING',
  "resolutionReason" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupportAccessReviewCampaignItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportAccessReviewCampaign_organizationId_status_dueAt_idx"
ON "SupportAccessReviewCampaign"("organizationId", "status", "dueAt");

CREATE UNIQUE INDEX "SupportAccessReviewCampaignItem_campaignId_supportAccessGrantId_key"
ON "SupportAccessReviewCampaignItem"("campaignId", "supportAccessGrantId");

CREATE INDEX "SupportAccessReviewCampaignItem_supportAccessGrantId_status_idx"
ON "SupportAccessReviewCampaignItem"("supportAccessGrantId", "status");

ALTER TABLE "SupportAccessReviewCampaign"
ADD CONSTRAINT "SupportAccessReviewCampaign_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportAccessReviewCampaign"
ADD CONSTRAINT "SupportAccessReviewCampaign_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportAccessReviewCampaignItem"
ADD CONSTRAINT "SupportAccessReviewCampaignItem_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "SupportAccessReviewCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportAccessReviewCampaignItem"
ADD CONSTRAINT "SupportAccessReviewCampaignItem_supportAccessGrantId_fkey"
FOREIGN KEY ("supportAccessGrantId") REFERENCES "SupportAccessGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
