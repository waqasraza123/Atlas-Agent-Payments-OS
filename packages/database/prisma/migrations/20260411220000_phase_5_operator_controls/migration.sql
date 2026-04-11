CREATE TYPE "OperatorCaseCategory" AS ENUM (
  'PAYMENT_FAILURE',
  'PAYMENT_RETRY_EXHAUSTED',
  'SETTLEMENT_DELAY',
  'SELLER_CONFIRMATION_DELAY',
  'RECEIPT_FAILURE',
  'RECEIPT_PENDING',
  'REQUEST_PAUSED'
);

CREATE TYPE "OperatorCaseSeverity" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

CREATE TYPE "OperatorCaseStatus" AS ENUM (
  'OPEN',
  'INVESTIGATING',
  'ACTION_REQUIRED',
  'RESOLVED',
  'CLOSED'
);

CREATE TYPE "OperatorActionType" AS ENUM (
  'PAUSE_REQUEST',
  'RELEASE_REQUEST',
  'REQUEUE_PAYMENT',
  'ANNOTATE_CASE',
  'RESOLVE_CASE'
);

CREATE TYPE "NotificationStatus" AS ENUM (
  'UNREAD',
  'READ'
);

CREATE TABLE "OperatorCase" (
  "id" TEXT NOT NULL,
  "caseKey" TEXT NOT NULL,
  "organizationId" TEXT,
  "requestId" TEXT,
  "category" "OperatorCaseCategory" NOT NULL,
  "severity" "OperatorCaseSeverity" NOT NULL,
  "status" "OperatorCaseStatus" NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "resolutionReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperatorCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperatorAction" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actionType" "OperatorActionType" NOT NULL,
  "reason" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperatorAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "organizationId" TEXT,
  "caseId" TEXT,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperatorCase_caseKey_key" ON "OperatorCase"("caseKey");
CREATE INDEX "OperatorCase_status_severity_category_idx" ON "OperatorCase"("status", "severity", "category");
CREATE INDEX "OperatorCase_organizationId_status_idx" ON "OperatorCase"("organizationId", "status");

CREATE INDEX "OperatorAction_caseId_createdAt_idx" ON "OperatorAction"("caseId", "createdAt");

CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
CREATE INDEX "Notification_organizationId_status_idx" ON "Notification"("organizationId", "status");

ALTER TABLE "OperatorCase"
ADD CONSTRAINT "OperatorCase_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OperatorCase"
ADD CONSTRAINT "OperatorCase_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "SpendRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OperatorAction"
ADD CONSTRAINT "OperatorAction_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "OperatorCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OperatorAction"
ADD CONSTRAINT "OperatorAction_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "OperatorCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
