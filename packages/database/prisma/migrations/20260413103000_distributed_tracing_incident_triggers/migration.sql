CREATE TABLE "ObservabilityIncidentTrigger" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "appEnv" TEXT NOT NULL,
    "releaseStage" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "alertIds" JSONB NOT NULL,
    "traceIds" JSONB NOT NULL,
    "actorUserEmail" TEXT NOT NULL,
    "reportPath" TEXT NOT NULL,
    "payload" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObservabilityIncidentTrigger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ObservabilityIncidentTrigger_dedupeKey_key" ON "ObservabilityIncidentTrigger"("dedupeKey");
CREATE INDEX "ObservabilityIncidentTrigger_status_createdAt_idx" ON "ObservabilityIncidentTrigger"("status", "createdAt");
CREATE INDEX "ObservabilityIncidentTrigger_appEnv_status_updatedAt_idx" ON "ObservabilityIncidentTrigger"("appEnv", "status", "updatedAt");
