import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AtlasActorContext } from "@atlas/auth";
import {
  appRuntime,
  assertAtlasPromotionOperationalReadiness,
  assertAtlasPromotionReadiness,
  createAtlasReleaseManifest,
  deploymentAutomationRuntime,
  deploymentRuntime,
  operationsRuntime,
  restoreDrillRuntime,
  secretRotationRuntime,
  type AtlasAppEnvironment,
  type AtlasCommandAdapterMode,
  type AtlasPromotionExecutionReport,
  type AtlasPromotionTarget,
  type AtlasRuntimeService,
  type AtlasSecretRotationExecutionReport,
  type AtlasSecretRotationManifest,
  type AtlasRestoreDrillReport,
  type AtlasUpstreamIdentityLifecycleAction,
  type AtlasUpstreamIdentityLifecycleReport,
  upstreamIdentityRuntime
} from "../../config/src/index";
import type { AtlasExternalIdentityAssignmentRecord } from "./external-identity-access";
import {
  createAtlasFileIntegrityManifest,
  verifyAtlasFileIntegrityManifest,
  writeAtlasFileIntegrityManifest,
  computeAtlasFileSha256
} from "./file-integrity";

export class AtlasRolloutAutomationError extends Error {
  constructor(message: string, readonly code: "bad_request" | "conflict" | "execution_failed") {
    super(message);
    this.name = "AtlasRolloutAutomationError";
  }
}

function resolveRepoPath(...segments: string[]) {
  return resolve(import.meta.dirname, "../../..", ...segments);
}

function readArgumentSafeText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function createTimestampFileFragment() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function writeJsonArtifact(filePath: string, payload: unknown) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}

function truncateOutput(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 4000 ? normalized.slice(0, 4000) : normalized;
}

function executeConfiguredCommand(
  mode: AtlasCommandAdapterMode,
  command: string | null,
  payload: Record<string, unknown>
) {
  if (mode === "dry-run") {
    return {
      configured: Boolean(command),
      exitCode: null,
      stdout: "",
      stderr: ""
    };
  }

  if (!command) {
    throw new AtlasRolloutAutomationError("Command execution was requested but no command is configured.", "bad_request");
  }

  const result = spawnSync("sh", ["-lc", command], {
    env: {
      ...process.env,
      ATLAS_OPERATION_PAYLOAD: JSON.stringify(payload)
    },
    stdio: "pipe",
    encoding: "utf8"
  });

  return {
    configured: true,
    exitCode: result.status,
    stdout: truncateOutput(result.stdout),
    stderr: truncateOutput(result.stderr)
  };
}

function collectJsonArtifactFiles(directoryPath: string) {
  const entries = readdirSync(directoryPath, {
    withFileTypes: true
  });
  const filePaths: string[] = [];

  for (const entry of entries) {
    const childPath = resolve(directoryPath, entry.name);
    if (entry.isDirectory()) {
      filePaths.push(...collectJsonArtifactFiles(childPath));
      continue;
    }

    if (entry.isFile() && childPath.endsWith(".json")) {
      filePaths.push(childPath);
    }
  }

  return filePaths;
}

function listArtifacts<T extends { generatedAt?: string; completedAt?: string }>(directoryPath: string, limit: number) {
  try {
    const filePaths = collectJsonArtifactFiles(directoryPath);
    const items = filePaths
      .map((filePath) => JSON.parse(readFileSync(filePath, "utf8")) as T)
      .sort((left, right) => {
        const leftTimestamp = Date.parse(left.completedAt ?? left.generatedAt ?? "");
        const rightTimestamp = Date.parse(right.completedAt ?? right.generatedAt ?? "");
        return rightTimestamp - leftTimestamp;
      });

    return items.slice(0, limit);
  } catch {
    return [];
  }
}

function assertPromotionTarget(value: string): AtlasPromotionTarget {
  if (value === "development" || value === "staging" || value === "production") {
    return value;
  }

  throw new AtlasRolloutAutomationError(
    "Promotion target must be development, staging, or production.",
    "bad_request"
  );
}

