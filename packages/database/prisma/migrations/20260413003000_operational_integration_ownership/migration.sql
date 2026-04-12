DO $$
BEGIN
  CREATE TYPE "OperationalIntegrationKind" AS ENUM (
    'UPSTREAM_IDENTITY',
    'RESTORE_DRILL',
    'SECRET_ROTATION',
    'DEPLOYMENT_AUTOMATION'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "OperationalIntegrationStatus" AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'REVOKED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "OperationalIntegrationVerificationStatus" AS ENUM (
    'PENDING',
    'VERIFIED',
    'STALE',
    'FAILED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "OperationalTargetEnvironment" AS ENUM (
    'DEVELOPMENT',
    'STAGING',
    'PRODUCTION'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "OperationalIntegration" (
  "id" TEXT NOT NULL,
  "kind" "OperationalIntegrationKind" NOT NULL,
  "targetEnvironment" "OperationalTargetEnvironment" NOT NULL,
  "provider" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "ownerEmail" TEXT NOT NULL,
  "endpointReference" TEXT,
  "secretReference" TEXT,
  "configReference" TEXT,
  "status" "OperationalIntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
  "verificationStatus" "OperationalIntegrationVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "verificationReason" TEXT,
  "statusReason" TEXT,
  "metadata" JSONB,
  "lastVerifiedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperationalIntegration_kind_targetEnvironment_provider_label_key"
ON "OperationalIntegration"("kind", "targetEnvironment", "provider", "label");

CREATE INDEX "OperationalIntegration_kind_targetEnvironment_status_verificationStatus_idx"
ON "OperationalIntegration"("kind", "targetEnvironment", "status", "verificationStatus");

CREATE INDEX "OperationalIntegration_targetEnvironment_provider_status_idx"
ON "OperationalIntegration"("targetEnvironment", "provider", "status");

ALTER TABLE "OperationalIntegration"
ADD CONSTRAINT "OperationalIntegration_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OperationalIntegration"
ADD CONSTRAINT "OperationalIntegration_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
