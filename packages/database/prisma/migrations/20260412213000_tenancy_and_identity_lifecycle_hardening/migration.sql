DO $$
BEGIN
  CREATE TYPE "IdentityProviderLinkStatus" AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'REVOKED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "IdentityProviderLink"
ADD COLUMN "status" "IdentityProviderLinkStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "statusReason" TEXT,
ADD COLUMN "statusChangedAt" TIMESTAMP(3),
ADD COLUMN "statusChangedByUserId" TEXT;

CREATE INDEX "IdentityProviderLink_status_lastAuthenticatedAt_idx"
ON "IdentityProviderLink"("status", "lastAuthenticatedAt");

ALTER TABLE "IdentityProviderLink"
ADD CONSTRAINT "IdentityProviderLink_statusChangedByUserId_fkey"
FOREIGN KEY ("statusChangedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
