import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertAtlasPromotionReadiness,
  canAtlasPromoteEnvironment,
  createAtlasReleaseManifest,
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

async function main() {
  const fromEnv = asPromotionTarget(readArgumentValue("--from"), "development");
  const toEnv = asPromotionTarget(readArgumentValue("--to"), "staging");
  const envFile = readArgumentValue("--file") ?? resolveEnvironmentExampleFile(toEnv);
  const services = resolveServices(readArgumentValue("--services"));

  if (!canAtlasPromoteEnvironment(fromEnv, toEnv)) {
    throw new Error(`Promotion from ${fromEnv} to ${toEnv} is not allowed. Promotions must advance one stage at a time.`);
  }

  const environment = {
    ...process.env,
    ...parseEnvFile(envFile),
    APP_ENV: toEnv
  };
  assertAtlasPromotionReadiness(toEnv, environment);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDirectory = resolveRepoPath(join("release-manifests", toEnv, timestamp));
  mkdirSync(outputDirectory, { recursive: true });

  const manifestPaths = services.map((service) => {
    const manifest = createAtlasReleaseManifest(service, environment);
    const outputPath = join(outputDirectory, `${service}.json`);
    writeFileSync(outputPath, `${JSON.stringify({
      promotion: {
        fromEnv,
        toEnv,
        createdAt: new Date().toISOString(),
        envFile
      },
      manifest
    }, null, 2)}\n`, "utf8");
    return outputPath;
  });

  process.stdout.write(`${manifestPaths.join("\n")}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
