CREATE TYPE "AuthProviderMode" AS ENUM (
  'LOCAL_SIGNED',
  'IDENTITY_BRIDGE'
);

CREATE TYPE "SupportAccessGrantStatus" AS ENUM (
  'ACTIVE',
  'REVOKED',
  'EXPIRED'
);

CREATE TABLE "SupportAccessGrant" (
  "id" TEXT NOT NULL,
  "issuedByUserId" TEXT NOT NULL,
  "issuedByOrganizationId" TEXT NOT NULL,
  "targetOrganizationId" TEXT NOT NULL,
  "targetWorkspace" "OrganizationKind" NOT NULL,
  "authProviderMode" "AuthProviderMode" NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "SupportAccessGrantStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokedReason" TEXT,
  "revokedByUserId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportAccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportAccessGrant_issuedByOrganizationId_status_createdAt_idx" ON "SupportAccessGrant"("issuedByOrganizationId", "status", "createdAt");
CREATE INDEX "SupportAccessGrant_targetOrganizationId_status_createdAt_idx" ON "SupportAccessGrant"("targetOrganizationId", "status", "createdAt");

ALTER TABLE "SupportAccessGrant"
ADD CONSTRAINT "SupportAccessGrant_issuedByUserId_fkey"
FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportAccessGrant"
ADD CONSTRAINT "SupportAccessGrant_issuedByOrganizationId_fkey"
FOREIGN KEY ("issuedByOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportAccessGrant"
ADD CONSTRAINT "SupportAccessGrant_targetOrganizationId_fkey"
FOREIGN KEY ("targetOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportAccessGrant"
ADD CONSTRAINT "SupportAccessGrant_revokedByUserId_fkey"
FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
