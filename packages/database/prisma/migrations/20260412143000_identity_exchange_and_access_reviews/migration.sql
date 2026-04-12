ALTER TYPE "SupportAccessGrantStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';
ALTER TYPE "SupportAccessGrantStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

CREATE TYPE "AppSessionSource" AS ENUM (
  'LOCAL_SIGNED',
  'IDENTITY_PROVIDER',
  'INTERNAL_SUPPORT'
);

CREATE TYPE "SupportAccessGrantReviewDecision" AS ENUM (
  'APPROVED',
  'REJECTED'
);

CREATE TABLE "IdentityProviderLink" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "metadata" JSONB,
  "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAuthenticatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdentityProviderLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "source" "AppSessionSource" NOT NULL,
  "authProviderMode" "AuthProviderMode" NOT NULL,
  "provider" TEXT,
  "providerSubject" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportAccessGrantReview" (
  "id" TEXT NOT NULL,
  "supportAccessGrantId" TEXT NOT NULL,
  "reviewerUserId" TEXT NOT NULL,
  "reviewerOrganizationId" TEXT NOT NULL,
  "decision" "SupportAccessGrantReviewDecision" NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportAccessGrantReview_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SupportAccessGrant"
ADD COLUMN "lastActivatedAt" TIMESTAMP(3);

ALTER TABLE "SupportAccessGrant"
ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW';

CREATE UNIQUE INDEX "IdentityProviderLink_provider_subject_key" ON "IdentityProviderLink"("provider", "subject");
CREATE INDEX "IdentityProviderLink_userId_provider_idx" ON "IdentityProviderLink"("userId", "provider");

CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");
CREATE INDEX "AuthSession_organizationId_expiresAt_idx" ON "AuthSession"("organizationId", "expiresAt");
CREATE INDEX "AuthSession_membershipId_expiresAt_idx" ON "AuthSession"("membershipId", "expiresAt");
CREATE INDEX "AuthSession_source_expiresAt_idx" ON "AuthSession"("source", "expiresAt");

CREATE INDEX "SupportAccessGrantReview_supportAccessGrantId_createdAt_idx" ON "SupportAccessGrantReview"("supportAccessGrantId", "createdAt");
CREATE INDEX "SupportAccessGrantReview_reviewerOrganizationId_createdAt_idx" ON "SupportAccessGrantReview"("reviewerOrganizationId", "createdAt");

ALTER TABLE "IdentityProviderLink"
ADD CONSTRAINT "IdentityProviderLink_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuthSession"
ADD CONSTRAINT "AuthSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuthSession"
ADD CONSTRAINT "AuthSession_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuthSession"
ADD CONSTRAINT "AuthSession_membershipId_fkey"
FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportAccessGrantReview"
ADD CONSTRAINT "SupportAccessGrantReview_supportAccessGrantId_fkey"
FOREIGN KEY ("supportAccessGrantId") REFERENCES "SupportAccessGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportAccessGrantReview"
ADD CONSTRAINT "SupportAccessGrantReview_reviewerUserId_fkey"
FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportAccessGrantReview"
ADD CONSTRAINT "SupportAccessGrantReview_reviewerOrganizationId_fkey"
FOREIGN KEY ("reviewerOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