function assertRestoreEnvironment(value: string): AtlasAppEnvironment {
  if (value === "local" || value === "development" || value === "staging" || value === "production") {
    return value;
  }

  throw new AtlasRolloutAutomationError(
    "Restore drill environment must be local, development, staging, or production.",
    "bad_request"
  );
}

function assertNonEmptyReason(reason: string, label: string) {
  if (reason.trim().length < 12) {
    throw new AtlasRolloutAutomationError(`${label} must include enough operational detail.`, "bad_request");
  }
}

function assertActorEmail(actorEmail: string) {
  if (actorEmail.trim().length < 5 || !actorEmail.includes("@")) {
    throw new AtlasRolloutAutomationError("Operator identity email is required for operational automation.", "bad_request");
  }
}

export function listAtlasRestoreDrillReports(limit = 12) {
  return listArtifacts<AtlasRestoreDrillReport>(resolveRepoPath(restoreDrillRuntime.reportDirectory), limit);
}

export function listAtlasSecretRotationExecutionReports(limit = 12) {
  return listArtifacts<AtlasSecretRotationExecutionReport>(resolveRepoPath(secretRotationRuntime.reportDirectory), limit);
}

export function listAtlasPromotionExecutionReports(limit = 12) {
  return listArtifacts<AtlasPromotionExecutionReport>(resolveRepoPath(deploymentAutomationRuntime.reportDirectory), limit);
}

export function listAtlasUpstreamIdentityLifecycleReports(limit = 12) {
  return listArtifacts<AtlasUpstreamIdentityLifecycleReport>(resolveRepoPath(upstreamIdentityRuntime.reportDirectory), limit);
}

export function executeAtlasRestoreDrill(input: {
  backupPath: string;
  targetEnvironment: string;
  targetLabel: string;
  targetHost?: string | null;
  reportPath?: string | null;
  executeRestore: boolean;
}) {
  const backupPath = resolve(input.backupPath);
  const targetEnvironment = assertRestoreEnvironment(input.targetEnvironment);
  const targetLabel = readArgumentSafeText(input.targetLabel);
  const targetHost = readArgumentSafeText(input.targetHost);

  if (targetLabel.length < 3) {
    throw new AtlasRolloutAutomationError("Restore drill target label is required.", "bad_request");
  }

  const reportPath =
    input.reportPath && input.reportPath.trim().length > 0
      ? resolve(input.reportPath)
      : resolveRepoPath(restoreDrillRuntime.reportDirectory, `${createTimestampFileFragment()}.json`);
  const manifestPath = `${backupPath}.manifest.json`;

  writeAtlasFileIntegrityManifest(backupPath, manifestPath);
  const verification = verifyAtlasFileIntegrityManifest(backupPath, manifestPath);

  if (!verification.ok) {
    throw new AtlasRolloutAutomationError("Restore drill backup integrity verification failed.", "conflict");
  }

  let execution: AtlasRestoreDrillReport["execution"] = null;
  let executionMode: AtlasCommandAdapterMode = "dry-run";
  let executor = "dry-run";

  if (input.executeRestore) {
    executionMode = "command";

    if (restoreDrillRuntime.mode === "command") {
      const result = executeConfiguredCommand(restoreDrillRuntime.mode, restoreDrillRuntime.command, {
        backupPath,
        targetEnvironment,
        targetLabel,
        targetHost: targetHost || null
      });

      if (result.exitCode !== 0) {
        throw new AtlasRolloutAutomationError(
          result.stderr || result.stdout || "Remote restore drill execution failed.",
          "execution_failed"
        );
      }

      executor = "configured-command";
      execution = {
        databaseUrlRedacted: targetHost || "remote-target",
        stdout: result.stdout
      };
    } else {
      const targetDatabaseUrl = process.env.ATLAS_RESTORE_DRILL_DATABASE_URL?.trim() ?? "";

      if (targetDatabaseUrl.length === 0) {
        throw new AtlasRolloutAutomationError(
          "ATLAS_RESTORE_DRILL_DATABASE_URL is required when executing a restore drill without a remote command adapter.",
          "bad_request"
        );
      }

      const result = spawnSync("psql", [targetDatabaseUrl, "-v", "ON_ERROR_STOP=1", "-f", backupPath], {
        stdio: "pipe",
        encoding: "utf8"
      });

      if (result.status !== 0) {
        throw new AtlasRolloutAutomationError(
          result.stderr || result.stdout || "Restore drill execution failed.",
          "execution_failed"
        );
      }

      executor = "psql";
      execution = {
        databaseUrlRedacted: targetDatabaseUrl.replace(/:[^:@/]+@/, ":***@"),
        stdout: truncateOutput(result.stdout)
      };
    }
  }

  const report: AtlasRestoreDrillReport = {
    version: 1,
    appEnv: appRuntime.appEnv,
    releaseStage: appRuntime.releaseStage,
    revision: deploymentRuntime.revision,
    backupPath,
    manifestPath,
    executedRestore: input.executeRestore,
    targetEnvironment,
    targetLabel,
    backupIntegrity: createAtlasFileIntegrityManifest(backupPath),
    executionMode,
    executor,
    targetHost: targetHost || null,
    proofArtifactPath: reportPath,
    execution,
    completedAt: new Date().toISOString()
  };

  writeJsonArtifact(reportPath, report);
  return {
    report,
    reportPath
  };
}

