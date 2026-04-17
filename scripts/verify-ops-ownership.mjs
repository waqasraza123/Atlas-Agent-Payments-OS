import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function collectJsonArtifactFiles(directoryPath) {
  try {
    const entries = readdirSync(directoryPath, {
      withFileTypes: true
    });
    const filePaths = [];

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

function readLatestSample(baseDirectory, key) {
  const directoryPath = resolve(baseDirectory, key);
  const files = collectJsonArtifactFiles(directoryPath).sort(
    (left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs
  );
  const latestFile = files[0];

  if (!latestFile || !existsSync(latestFile)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(latestFile, "utf8"));
  } catch {
    return null;
  }
}

function assertFreshSample(baseDirectory, key, staleAfterMinutes) {
  const sample = readLatestSample(baseDirectory, key);

  if (!sample || typeof sample.recordedAt !== "string") {
    throw new Error(`Missing ${key} ownership sample.`);
  }

  const ageMinutes = Math.max(0, Math.round((Date.now() - new Date(sample.recordedAt).getTime()) / 60000));

  if (ageMinutes > staleAfterMinutes) {
    throw new Error(`${key} ownership sample is stale after ${ageMinutes} minutes.`);
  }
}

const ownershipHistoryDirectory = resolve(
  process.cwd(),
  process.env.OBSERVABILITY_OWNERSHIP_HISTORY_DIR ?? "operations-artifacts/observability/ownership-history"
);

assertFreshSample(
  ownershipHistoryDirectory,
  "api-runtime",
  Math.max(1, readNumber(process.env.OBSERVABILITY_API_OWNERSHIP_STALE_AFTER_MINUTES, 10))
);

const shouldCheckWorker =
  process.env.VERIFY_OPS_EXPECT_WORKER === "true" ||
  existsSync(resolve(process.cwd(), process.env.OBSERVABILITY_RUNTIME_SNAPSHOT_DIR ?? "operations-artifacts/observability/runtime", "worker.json"));

if (shouldCheckWorker) {
  assertFreshSample(
    ownershipHistoryDirectory,
    "worker-runtime",
    Math.max(1, readNumber(process.env.OBSERVABILITY_WORKER_OWNERSHIP_STALE_AFTER_MINUTES, 10))
  );
}

if ((process.env.OBSERVABILITY_AUTOMATION_SCHEDULE_MODE ?? "disabled") === "interval") {
  assertFreshSample(
    ownershipHistoryDirectory,
    "automation-cadence",
    Math.max(
      1,
      readNumber(
        process.env.OBSERVABILITY_AUTOMATION_OWNERSHIP_STALE_AFTER_MINUTES,
        readNumber(process.env.OBSERVABILITY_AUTOMATION_INTERVAL_MINUTES, 15) * 2
      )
    )
  );
}
