import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { listAtlasQueueDefinitions } from "@atlas/domain";
import { log } from "./lib/logger";
import { createRedisConnection } from "./lib/redis";
import { getAtlasQueueProcessor } from "./processors";

type AtlasQueueBinding = {
  key: string;
  name: string;
  queue: Queue;
  worker: Worker;
};

function createQueueBindings(connection: ConnectionOptions): AtlasQueueBinding[] {
  return listAtlasQueueDefinitions().map((definition) => {
    const queue = new Queue(definition.name, {
      connection,
      defaultJobOptions: {
        attempts: definition.defaultAttempts,
        backoff: {
          type: "exponential",
          delay: definition.backoffDelayMs
        },
        removeOnComplete: 100,
        removeOnFail: 500
      }
    });
    const worker = new Worker(definition.name, getAtlasQueueProcessor(definition.key), {
      connection
    });

    worker.on("ready", () => {
      log(`queue processor ready for ${definition.name}`, {
        family: definition.family,
        queueKey: definition.key
      });
    });

    worker.on("failed", (job, error) => {
      log("queue job failed", {
        queueKey: definition.key,
        queueName: definition.name,
        jobId: job?.id,
        error: error.message
      });
    });

    worker.on("error", (error) => {
      log("worker error", {
        queueKey: definition.key,
        queueName: definition.name,
        error: error.message
      });
    });

    return {
      key: definition.key,
      name: definition.name,
      queue,
      worker
    };
  });
}

async function main() {
  const connection = createRedisConnection();
  const bindings = createQueueBindings(connection);

  async function shutdown() {
    await Promise.all(bindings.map(async (binding) => binding.worker.close()));
    await Promise.all(bindings.map(async (binding) => binding.queue.close()));
    await connection.quit();
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  log("booting worker", {
    queues: bindings.map((binding) => binding.name)
  });
}

void main().catch((error) => {
  log("worker bootstrap failed", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
