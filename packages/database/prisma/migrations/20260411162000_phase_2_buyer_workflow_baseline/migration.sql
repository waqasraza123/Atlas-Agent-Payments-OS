ALTER TABLE "Policy"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "SpendRequest"
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "purpose" TEXT NOT NULL DEFAULT '',
ADD COLUMN "evaluationResult" JSONB;

CREATE UNIQUE INDEX "SpendRequest_organizationId_idempotencyKey_key"
ON "SpendRequest"("organizationId", "idempotencyKey");
