type WorkerQueueMetricRecord = {
  key: string;
  name: string;
  readyCount: number;
  processedCount: number;
  failedCount: number;
  lastProcessedAt: string | null;
  lastFailedAt: string | null;
};

const workerRuntimeMetricsState = {
  startedAt: new Date().toISOString(),
  queues: new Map<string, WorkerQueueMetricRecord>()
};

function getQueueMetricRecord(key: string, name: string) {
  const existing = workerRuntimeMetricsState.queues.get(key);

  if (existing) {
    return existing;
  }

  const created: WorkerQueueMetricRecord = {
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
}

export function recordWorkerQueueProcessed(key: string, name: string) {
  const record = getQueueMetricRecord(key, name);
  record.processedCount += 1;
  record.lastProcessedAt = new Date().toISOString();
}

export function recordWorkerQueueFailed(key: string, name: string) {
  const record = getQueueMetricRecord(key, name);
  record.failedCount += 1;
  record.lastFailedAt = new Date().toISOString();
}

export function getWorkerRuntimeMetricsSnapshot() {
  return {
    startedAt: workerRuntimeMetricsState.startedAt,
    queues: Array.from(workerRuntimeMetricsState.queues.values()).sort((left, right) =>
      left.key.localeCompare(right.key)
    )
  };
}

export function resetWorkerRuntimeMetrics() {
  workerRuntimeMetricsState.startedAt = new Date().toISOString();
  workerRuntimeMetricsState.queues.clear();
}
