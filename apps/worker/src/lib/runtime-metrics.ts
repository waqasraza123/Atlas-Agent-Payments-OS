import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deploymentRuntime, observabilityRuntime } from "@atlas/config";
import type { AtlasWorkerQueueRuntimeMetricRecord, AtlasWorkerRuntimeMetricsSnapshot } from "@atlas/domain";

const workerRuntimeMetricsState = {
  startedAt: new Date().toISOString(),
  queues: new Map<string, AtlasWorkerQueueRuntimeMetricRecord>()
};

function roundMetric(value: number) {
  return Number(value.toFixed(2));
}

function canPublishRuntimeSnapshot() {
  return process.env.NODE_ENV !== "test";
}

function resolveRuntimeSnapshotPath(fileName: string) {
  return resolve(import.meta.dirname, "../../..", observabilityRuntime.runtimeSnapshotDirectory, fileName);
}

function publishWorkerRuntimeMetricsSnapshot() {
  if (!canPublishRuntimeSnapshot()) {
    return;
  }

  const filePath = resolveRuntimeSnapshotPath("worker.json");
  mkdirSync(dirname(filePath), {
    recursive: true
  });
  writeFileSync(filePath, `${JSON.stringify(getWorkerRuntimeMetricsSnapshot(), null, 2)}\n`, "utf8");
}

function getQueueMetricRecord(key: string, name: string) {
  const existing = workerRuntimeMetricsState.queues.get(key);

  if (existing) {
    return existing;
  }

  const created: AtlasWorkerQueueRuntimeMetricRecord = {
    key,
    name,
    readyCount: 0,
    processedCount: 0,
    failedCount: 0,
    lastProcessedAt: null,
    lastFailedAt: null
  };

  workerRuntimeMetricsState.queues.set(key, created);
  return created;
}

export function recordWorkerQueueReady(key: string, name: string) {
  const record = getQueueMetricRecord(key, name);
  record.readyCount += 1;
  publishWorkerRuntimeMetricsSnapshot();
}

export function recordWorkerQueueProcessed(key: string, name: string) {
  const record = getQueueMetricRecord(key, name);
  record.processedCount += 1;
  record.lastProcessedAt = new Date().toISOString();
  publishWorkerRuntimeMetricsSnapshot();
}

export function recordWorkerQueueFailed(key: string, name: string) {
  const record = getQueueMetricRecord(key, name);
  record.failedCount += 1;
  record.lastFailedAt = new Date().toISOString();
  publishWorkerRuntimeMetricsSnapshot();
}

export function getWorkerRuntimeMetricsSnapshot(): AtlasWorkerRuntimeMetricsSnapshot {
  const startedAt = new Date(workerRuntimeMetricsState.startedAt);
  const queues = Array.from(workerRuntimeMetricsState.queues.values()).sort((left, right) =>
    left.key.localeCompare(right.key)
  );

  return {
    service: "worker",
    startedAt: workerRuntimeMetricsState.startedAt,
    recordedAt: new Date().toISOString(),
    uptimeSeconds: roundMetric((Date.now() - startedAt.getTime()) / 1000),
    revision: deploymentRuntime.revision,
    deploymentSlot: deploymentRuntime.deploymentSlot,
    queueCount: queues.length,
    readyQueueCount: queues.filter((queue) => queue.readyCount > 0).length,
    processedCount: queues.reduce((total, queue) => total + queue.processedCount, 0),
    failedCount: queues.reduce((total, queue) => total + queue.failedCount, 0),
    queues
  };
}

export function resetWorkerRuntimeMetrics() {
  workerRuntimeMetricsState.startedAt = new Date().toISOString();
  workerRuntimeMetricsState.queues.clear();
  publishWorkerRuntimeMetricsSnapshot();
}

publishWorkerRuntimeMetricsSnapshot();
