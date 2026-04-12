import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertAtlasPromotionReadiness,
  assertAtlasPromotionOperationalReadiness,
  canAtlasPromoteEnvironment,
  createAtlasReleaseManifest,
  type AtlasRestoreDrillReport,
  type AtlasSecretRotationManifest,
  type AtlasPromotionTarget,
  type AtlasRuntimeService
} from "../packages/config/src/index.ts";
import { parseEnvFile, resolveRepoPath } from "./lib/env-file";

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

  if (!restoreReportPath || !secretRotationManifestPath) {
    throw new Error(
      `Promotion to ${toEnv} requires --restore-report and --rotation-manifest, or ATLAS_RESTORE_DRILL_REPORT and ATLAS_SECRET_ROTATION_MANIFEST.`
    );
  }

  const restoreDrillReport = readJsonFile<AtlasRestoreDrillReport>(restoreReportPath);
  const secretRotationManifest = readJsonFile<AtlasSecretRotationManifest>(secretRotationManifestPath);
  assertAtlasPromotionOperationalReadiness(
    toEnv,
    {
      restoreDrillReport,
      secretRotationManifest
    },
    environment
  );

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDirectory = resolveRepoPath(join("release-manifests", toEnv, timestamp));
  mkdirSync(outputDirectory, { recursive: true });

  const manifestPaths = services.map((service) => {
    const manifest = createAtlasReleaseManifest(service, environment);
    const outputPath = join(outputDirectory, `${service}.json`);
    const payload = `${JSON.stringify({
      promotion: {
        fromEnv,
        toEnv,
        createdAt: new Date().toISOString(),
        envFile
      },
      manifest
    }, null, 2)}\n`;
    writeFileSync(outputPath, payload, "utf8");
    return {
      service,
      outputPath,
      sha256: createHash("sha256").update(payload).digest("hex")
    };
  });

  const promotionBundlePath = join(outputDirectory, "promotion.json");
  writeFileSync(
    promotionBundlePath,
    `${JSON.stringify(
      {
        promotion: {
          fromEnv,
          toEnv,
          createdAt: new Date().toISOString(),
          envFile,
          restoreReportPath,
          secretRotationManifestPath
        },
        artifact: {
          id: environment.RELEASE_ARTIFACT_ID,
          sha256: environment.RELEASE_ARTIFACT_SHA256
        },
        operationalProof: {
          restoreDrill: {
            path: restoreReportPath,
            sha256: createHash("sha256").update(readFileSync(restoreReportPath)).digest("hex"),
            completedAt: restoreDrillReport.completedAt,
            targetEnvironment: restoreDrillReport.targetEnvironment,
            targetLabel: restoreDrillReport.targetLabel
          },
          secretRotation: {
            path: secretRotationManifestPath,
            sha256: createHash("sha256").update(readFileSync(secretRotationManifestPath)).digest("hex"),
            generatedAt: secretRotationManifest.generatedAt,
            environment: secretRotationManifest.environment,
            rotatedBy: secretRotationManifest.rotatedBy,
            secretKeys: secretRotationManifest.secrets.map((secret) => secret.key)
          }
        },
        revision: environment.APP_REVISION,
        services: manifestPaths
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  process.stdout.write(`${[...manifestPaths.map((manifest) => manifest.outputPath), promotionBundlePath].join("\n")}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
