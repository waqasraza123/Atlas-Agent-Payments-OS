ALTER TYPE "OperationalIntegrationKind" ADD VALUE 'ALERT_DISPATCH';

CREATE TABLE "ObservabilitySnapshot" (
    "id" TEXT NOT NULL,
    "appEnv" TEXT NOT NULL,
    "releaseStage" TEXT NOT NULL,
    "actorUserEmail" TEXT NOT NULL,
    "configurationStatus" TEXT NOT NULL,
    "readinessStatus" TEXT NOT NULL,
    "totalRequests" INTEGER NOT NULL,
    "errorCount" INTEGER NOT NULL,
    "activeAlertCount" INTEGER NOT NULL,
    "criticalAlertCount" INTEGER NOT NULL,
    "reportPath" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "storageProvider" TEXT,
    "storageBucket" TEXT,
    "storageKey" TEXT,
    "storageUrl" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ObservabilitySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ObservabilityAlertDispatch" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "mode" "OperationalExecutionMode" NOT NULL,
    "status" "OperationalExecutionStatus" NOT NULL,
    "minimumSeverity" TEXT NOT NULL,
    "actorUserEmail" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "targetReference" TEXT,
    "reportPath" TEXT NOT NULL,
    "dispatchedAlertCount" INTEGER NOT NULL,
    "criticalAlertCount" INTEGER NOT NULL,
    "warningAlertCount" INTEGER NOT NULL,
    "infoAlertCount" INTEGER NOT NULL,
    "payload" JSONB,
    "operationalIntegrationId" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ObservabilityAlertDispatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ObservabilitySnapshot_createdAt_idx" ON "ObservabilitySnapshot"("createdAt");
CREATE INDEX "ObservabilitySnapshot_expiresAt_idx" ON "ObservabilitySnapshot"("expiresAt");
CREATE INDEX "ObservabilitySnapshot_appEnv_createdAt_idx" ON "ObservabilitySnapshot"("appEnv", "createdAt");

CREATE INDEX "ObservabilityAlertDispatch_completedAt_idx" ON "ObservabilityAlertDispatch"("completedAt");
CREATE INDEX "ObservabilityAlertDispatch_provider_completedAt_idx" ON "ObservabilityAlertDispatch"("provider", "completedAt");
CREATE INDEX "ObservabilityAlertDispatch_operationalIntegrationId_completedAt_idx" ON "ObservabilityAlertDispatch"("operationalIntegrationId", "completedAt");

ALTER TABLE "ObservabilityAlertDispatch" ADD CONSTRAINT "ObservabilityAlertDispatch_operationalIntegrationId_fkey" FOREIGN KEY ("operationalIntegrationId") REFERENCES "OperationalIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
