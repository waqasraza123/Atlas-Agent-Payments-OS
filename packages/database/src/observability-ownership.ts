import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { appRuntime, deploymentRuntime, observabilityRuntime } from "@atlas/config";
import type {
  AtlasObservabilityTelemetryOwnershipRecord,
  AtlasObservabilityTelemetryOwnershipSampleRecord,
  AtlasObservabilityTelemetryOwnershipTrendRecord,
  AtlasObservabilityTelemetryOwnershipWindowRecord
} from "@atlas/domain";

const telemetryOwnershipLabels: Record<AtlasObservabilityTelemetryOwnershipRecord["key"], string> = {
  "api-runtime": "API runtime telemetry",
  "worker-runtime": "Worker runtime telemetry",
  "automation-cadence": "Automation cadence"
};

function resolveOwnershipHistoryPath(...segments: string[]) {
  const baseDirectory = (() => {
    if (process.env.NODE_ENV !== "test" || process.env.OBSERVABILITY_OWNERSHIP_HISTORY_DIR) {
      return resolve(import.meta.dirname, "../../..", observabilityRuntime.ownershipHistoryDirectory);
    }

    if (process.env.OBSERVABILITY_AUTOMATION_REPORT_DIR) {
      return resolve(import.meta.dirname, "../../..", observabilityRuntime.automationReportDirectory, ".ownership-history");
    }

    if (process.env.OBSERVABILITY_REMEDIATION_REPORT_DIR) {
      return resolve(import.meta.dirname, "../../..", observabilityRuntime.remediationReportDirectory, ".ownership-history");
    }

    if (process.env.OBSERVABILITY_RUNTIME_SNAPSHOT_DIR) {
      return resolve(import.meta.dirname, "../../..", observabilityRuntime.runtimeSnapshotDirectory, ".ownership-history");
    }

    return resolve(import.meta.dirname, "../../..", observabilityRuntime.ownershipHistoryDirectory);
  })();

  return resolve(baseDirectory, ...segments);
}

function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function collectJsonArtifactFiles(directoryPath: string): string[] {
  try {
    const entries = readdirSync(directoryPath, {
      withFileTypes: true
    });
    const filePaths: string[] = [];

    for (const entry of entries) {
      const childPath = resolve(directoryPath, entry.name);

      if (entry.isDirectory()) {
        filePaths.push(...collectJsonArtifactFiles(childPath));
        continue;
      }

      if (entry.isFile() && childPath.endsWith(".json")) {
        filePaths.push(childPath);
      }
    }

    return filePaths;
  } catch {
    return [];
  }
}

function createSampleFileName(recordedAt: string, key: AtlasObservabilityTelemetryOwnershipRecord["key"]) {
  return `${recordedAt.replace(/[:.]/g, "-")}-${key}.json`;
}

function formatAgeLabel(minutes: number) {
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function calculateAgeMinutes(now: Date, recordedAt: string | null) {
  if (!recordedAt) {
    return null;
  }

  return Math.max(0, Math.round((now.getTime() - new Date(recordedAt).getTime()) / 60000));
}

function deriveStaleStatus(ageMinutes: number, staleAfterMinutes: number) {
  return ageMinutes <= staleAfterMinutes * 2 ? "warning" : "critical";
}

export function createTelemetryOwnershipSample(input: {
  key: AtlasObservabilityTelemetryOwnershipRecord["key"];
  status: AtlasObservabilityTelemetryOwnershipRecord["status"];
  recordedAt?: string;
  source: AtlasObservabilityTelemetryOwnershipSampleRecord["source"];
  detail: string;
  traceId?: string | null;
  deploymentSlot?: string | null;
}): AtlasObservabilityTelemetryOwnershipSampleRecord {
  return {
    key: input.key,
    label: telemetryOwnershipLabels[input.key],
    status: input.status,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
    source: input.source,
    deploymentSlot: input.deploymentSlot ?? deploymentRuntime.deploymentSlot,
    releaseStage: appRuntime.releaseStage,
    traceId: input.traceId ?? null,
    detail: input.detail
  };
}

export function appendTelemetryOwnershipSample(sample: AtlasObservabilityTelemetryOwnershipSampleRecord) {
  const filePath = resolveOwnershipHistoryPath(sample.key, createSampleFileName(sample.recordedAt, sample.key));

  mkdirSync(dirname(filePath), {
    recursive: true
  });
  writeFileSync(filePath, `${JSON.stringify(sample, null, 2)}\n`, "utf8");

  return {
    filePath,
    sample
  };
}

export function listTelemetryOwnershipSamples(
  options: {
    limit?: number;
    key?: AtlasObservabilityTelemetryOwnershipRecord["key"];
  } = {}
) {
  const baseDirectory =
    options.key === undefined
      ? resolveOwnershipHistoryPath()
      : resolveOwnershipHistoryPath(options.key);

  return collectJsonArtifactFiles(baseDirectory)
    .map((filePath) => readJsonFile<AtlasObservabilityTelemetryOwnershipSampleRecord>(filePath))
    .filter((item): item is AtlasObservabilityTelemetryOwnershipSampleRecord => item !== null)
    .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime())
    .slice(0, options.limit ?? 200);
}

