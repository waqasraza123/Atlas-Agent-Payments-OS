import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { operationsRuntime, type AtlasPromotionTarget, type AtlasSecretRotationManifest } from "../packages/config/src/index.ts";

function readArgumentValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function readArgumentValues(flag: string) {
  const values: string[] = [];

  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === flag) {
      const nextValue = process.argv[index + 1];
      if (nextValue) {
        values.push(nextValue);
      }
    }
  }

  return values;
}

function asPromotionTarget(value: string | null): AtlasPromotionTarget {
  if (value === "development" || value === "staging" || value === "production") {
    return value;
  }

  throw new Error("Secret rotation manifest requires --environment development, staging, or production.");
}

function resolveOutputPath(environment: AtlasPromotionTarget) {
  const explicitPath = readArgumentValue("--report");
  if (explicitPath) {
    return resolve(explicitPath);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return resolve("rotation-manifests", environment, `${timestamp}.json`);
}

async function main() {
  const environment = asPromotionTarget(readArgumentValue("--environment"));
  const rotatedBy = readArgumentValue("--rotated-by")?.trim() ?? "";
  const reason = readArgumentValue("--reason")?.trim() ?? "";
  const secretKeys = [...new Set(readArgumentValues("--key"))];

  if (rotatedBy.length < 5) {
    throw new Error("Secret rotation manifest requires --rotated-by with the operator identity.");
  }

  if (reason.length < 12) {
    throw new Error("Secret rotation manifest requires --reason with durable operational detail.");
  }

  if (secretKeys.length === 0) {
    throw new Error("Secret rotation manifest requires at least one --key entry.");
  }

  const now = new Date().toISOString();
  const manifest: AtlasSecretRotationManifest = {
    version: 1,
    environment,
    rotatedBy,
    reason,
    generatedAt: now,
    maxAgeHours: operationsRuntime.secretRotationMaxAgeHours,
    secrets: secretKeys.map((key) => ({
      key,
      rotatedAt: now
    }))
  };

  const outputPath = resolveOutputPath(environment);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`${outputPath}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
