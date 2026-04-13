import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { listAtlasQueueDefinitions } from "@atlas/domain";
import { workerEnv } from "./env";
import { log } from "./lib/logger";
import { createRedisConnection } from "./lib/redis";
import { createWorkerJobTraceContext } from "./lib/trace-context";
import {
  getWorkerRuntimeMetricsSnapshot,
  recordWorkerQueueFailed,
  recordWorkerQueueProcessed,
  recordWorkerQueueReady,
  recordWorkerTrace
} from "./lib/runtime-metrics";
import { getAtlasQueueProcessor } from "./processors";

type AtlasQueueBinding = {
  key: string;
  name: string;
  queue: Queue;
  worker: Worker;
};

function createQueueBindings(connection: ConnectionOptions): AtlasQueueBinding[] {
  return listAtlasQueueDefinitions().map((definition) => {
    const processor = getAtlasQueueProcessor(definition.key);
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
    const worker = new Worker(
      definition.name,
      async (job, token) => {
        const traceContext = createWorkerJobTraceContext(job);
        const startedAtIso = new Date().toISOString();
        const startedAt = Date.now();

        try {
          const result = await processor(job, token);
          recordWorkerQueueProcessed(definition.key, definition.name);
          recordWorkerTrace({
            traceId: traceContext.traceId,
            spanId: traceContext.spanId,
            parentSpanId: traceContext.parentSpanId,
            sourceService: "worker",
            origin: "job",
            name: definition.name,
            status: "ok",
            requestId: traceContext.requestId,
            method: null,
            path: null,
            queueKey: definition.key,
            queueName: definition.name,
            jobId: job.id?.toString() ?? null,
            attempt: job.attemptsStarted,
            startedAt: startedAtIso,
            endedAt: new Date().toISOString(),
            durationMs: Date.now() - startedAt
          });
          return result;
        } catch (error) {
          recordWorkerQueueFailed(definition.key, definition.name);
          recordWorkerTrace({
            traceId: traceContext.traceId,
            spanId: traceContext.spanId,
            parentSpanId: traceContext.parentSpanId,
            sourceService: "worker",
            origin: "job",
            name: definition.name,
            status: "error",
            requestId: traceContext.requestId,
            method: null,
            path: null,
            queueKey: definition.key,
            queueName: definition.name,
            jobId: job.id?.toString() ?? null,
            attempt: job.attemptsStarted,
            startedAt: startedAtIso,
            endedAt: new Date().toISOString(),
            durationMs: Date.now() - startedAt
          });
          throw error;
        }
      },
      {
        connection
      }
    );

    worker.on("ready", () => {
      recordWorkerQueueReady(definition.key, definition.name);
      log(`queue processor ready for ${definition.name}`, {
        family: definition.family,
        queueKey: definition.key
      });
    });

    worker.on("failed", (job, error) => {
      const tracePayload =
        job?.data && typeof job.data === "object" && !Array.isArray(job.data)
          ? ((job.data as Record<string, unknown>).trace as { traceId?: unknown } | undefined)
          : undefined;
      log("queue job failed", {
        queueKey: definition.key,
        queueName: definition.name,
        jobId: job?.id,
        traceId: typeof tracePayload?.traceId === "string" ? tracePayload.traceId : null,
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
  await connection.ping();
  const bindings = createQueueBindings(connection);
  await Promise.all(bindings.flatMap((binding) => [binding.queue.waitUntilReady(), binding.worker.waitUntilReady()]));

  async function shutdown(signal: string) {
    log("worker.shutdown.started", {
      signal,
      queueCount: bindings.length
    });
    await Promise.all(bindings.map(async (binding) => binding.worker.close()));
    await Promise.all(bindings.map(async (binding) => binding.queue.close()));
    await connection.quit();
    log("worker.shutdown.completed", {
      signal,
      metrics: getWorkerRuntimeMetricsSnapshot()
    });
    process.exit(0);
  }

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  log("worker.bootstrap.completed", {
    redisUrl: connection.options.host ? `${connection.options.host}:${connection.options.port}` : "configured",
    queues: bindings.map((binding) => binding.name),
    deploymentSlot: workerEnv.deploymentSlot,
    revision: workerEnv.revision,
    requiredVariables: workerEnv.requiredVariables.length,
    metrics: getWorkerRuntimeMetricsSnapshot()
  });
}

void main().catch((error) => {
  log("worker.bootstrap.failed", {
    error: error instanceof Error ? error.message : String(error)
  }, "error");
  process.exit(1);
});
