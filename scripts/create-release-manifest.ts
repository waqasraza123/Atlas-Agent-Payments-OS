import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  createAtlasReleaseManifest,
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

function asRuntimeService(value: string | null): AtlasRuntimeService {
  if (!value) {
    return "api";
  }

  if (value === "api" || value === "web" || value === "worker") {
    return value;
  }

  throw new Error(`Unsupported service '${value}'. Expected one of: api, web, worker.`);
}

async function main() {
  const filePath = readArgumentValue("--file");
  const outputPath = readArgumentValue("--out");
  const service = asRuntimeService(readArgumentValue("--service"));
  const environment = filePath ? { ...process.env, ...parseEnvFile(filePath) } : process.env;
  const manifest = createAtlasReleaseManifest(service, environment);
  const payload = `${JSON.stringify(manifest, null, 2)}\n`;

  if (!outputPath) {
    process.stdout.write(payload);
    return;
  }

  const resolvedOutputPath = resolveRepoPath(outputPath);
  mkdirSync(dirname(resolvedOutputPath), { recursive: true });
  writeFileSync(resolvedOutputPath, payload, "utf8");
  process.stdout.write(`${resolvedOutputPath}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