export function executeAtlasSecretRotation(input: {
  environment: string;
  rotatedBy: string;
  reason: string;
  secretKeys: string[];
  reportPath?: string | null;
  manifestPath?: string | null;
}) {
  const environment = assertPromotionTarget(input.environment);
  const rotatedBy = readArgumentSafeText(input.rotatedBy).toLowerCase();
  const reason = readArgumentSafeText(input.reason);
  const secretKeys = [...new Set(input.secretKeys.map((entry) => entry.trim()).filter((entry) => entry.length > 0))];

  assertActorEmail(rotatedBy);
  assertNonEmptyReason(reason, "Secret rotation reason");

  if (secretKeys.length === 0) {
    throw new AtlasRolloutAutomationError("At least one secret key is required for rotation execution.", "bad_request");
  }

  const generatedAt = new Date().toISOString();
  const manifest: AtlasSecretRotationManifest = {
    version: 1,
    environment,
    rotatedBy,
    reason,
    generatedAt,
    maxAgeHours: operationsRuntime.secretRotationMaxAgeHours,
    secrets: secretKeys.map((key) => ({
      key,
      rotatedAt: generatedAt
    }))
  };

  const manifestPath =
    input.manifestPath && input.manifestPath.trim().length > 0
      ? resolve(input.manifestPath)
      : resolveRepoPath(secretRotationRuntime.manifestDirectory, environment, `${createTimestampFileFragment()}.json`);
  writeJsonArtifact(manifestPath, manifest);

  const command = executeConfiguredCommand(secretRotationRuntime.mode, secretRotationRuntime.command, {
    environment,
    provider: secretRotationRuntime.provider,
    rotatedBy,
    reason,
    secretKeys
  });

  if (command.exitCode !== null && command.exitCode !== 0) {
    throw new AtlasRolloutAutomationError(
      command.stderr || command.stdout || "Secret rotation command failed.",
      "execution_failed"
    );
  }

  const report: AtlasSecretRotationExecutionReport = {
    version: 1,
    environment,
    provider: secretRotationRuntime.provider,
    mode: secretRotationRuntime.mode,
    rotatedBy,
    reason,
    generatedAt,
    manifestPath,
    manifest,
    command
  };
  const reportPath =
    input.reportPath && input.reportPath.trim().length > 0
      ? resolve(input.reportPath)
      : resolveRepoPath(secretRotationRuntime.reportDirectory, environment, `${createTimestampFileFragment()}.json`);

  writeJsonArtifact(reportPath, report);
  return {
    report,
    reportPath,
    manifestPath
  };
}

