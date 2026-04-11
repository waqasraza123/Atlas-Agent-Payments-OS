import type { Processor } from "bullmq";
import type { AtlasQueueKey } from "@atlas/domain";
import { processApprovalQueueJob } from "./approvals.processor";
import { processAuditProjectionQueueJob } from "./audit-projections.processor";
import { processNotificationQueueJob } from "./notifications.processor";
import { processPaymentQueueJob } from "./payments.processor";
import { processSellerWebhookQueueJob } from "./seller-webhooks.processor";

const atlasQueueProcessors: Record<AtlasQueueKey, Processor> = {
  "approvals-routing": processApprovalQueueJob,
  "approvals-reminders": processApprovalQueueJob,
  "notifications-dispatch": processNotificationQueueJob,
  "payments-execution": processPaymentQueueJob,
  "seller-webhooks-delivery": processSellerWebhookQueueJob,
  "audit-projections-refresh": processAuditProjectionQueueJob
};

export function getAtlasQueueProcessor(key: AtlasQueueKey) {
  return atlasQueueProcessors[key];
}

export function listAtlasQueueProcessors() {
  return atlasQueueProcessors;
}
