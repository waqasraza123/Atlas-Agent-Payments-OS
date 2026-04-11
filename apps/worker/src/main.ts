import { Queue, Worker } from "bullmq";
import { queueCatalog } from "./queues/catalog";
import { createRedisConnection } from "./lib/redis";
import { log } from "./lib/logger";
import { processDemoRequest } from "./processors/demo-request.processor";

const connection = createRedisConnection();
const queue = new Queue(queueCatalog.demoRequests, { connection });
const worker = new Worker(queueCatalog.demoRequests, processDemoRequest, { connection });

worker.on("ready", () => {
  log(`queue processor ready for ${queue.name}`);
});

worker.on("failed", (job, error) => {
  log("queue job failed", {
    jobId: job?.id,
    error: error.message
  });
});

worker.on("error", (error) => {
  log("worker error", error.message);
});

async function shutdown() {
  await worker.close();
  await queue.close();
  await connection.quit();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

log("booting worker");
