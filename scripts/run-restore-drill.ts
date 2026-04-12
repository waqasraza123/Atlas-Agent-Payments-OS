import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { appRuntime, deploymentRuntime } from "../packages/config/src/index.ts";
import { createFileIntegrityManifest, verifyFileIntegrityManifest, writeFileIntegrityManifest } from "./lib/file-integrity";

function readArgumentValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function resolveBackupPath() {
  return resolve(readArgumentValue("--backup") ?? "scripts/fixtures/restore-drill.sql");
}

function resolveReportPath() {
  const explicitPath = readArgumentValue("--report");
  if (explicitPath) {
    return resolve(explicitPath);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return resolve("restore-drills", `${timestamp}.json`);
}

function shouldExecuteRestore() {
  return process.argv.includes("--execute") || process.env.ATLAS_RESTORE_DRILL_EXECUTE === "true";
}

function runRestore(backupPath: string) {
  const targetDatabaseUrl = process.env.ATLAS_RESTORE_DRILL_DATABASE_URL?.trim() ?? "";

  if (targetDatabaseUrl.length === 0) {
    throw new Error("ATLAS_RESTORE_DRILL_DATABASE_URL is required when executing a restore drill.");
  }

  const result = spawnSync("psql", [targetDatabaseUrl, "-v", "ON_ERROR_STOP=1", "-f", backupPath], {
    stdio: "pipe",
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Restore drill execution failed.");
  }

  return {
    databaseUrlRedacted: targetDatabaseUrl.replace(/:[^:@/]+@/, ":***@"),
    stdout: result.stdout.trim()
  };
}

async function main() {
  const backupPath = resolveBackupPath();
  const reportPath = resolveReportPath();
  const manifestPath = `${backupPath}.manifest.json`;

  writeFileIntegrityManifest(backupPath, manifestPath);
  const verification = verifyFileIntegrityManifest(backupPath, manifestPath);

  if (!verification.ok) {
    throw new Error("Restore drill backup integrity verification failed.");
  }

  const executedRestore = shouldExecuteRestore();
  const execution = executedRestore ? runRestore(backupPath) : null;
  const report = {
    version: 1,
    appEnv: appRuntime.appEnv,
    releaseStage: appRuntime.releaseStage,
    revision: deploymentRuntime.revision,
    backupPath,
    backupIntegrity: createFileIntegrityManifest(backupPath),
    manifestPath,
    executedRestore,
    execution,
    completedAt: new Date().toISOString()
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${reportPath}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
