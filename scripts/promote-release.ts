import { readFileSync } from "node:fs";
import {
  assertAtlasPromotionReadiness,
  canAtlasPromoteEnvironment,
  type AtlasRestoreDrillReport,
  type AtlasSecretRotationExecutionReport,
  type AtlasSecretRotationManifest,
  type AtlasPromotionTarget,
  type AtlasRuntimeService
} from "../packages/config/src/index.ts";
import { createAtlasPromotionBundle, executeAtlasPromotionAutomation } from "../packages/database/src/rollout-automation.ts";
import { parseEnvFile } from "./lib/env-file";

function readArgumentValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function asPromotionTarget(value: string | null, fallback: AtlasPromotionTarget): AtlasPromotionTarget {
  if (!value) {
    return fallback;
  }

  if (value === "development" || value === "staging" || value === "production") {
    return value;
  }

  throw new Error(`Unsupported environment '${value}'. Expected development, staging, or production.`);
}

function resolveServices(value: string | null): AtlasRuntimeService[] {
  if (!value || value === "all") {
    return ["api", "web", "worker"];
  }

  const services = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (services.every((service) => service === "api" || service === "web" || service === "worker")) {
    return services;
  }

  throw new Error(`Unsupported service list '${value}'. Expected api, web, worker, or all.`);
}

function resolveEnvironmentExampleFile(target: AtlasPromotionTarget) {
  return target === "development" ? ".env.development.example" : target === "staging" ? ".env.staging.example" : ".env.production.example";
}

function resolveProofPath(argumentFlag: string, environmentVariable: string) {
  return readArgumentValue(argumentFlag) ?? process.env[environmentVariable] ?? null;
}

function readJsonFile<T>(filePath: string) {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

async function main() {
  const fromEnv = asPromotionTarget(readArgumentValue("--from"), "development");
  const toEnv = asPromotionTarget(readArgumentValue("--to"), "staging");
  const envFile = readArgumentValue("--file") ?? resolveEnvironmentExampleFile(toEnv);
  const services = resolveServices(readArgumentValue("--services"));
  const restoreReportPath = resolveProofPath("--restore-report", "ATLAS_RESTORE_DRILL_REPORT");
  const secretRotationExecutionReportPath = resolveProofPath(
    "--rotation-report",
    "ATLAS_SECRET_ROTATION_REPORT"
  );
  const secretRotationManifestPath = resolveProofPath("--rotation-manifest", "ATLAS_SECRET_ROTATION_MANIFEST");

  if (!canAtlasPromoteEnvironment(fromEnv, toEnv)) {
    throw new Error(`Promotion from ${fromEnv} to ${toEnv} is not allowed. Promotions must advance one stage at a time.`);
  }

  const environment = {
    ...process.env,
    ...parseEnvFile(envFile),
    APP_ENV: toEnv
  };
  assertAtlasPromotionReadiness(toEnv, environment);

  if (!restoreReportPath || (!secretRotationExecutionReportPath && !secretRotationManifestPath)) {
    throw new Error(
      `Promotion to ${toEnv} requires --restore-report and either --rotation-report or --rotation-manifest, or the matching env vars.`
    );
  }

  const restoreDrillReport = readJsonFile<AtlasRestoreDrillReport>(restoreReportPath);
  const secretRotationExecutionReport = secretRotationExecutionReportPath
    ? readJsonFile<AtlasSecretRotationExecutionReport>(secretRotationExecutionReportPath)
    : undefined;
  const secretRotationManifest = secretRotationExecutionReport
    ? secretRotationExecutionReport.manifest
    : readJsonFile<AtlasSecretRotationManifest>(secretRotationManifestPath as string);

  const bundle = createAtlasPromotionBundle({
    fromEnv,
    toEnv,
    services,
    envFile,
    environment,
    restoreReportPath,
    restoreDrillReport,
    secretRotationExecutionReportPath,
    secretRotationExecutionReport,
    secretRotationManifestPath,
    secretRotationManifest
  });

  const promotionExecution = await executeAtlasPromotionAutomation({
    fromEnv,
    toEnv,
    services,
    restoreDrillReport,
    secretRotationManifest,
    secretRotationExecutionReport,
    environment,
    bundlePath: bundle.promotionBundlePath
  });

  process.stdout.write(
    `${[
      ...bundle.manifestPaths.map((manifest) => manifest.outputPath),
      bundle.promotionBundlePath,
      promotionExecution.reportPath
    ].join("\n")}\n`
  );
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
