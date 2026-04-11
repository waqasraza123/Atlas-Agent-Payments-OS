import type { Job } from "bullmq";

export async function processDemoRequest(job: Job) {
  return {
    jobId: job.id,
    processedAt: new Date().toISOString()
  };
}
