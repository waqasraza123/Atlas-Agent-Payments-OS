import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function resolveRepoPath(pathValue: string) {
  return resolve(process.cwd(), pathValue);
}

export function parseEnvFile(pathValue: string) {
  const content = readFileSync(resolveRepoPath(pathValue), "utf8");
  const lines = content.split(/\r?\n/);
  const environment: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    environment[key] = value;
  }

  return environment;
}