function getLatestSample(
  samples: AtlasObservabilityTelemetryOwnershipSampleRecord[],
  key: AtlasObservabilityTelemetryOwnershipRecord["key"]
) {
  return samples.find((sample) => sample.key === key) ?? null;
}

function getSamplesForKey(
  samples: AtlasObservabilityTelemetryOwnershipSampleRecord[],
  key: AtlasObservabilityTelemetryOwnershipRecord["key"]
) {
  return samples
    .filter((sample) => sample.key === key)
    .sort((left, right) => new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime());
}

function findMostRecentHealthySample(samples: AtlasObservabilityTelemetryOwnershipSampleRecord[]) {
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    if (samples[index]?.status === "healthy") {
      return samples[index] ?? null;
    }
  }

  return null;
}

function findCurrentBreachStartedAt(
  samples: AtlasObservabilityTelemetryOwnershipSampleRecord[],
  staleAfterMinutes: number,
  now: Date
) {
  if (samples.length === 0) {
    return null;
  }

  const latestSample = samples[samples.length - 1] ?? null;

  if (!latestSample) {
    return null;
  }

  const latestAgeMinutes = calculateAgeMinutes(now, latestSample.recordedAt);

  if (latestAgeMinutes !== null && latestAgeMinutes > staleAfterMinutes && latestSample.status === "healthy") {
    return new Date(new Date(latestSample.recordedAt).getTime() + staleAfterMinutes * 60 * 1000).toISOString();
  }

  for (let index = samples.length - 1; index >= 0; index -= 1) {
    const sample = samples[index];

    if (!sample) {
      continue;
    }

    if (sample.status === "healthy") {
      const nextSample = samples[index + 1] ?? null;
      return nextSample?.recordedAt ?? null;
    }
  }

  return samples[0]?.recordedAt ?? null;
}

function deriveOwnershipRecord(
  key: AtlasObservabilityTelemetryOwnershipRecord["key"],
  samples: AtlasObservabilityTelemetryOwnershipSampleRecord[],
  staleAfterMinutes: number,
  now: Date,
  emptyDetail: string
) {
  const label = telemetryOwnershipLabels[key];
  const latestSample = samples[samples.length - 1] ?? null;

  if (!latestSample) {
    return {
      ownership: {
        key,
        label,
        status: "critical",
        detail: emptyDetail,
        lastRecordedAt: null
      } satisfies AtlasObservabilityTelemetryOwnershipRecord,
      window: {
        key,
        label,
        currentStatus: "critical",
        breachStartedAt: null,
        lastHealthyAt: null,
        lastRecoveredAt: null,
        currentBreachMinutes: null,
        latestSampleAt: null,
        sampleCountInWindow: 0,
        detail: emptyDetail
      } satisfies AtlasObservabilityTelemetryOwnershipWindowRecord
    };
  }

  const latestAgeMinutes = calculateAgeMinutes(now, latestSample.recordedAt) ?? 0;
  const currentStatus =
    latestAgeMinutes > staleAfterMinutes && latestSample.status === "healthy"
      ? deriveStaleStatus(latestAgeMinutes, staleAfterMinutes)
      : latestSample.status;
  const lastHealthyAt = findMostRecentHealthySample(samples)?.recordedAt ?? null;
  const breachStartedAt =
    currentStatus === "healthy" ? null : findCurrentBreachStartedAt(samples, staleAfterMinutes, now);
  const currentBreachMinutes =
    breachStartedAt === null ? null : Math.max(0, Math.round((now.getTime() - new Date(breachStartedAt).getTime()) / 60000));
  const lastRecoveredAt = (() => {
    for (let index = samples.length - 1; index > 0; index -= 1) {
      const current = samples[index];
      const previous = samples[index - 1];

      if (current?.status === "healthy" && previous && previous.status !== "healthy") {
        return current.recordedAt;
      }
    }

    return null;
  })();
  const detail =
    latestAgeMinutes > staleAfterMinutes && latestSample.status === "healthy"
      ? `Latest ownership sample is stale after ${formatAgeLabel(latestAgeMinutes)}.`
      : latestSample.detail;

  return {
    ownership: {
      key,
      label,
      status: currentStatus,
      detail,
      lastRecordedAt: latestSample.recordedAt
    } satisfies AtlasObservabilityTelemetryOwnershipRecord,
    window: {
      key,
      label,
      currentStatus,
      breachStartedAt,
      lastHealthyAt,
      lastRecoveredAt,
      currentBreachMinutes,
      latestSampleAt: latestSample.recordedAt,
      sampleCountInWindow: samples.length,
      detail
    } satisfies AtlasObservabilityTelemetryOwnershipWindowRecord
  };
}

