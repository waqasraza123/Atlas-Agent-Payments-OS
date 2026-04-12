import { executeAtlasRestoreDrill } from "../packages/database/src/rollout-automation.ts";
import { appRuntime } from "../packages/config/src/index.ts";

function readArgumentValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

async function main() {
  const result = await executeAtlasRestoreDrill({
    backupPath: readArgumentValue("--backup") ?? "scripts/fixtures/restore-drill.sql",
    targetEnvironment: readArgumentValue("--environment") ?? appRuntime.appEnv,
    targetLabel: readArgumentValue("--label") ?? process.env.ATLAS_RESTORE_DRILL_TARGET_LABEL ?? "default-restore-target",
    targetHost: readArgumentValue("--target-host") ?? process.env.ATLAS_RESTORE_DRILL_TARGET_HOST ?? null,
    reportPath: readArgumentValue("--report"),
    executeRestore: process.argv.includes("--execute") || process.env.ATLAS_RESTORE_DRILL_EXECUTE === "true"
  });

  process.stdout.write(`${result.reportPath}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
