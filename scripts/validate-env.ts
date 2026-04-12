import {
  validateAtlasRuntimeConfiguration,
  type AtlasRuntimeService
} from "../packages/config/src/index.ts";
import { parseEnvFile } from "./lib/env-file";

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

function asRuntimeServices(values: string[]): AtlasRuntimeService[] {
  const fallback: AtlasRuntimeService[] = ["api", "web", "worker"];

  if (values.length === 0) {
    return fallback;
  }

  const supportedServices = new Set<AtlasRuntimeService>(fallback);
  const invalidValue = values.find((value) => !supportedServices.has(value as AtlasRuntimeService));

  if (invalidValue) {
    throw new Error(`Unsupported service '${invalidValue}'. Expected one of: api, web, worker.`);
  }

  return values as AtlasRuntimeService[];
}

async function main() {
  const filePath = readArgumentValue("--file");
  const services = asRuntimeServices(readArgumentValues("--service"));
  const environment = filePath ? { ...process.env, ...parseEnvFile(filePath) } : process.env;
  const results = services.map((service) => validateAtlasRuntimeConfiguration(service, environment));
  const failures = results.filter((result) => !result.ok);

  for (const result of results) {
    const status = result.ok ? "ok" : "invalid";
    process.stdout.write(
      `${result.service} runtime validation: ${status} (${result.requiredVariables.length} required variables)\n`
    );

    for (const issue of result.issues) {
      process.stdout.write(`- ${issue.message}\n`);
    }
  }

  if (failures.length > 0) {
    process.exit(1);
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
