DO $$
BEGIN
  CREATE TYPE "ExternalIdentityAssignmentStatus" AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'REVOKED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "ExternalIdentityAssignment" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "externalEmail" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "status" "ExternalIdentityAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "statusReason" TEXT,
  "metadata" JSONB,
  "provisionedByUserId" TEXT NOT NULL,
  "statusChangedByUserId" TEXT,
  "provisionedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "statusChangedAt" TIMESTAMP(3),
  "lastExchangedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalIdentityAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalIdentityAssignment_provider_externalEmail_membershipId_key"
ON "ExternalIdentityAssignment"("provider", "externalEmail", "membershipId");

CREATE INDEX "ExternalIdentityAssignment_provider_externalEmail_status_idx"
ON "ExternalIdentityAssignment"("provider", "externalEmail", "status");

CREATE INDEX "ExternalIdentityAssignment_organizationId_status_idx"
ON "ExternalIdentityAssignment"("organizationId", "status");

CREATE INDEX "ExternalIdentityAssignment_membershipId_status_idx"
ON "ExternalIdentityAssignment"("membershipId", "status");

ALTER TABLE "ExternalIdentityAssignment"
ADD CONSTRAINT "ExternalIdentityAssignment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalIdentityAssignment"
ADD CONSTRAINT "ExternalIdentityAssignment_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalIdentityAssignment"
ADD CONSTRAINT "ExternalIdentityAssignment_membershipId_fkey"
FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalIdentityAssignment"
ADD CONSTRAINT "ExternalIdentityAssignment_provisionedByUserId_fkey"
FOREIGN KEY ("provisionedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExternalIdentityAssignment"
ADD CONSTRAINT "ExternalIdentityAssignment_statusChangedByUserId_fkey"
FOREIGN KEY ("statusChangedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
