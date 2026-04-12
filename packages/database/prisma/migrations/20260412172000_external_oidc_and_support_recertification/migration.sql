ALTER TYPE "AuthProviderMode" ADD VALUE IF NOT EXISTS 'EXTERNAL_OIDC';

ALTER TYPE "SupportAccessGrantStatus" ADD VALUE IF NOT EXISTS 'RECERTIFICATION_REQUIRED';

CREATE TYPE "SupportAccessGrantReviewType" AS ENUM ('INITIAL', 'RECERTIFICATION');

ALTER TABLE "SupportAccessGrant"
ADD COLUMN "lastReviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewExpiresAt" TIMESTAMP(3);

ALTER TABLE "SupportAccessGrantReview"
ADD COLUMN "reviewType" "SupportAccessGrantReviewType" NOT NULL DEFAULT 'INITIAL';

CREATE INDEX "SupportAccessGrant_status_reviewExpiresAt_idx" ON "SupportAccessGrant"("status", "reviewExpiresAt");

CREATE INDEX "SupportAccessGrantReview_supportAccessGrantId_reviewType_creat_idx"
ON "SupportAccessGrantReview"("supportAccessGrantId", "reviewType", "createdAt");