export function deriveTelemetryOwnershipState(
  samples: AtlasObservabilityTelemetryOwnershipSampleRecord[],
  options: {
    now?: string;
  } = {}
) {
  const now = new Date(options.now ?? new Date().toISOString());
  const apiSamples = getSamplesForKey(samples, "api-runtime");
  const workerSamples = getSamplesForKey(samples, "worker-runtime");
  const automationSamples = getSamplesForKey(samples, "automation-cadence");
  const apiState = deriveOwnershipRecord(
    "api-runtime",
    apiSamples,
    Math.max(1, observabilityRuntime.apiOwnershipStaleAfterMinutes),
    now,
    "No published API runtime ownership sample is available for operators."
  );
  const workerState = deriveOwnershipRecord(
    "worker-runtime",
    workerSamples,
    Math.max(1, observabilityRuntime.workerOwnershipStaleAfterMinutes),
    now,
    "No published worker runtime ownership sample is available for operators."
  );
  const automationState = deriveOwnershipRecord(
    "automation-cadence",
    automationSamples,
    Math.max(1, observabilityRuntime.automationOwnershipStaleAfterMinutes),
    now,
    observabilityRuntime.automationScheduleMode === "interval"
      ? "No automation-cadence ownership sample has been recorded for the active schedule."
      : "Scheduled observability automation is disabled, so cadence depends on manual runs."
  );
  const latestOwnershipSamples = [apiState, workerState, automationState]
    .map(({ ownership }) => getLatestSample(samples, ownership.key))
    .filter((item): item is AtlasObservabilityTelemetryOwnershipSampleRecord => item !== null)
    .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime());
  const ownershipTrends = (["api-runtime", "worker-runtime", "automation-cadence"] as const).map((key) => {
    const keyedSamples = getSamplesForKey(samples, key);
    const transitions = keyedSamples
      .filter((sample, index) => index === 0 || keyedSamples[index - 1]?.status !== sample.status)
      .slice(-6)
      .map((sample) => ({
        recordedAt: sample.recordedAt,
        status: sample.status,
        source: sample.source
      }));

    return {
      key,
      label: telemetryOwnershipLabels[key],
      currentStatus: (key === "api-runtime"
        ? apiState.window.currentStatus
        : key === "worker-runtime"
          ? workerState.window.currentStatus
          : automationState.window.currentStatus) satisfies AtlasObservabilityTelemetryOwnershipRecord["status"],
      latestSampleAt: keyedSamples[keyedSamples.length - 1]?.recordedAt ?? null,
      transitions
    } satisfies AtlasObservabilityTelemetryOwnershipTrendRecord;
  });

  return {
    telemetryOwnership: [apiState.ownership, workerState.ownership, automationState.ownership],
    ownershipWindows: [apiState.window, workerState.window, automationState.window],
    ownershipTrends,
    latestOwnershipSamples
  };
}

export function pruneTelemetryOwnershipHistory(now = new Date()) {
  const cutoffTimestamp = new Date(
    now.getTime() - observabilityRuntime.ownershipHistoryRetentionDays * 24 * 60 * 60 * 1000
  ).getTime();
  let deletedCount = 0;

  for (const filePath of collectJsonArtifactFiles(resolveOwnershipHistoryPath())) {
    try {
      const stats = statSync(filePath);

      if (stats.mtimeMs < cutoffTimestamp) {
        rmSync(filePath, {
          force: true
        });
        deletedCount += 1;
      }
    } catch {}
  }

  return deletedCount;
}
