import { describe, expect, it, beforeEach } from "vitest";
import {
  getWorkerRuntimeMetricsSnapshot,
  recordWorkerQueueFailed,
  recordWorkerQueueProcessed,
  recordWorkerQueueReady,
  recordWorkerTrace,
  resetWorkerRuntimeMetrics
} from "./runtime-metrics";

describe("worker runtime metrics", () => {
  beforeEach(() => {
    resetWorkerRuntimeMetrics();
  });

  it("records queue readiness, processed jobs, and failures", () => {
    recordWorkerQueueReady("payments-execution", "atlas-phase-0-payments-execution");
    recordWorkerQueueProcessed("payments-execution", "atlas-phase-0-payments-execution");
    recordWorkerQueueFailed("payments-execution", "atlas-phase-0-payments-execution");
    recordWorkerTrace({
      traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      spanId: "bbbbbbbbbbbbbbbb",
      parentSpanId: "cccccccccccccccc",
      sourceService: "worker",
      origin: "job",
      name: "atlas-phase-0-payments-execution",
      status: "error",
      requestId: "request-1",
      method: null,
      path: null,
      queueKey: "payments-execution",
      queueName: "atlas-phase-0-payments-execution",
      jobId: "job-1",
      attempt: 1,
      startedAt: "2026-04-13T00:00:00.000Z",
      endedAt: "2026-04-13T00:00:01.000Z",
      durationMs: 1000
    });

    const snapshot = getWorkerRuntimeMetricsSnapshot();
    const queue = snapshot.queues[0];

    expect(snapshot).toMatchObject({
      service: "worker",
      queueCount: 1,
      readyQueueCount: 1,
      processedCount: 1,
      failedCount: 1,
      traceCount: 1,
      traceCoverageRate: 0.5
    });
    expect(queue).toMatchObject({
      key: "payments-execution",
      readyCount: 1,
      processedCount: 1,
      failedCount: 1
    });
    expect(snapshot.recentTraces[0]).toMatchObject({
      traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      sourceService: "worker"
    });
    expect(queue?.lastProcessedAt).toEqual(expect.any(String));
    expect(queue?.lastFailedAt).toEqual(expect.any(String));
  });
});
