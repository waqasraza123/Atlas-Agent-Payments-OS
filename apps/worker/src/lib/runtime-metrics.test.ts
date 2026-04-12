import { describe, expect, it, beforeEach } from "vitest";
import {
  getWorkerRuntimeMetricsSnapshot,
  recordWorkerQueueFailed,
  recordWorkerQueueProcessed,
  recordWorkerQueueReady,
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

    const snapshot = getWorkerRuntimeMetricsSnapshot();
    const queue = snapshot.queues[0];

    expect(queue).toMatchObject({
      key: "payments-execution",
      readyCount: 1,
      processedCount: 1,
      failedCount: 1
    });
    expect(queue?.lastProcessedAt).toEqual(expect.any(String));
    expect(queue?.lastFailedAt).toEqual(expect.any(String));
  });
});
