CREATE TYPE "PaymentRail" AS ENUM ('INTERNAL_SIMULATED', 'STRIPE');

ALTER TABLE "Payment"
ADD COLUMN "rail" "PaymentRail" NOT NULL DEFAULT 'INTERNAL_SIMULATED';

UPDATE "Payment"
SET "rail" = CASE
  WHEN LOWER("provider") = 'stripe' THEN 'STRIPE'::"PaymentRail"
  ELSE 'INTERNAL_SIMULATED'::"PaymentRail"
END;

CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "rail" "PaymentRail" NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "reference" TEXT,
    "evidence" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentAttempt_paymentId_attemptNumber_key" ON "PaymentAttempt"("paymentId", "attemptNumber");

CREATE INDEX "PaymentAttempt_rail_status_idx" ON "PaymentAttempt"("rail", "status");

ALTER TABLE "PaymentAttempt"
ADD CONSTRAINT "PaymentAttempt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
