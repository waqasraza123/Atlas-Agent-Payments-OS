import { executeObservabilityAutomation } from "../packages/database/src/observability-runtime.ts";

function readFlag(name: string) {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);

  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function hasSwitch(name: string) {
  return process.argv.includes(`--${name}`);
}

function requireFlag(name: string) {
  const value = readFlag(name)?.trim() ?? "";

  if (value.length === 0) {
    throw new Error(`Missing required flag --${name}`);
  }

  return value;
}

async function main() {
  const actorUserEmail = requireFlag("actor-user-email");
  const reason = requireFlag("reason");
  const minimumSeverity = readFlag("minimum-severity");
  const result = await executeObservabilityAutomation({
    actorUserEmail,
    reason,
    minimumSeverity:
      minimumSeverity === "critical" || minimumSeverity === "warning" || minimumSeverity === "info"
        ? minimumSeverity
        : undefined,
    dispatchAlerts: hasSwitch("dispatch")
  });

  console.log(
    JSON.stringify(
      {
        reportPath: result.reportPath,
        snapshotId: result.snapshot.id,
        dispatchId: result.dispatch?.id ?? null,
        dispatchedAlertCount: result.dispatch?.dispatchedAlertCount ?? 0,
        workerTelemetryStatus: result.workerTelemetry.status
      },
      null,
      2
    )
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