export function executeAtlasPromotionAutomation(input: {
  fromEnv: string;
  toEnv: string;
  services: AtlasRuntimeService[];
  restoreDrillReport: AtlasRestoreDrillReport;
  secretRotationManifest?: AtlasSecretRotationManifest;
  secretRotationExecutionReport?: AtlasSecretRotationExecutionReport;
  environment: Record<string, string | undefined>;
  bundlePath: string;
}) {
  const fromEnv = assertPromotionTarget(input.fromEnv);
  const toEnv = assertPromotionTarget(input.toEnv);

  assertAtlasPromotionReadiness(toEnv, input.environment);
  assertAtlasPromotionOperationalReadiness(
    toEnv,
    {
      restoreDrillReport: input.restoreDrillReport,
      secretRotationManifest: input.secretRotationManifest,
      secretRotationExecutionReport: input.secretRotationExecutionReport
    },
    input.environment
  );

  const bundlePath = resolve(input.bundlePath);
  const bundleSha256 = computeAtlasFileSha256(bundlePath);
  const command = executeConfiguredCommand(deploymentAutomationRuntime.mode, deploymentAutomationRuntime.command, {
    fromEnv,
    toEnv,
    services: input.services,
    bundlePath,
    bundleSha256
  });

  if (command.exitCode !== null && command.exitCode !== 0) {
    throw new AtlasRolloutAutomationError(
      command.stderr || command.stdout || "Deployment automation command failed.",
      "execution_failed"
    );
  }

  const report: AtlasPromotionExecutionReport = {
    version: 1,
    fromEnv,
    toEnv,
    services: input.services,
    mode: deploymentAutomationRuntime.mode,
    generatedAt: new Date().toISOString(),
    bundlePath,
    bundleSha256,
    command
  };
  const reportPath = resolveRepoPath(
    deploymentAutomationRuntime.reportDirectory,
    toEnv,
    `${createTimestampFileFragment()}.json`
  );

  writeJsonArtifact(reportPath, report);
  return {
    report,
    reportPath
  };
}

export function executeAtlasUpstreamIdentityLifecycle(input: {
  actor: AtlasActorContext;
  assignment: AtlasExternalIdentityAssignmentRecord;
  action: AtlasUpstreamIdentityLifecycleAction;
  reason: string;
}) {
  assertActorEmail(input.actor.user.email);
  assertNonEmptyReason(input.reason, "Upstream identity lifecycle reason");

  const command = executeConfiguredCommand(upstreamIdentityRuntime.mode, upstreamIdentityRuntime.command, {
    provider: upstreamIdentityRuntime.provider,
    action: input.action,
    actorUserEmail: input.actor.user.email,
    assignmentId: input.assignment.id,
    externalEmail: input.assignment.externalEmail,
    organizationSlug: input.assignment.organizationSlug,
    role: input.assignment.role,
    reason: input.reason
  });

  if (command.exitCode !== null && command.exitCode !== 0) {
    throw new AtlasRolloutAutomationError(
      command.stderr || command.stdout || "Upstream identity lifecycle command failed.",
      "execution_failed"
    );
  }

  const report: AtlasUpstreamIdentityLifecycleReport = {
    version: 1,
    provider: upstreamIdentityRuntime.provider,
    mode: upstreamIdentityRuntime.mode,
    action: input.action,
    generatedAt: new Date().toISOString(),
    actorUserEmail: input.actor.user.email,
    assignmentId: input.assignment.id,
    externalEmail: input.assignment.externalEmail,
    organizationSlug: input.assignment.organizationSlug,
    role: input.assignment.role,
    command
  };
  const reportPath = resolveRepoPath(
    upstreamIdentityRuntime.reportDirectory,
    input.assignment.organizationSlug,
    `${createTimestampFileFragment()}-${input.action.toLowerCase()}.json`
  );

  writeJsonArtifact(reportPath, report);
  return {
    report,
    reportPath
  };
}

export function listAtlasRolloutAutomationSummary() {
  return {
    upstreamIdentity: upstreamIdentityRuntime,
    restoreDrill: restoreDrillRuntime,
    secretRotation: secretRotationRuntime,
    deploymentAutomation: deploymentAutomationRuntime
  };
}
