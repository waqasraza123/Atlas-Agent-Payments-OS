ALTER TABLE "ExternalIdentityAssignment"
ADD COLUMN "providerSubject" TEXT,
ADD COLUMN "upstreamUserId" TEXT,
ADD COLUMN "upstreamAssignmentId" TEXT,
ADD COLUMN "upstreamTargetRef" TEXT,
ADD COLUMN "upstreamStatus" TEXT,
ADD COLUMN "lastUpstreamSyncedAt" TIMESTAMP(3);
