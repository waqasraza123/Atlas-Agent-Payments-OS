import { observabilityRuntime } from "../packages/config/src/index.ts";
import { executeObservabilityAutomationPolicy } from "../packages/database/src/observability-runtime.ts";

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
  const telemetryPolicy =
    readFlag("telemetry-policy") === "recover" || hasSwitch("recover-ownership")
      ? "recover"
      : observabilityRuntime.automationTelemetryOwnershipPolicy;
  const result = await executeObservabilityAutomationPolicy({
    actorUserEmail,
    reason,
    minimumSeverity:
      minimumSeverity === "critical" || minimumSeverity === "warning" || minimumSeverity === "info"
        ? minimumSeverity
        : undefined,
    dispatchAlerts: hasSwitch("dispatch"),
    telemetryPolicy
  });

  console.log(
    JSON.stringify(
      {
        reportPath: result.reportPath,
        telemetryPolicy: result.telemetryPolicy,
        telemetryRecoveryStatus: result.telemetryRecoveryStatus,
        recoveredOwnershipCount: result.recoveredKeys.length,
        remainingOwnershipCount: result.remainingKeys.length,
        snapshotId: result.snapshotId,
        dispatchId: result.dispatchId,
        activeIncidentCount: result.activeIncidentCount
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
