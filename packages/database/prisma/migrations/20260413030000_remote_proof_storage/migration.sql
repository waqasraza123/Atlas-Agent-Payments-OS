ALTER TYPE "OperationalIntegrationKind" ADD VALUE 'PROOF_STORAGE';

ALTER TABLE "OperationalProofArtifact"
ADD COLUMN     "storageProvider" TEXT,
ADD COLUMN     "storageBucket" TEXT,
ADD COLUMN     "storageKey" TEXT,
ADD COLUMN     "storageUrl" TEXT;

CREATE INDEX "OperationalProofArtifact_storageBucket_storageKey_idx" ON "OperationalProofArtifact"("storageBucket", "storageKey");
