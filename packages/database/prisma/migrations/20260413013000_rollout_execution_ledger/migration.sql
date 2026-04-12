-- CreateEnum
CREATE TYPE "OperationalExecutionKind" AS ENUM ('RESTORE_DRILL', 'SECRET_ROTATION', 'DEPLOYMENT_PROMOTION', 'UPSTREAM_IDENTITY');

-- CreateEnum
CREATE TYPE "OperationalExecutionMode" AS ENUM ('DRY_RUN', 'COMMAND');

-- CreateEnum
CREATE TYPE "OperationalExecutionStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "OperationalProofArtifactKind" AS ENUM ('REPORT', 'MANIFEST', 'BACKUP', 'BUNDLE');

-- CreateTable
CREATE TABLE "OperationalExecution" (
    "id" TEXT NOT NULL,
    "kind" "OperationalExecutionKind" NOT NULL,
    "mode" "OperationalExecutionMode" NOT NULL,
    "status" "OperationalExecutionStatus" NOT NULL,
    "targetEnvironment" "OperationalTargetEnvironment",
    "provider" TEXT NOT NULL,
    "actorUserEmail" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "providerOperationId" TEXT,
    "targetReference" TEXT,
    "reportPath" TEXT,
    "metadata" JSONB,
    "operationalIntegrationId" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalProofArtifact" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "kind" "OperationalProofArtifactKind" NOT NULL,
    "label" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalProofArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperationalExecution_kind_completedAt_idx" ON "OperationalExecution"("kind", "completedAt");

-- CreateIndex
CREATE INDEX "OperationalExecution_targetEnvironment_completedAt_idx" ON "OperationalExecution"("targetEnvironment", "completedAt");

-- CreateIndex
CREATE INDEX "OperationalExecution_provider_completedAt_idx" ON "OperationalExecution"("provider", "completedAt");

-- CreateIndex
CREATE INDEX "OperationalExecution_operationalIntegrationId_completedAt_idx" ON "OperationalExecution"("operationalIntegrationId", "completedAt");

-- CreateIndex
CREATE INDEX "OperationalProofArtifact_executionId_kind_idx" ON "OperationalProofArtifact"("executionId", "kind");

-- AddForeignKey
ALTER TABLE "OperationalExecution" ADD CONSTRAINT "OperationalExecution_operationalIntegrationId_fkey" FOREIGN KEY ("operationalIntegrationId") REFERENCES "OperationalIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalProofArtifact" ADD CONSTRAINT "OperationalProofArtifact_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "OperationalExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
