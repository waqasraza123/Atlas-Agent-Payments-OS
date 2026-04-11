import type { Job } from "bullmq";

export async function processAuditProjectionQueueJob(job: Job) {
  return {
    queue: job.queueName,
    jobId: job.id,
    processedAt: new Date().toISOString(),
    family: "audit-projections"
  };
}
