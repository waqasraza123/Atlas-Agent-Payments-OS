import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AtlasActorContext } from "@atlas/auth";
import {
  appRuntime,
  assertAtlasPromotionOperationalReadiness,
  assertAtlasPromotionReadiness,
  createAtlasReleaseManifest,
  type AtlasAutomationAdapterResult,
  type AtlasAutomationCommandResult,
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
  type AtlasSecretRotationProvider,
  type AtlasRestoreDrillProvider,
  type AtlasDeploymentAutomationProvider,
  type AtlasUpstreamIdentityProvider,
  type AtlasUpstreamIdentityLifecycleAction,
  type AtlasUpstreamIdentityLifecycleReport,
  upstreamIdentityRuntime,
  type AtlasOperationalIntegrationSnapshot
} from "../../config/src/index";
import { Prisma, type PrismaClient } from "./generated/client/index.js";
import { prisma } from "./client";
import type { AtlasExternalIdentityAssignmentRecord } from "./external-identity-access";
import {
  createAtlasFileIntegrityManifest,
  verifyAtlasFileIntegrityManifest,
  writeAtlasFileIntegrityManifest,
  computeAtlasFileSha256
} from "./file-integrity";
import {
  resolveOperationalIntegrationForExecution,
  touchOperationalIntegrationUsage,
  type AtlasOperationalIntegrationRecord
} from "./operational-integrations";
import { storeAtlasOperationalProofArtifacts, type AtlasOperationalStoredArtifactRecord } from "./operational-proof-storage";
import { createOperationalExecutionRecord } from "./rollout-executions";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

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

function mapOperationalIntegrationSnapshot(
  integration: AtlasOperationalIntegrationRecord
): AtlasOperationalIntegrationSnapshot {
  return {
    id: integration.id,
    kind: integration.kind,
    targetEnvironment: integration.targetEnvironment,
    provider: integration.provider,
    label: integration.label,
    ownerEmail: integration.ownerEmail,
    endpointReference: integration.endpointReference,
    secretReference: integration.secretReference,
    configReference: integration.configReference,
    verificationStatus: integration.verificationStatus,
    lastVerifiedAt: integration.lastVerifiedAt
  };
}

function toExecutionTargetEnvironment(
  value: AtlasAppEnvironment
): Uppercase<AtlasPromotionTarget> | null {
  if (value === "development") {
    return "DEVELOPMENT";
  }

  if (value === "staging") {
    return "STAGING";
  }

  if (value === "production") {
    return "PRODUCTION";
  }

  return null;
}

function truncateOutput(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 4000 ? normalized.slice(0, 4000) : normalized;
}

function createExecutionMetadata(fields: Record<string, Prisma.JsonValue | null | undefined>) {
  return Object.fromEntries(
    Object.entries(fields).filter((entry) => entry[1] !== undefined)
  ) as Prisma.JsonObject;
}

function createExecutionArtifacts(
  artifacts: Array<{
    kind: "REPORT" | "MANIFEST" | "BACKUP" | "BUNDLE";
    label: string;
    filePath: string | null | undefined;
    metadata?: Prisma.JsonObject | null;
  }>,
  storedArtifacts: AtlasOperationalStoredArtifactRecord[] = []
) {
  return artifacts
    .filter((artifact) => typeof artifact.filePath === "string" && artifact.filePath.trim().length > 0)
    .map((artifact) => {
      const resolvedFilePath = resolve(artifact.filePath as string);
      const matchingStoredArtifacts = storedArtifacts.filter((entry) => entry.filePath === resolvedFilePath);

      return {
        kind: artifact.kind,
        label: artifact.label,
        filePath: resolvedFilePath,
        metadata: createExecutionMetadata({
          ...(artifact.metadata ?? {}),
          storedArtifacts: matchingStoredArtifacts.length > 0 ? matchingStoredArtifacts : undefined
        })
      };
    });
}

async function persistOperationalExecutionIfAvailable(
  input: Parameters<typeof createOperationalExecutionRecord>[0],
  client: DatabaseClient
) {
  if ((process.env.DATABASE_URL?.trim() ?? "").length === 0) {
    return null;
  }

  if (!("operationalExecution" in client) || !client.operationalExecution || typeof client.operationalExecution.create !== "function") {
    return null;
  }

  return createOperationalExecutionRecord(input, client);
}

function readAdapterResult(stdout: string | null | undefined): AtlasAutomationAdapterResult | null {
  const normalized = stdout?.trim() ?? "";

  if (normalized.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalized) as AtlasAutomationAdapterResult;

    if (
      parsed &&
      parsed.version === 1 &&
      typeof parsed.adapter === "string" &&
      typeof parsed.provider === "string" &&
      typeof parsed.operationId === "string" &&
      typeof parsed.summary === "string" &&
      parsed.metadata &&
      typeof parsed.metadata === "object" &&
      !Array.isArray(parsed.metadata)
    ) {
      return parsed;
    }
  } catch {}

  return null;
}

function executeConfiguredCommand(
  mode: AtlasCommandAdapterMode,
  command: string | null,
  payload: Record<string, unknown>
): AtlasAutomationCommandResult & { adapterResult: AtlasAutomationAdapterResult | null } {
  if (mode === "dry-run") {
    return {
      configured: Boolean(command),
      exitCode: null,
      stdout: "",
      stderr: "",
      adapterResult: null
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
    stderr: truncateOutput(result.stderr),
    adapterResult: readAdapterResult(result.stdout)
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

export function findLatestAtlasRestoreDrillReport(targetEnvironment: AtlasAppEnvironment) {
  return listAtlasRestoreDrillReports(50).find((report) => report.targetEnvironment === targetEnvironment) ?? null;
}

export function listAtlasSecretRotationExecutionReports(limit = 12) {
  return listArtifacts<AtlasSecretRotationExecutionReport>(resolveRepoPath(secretRotationRuntime.reportDirectory), limit);
}

export function findLatestAtlasSecretRotationExecutionReport(targetEnvironment: AtlasPromotionTarget) {
  return listAtlasSecretRotationExecutionReports(50).find((report) => report.environment === targetEnvironment) ?? null;
}

export function listAtlasPromotionExecutionReports(limit = 12) {
  return listArtifacts<AtlasPromotionExecutionReport>(resolveRepoPath(deploymentAutomationRuntime.reportDirectory), limit);
}

export function listAtlasUpstreamIdentityLifecycleReports(limit = 12) {
  return listArtifacts<AtlasUpstreamIdentityLifecycleReport>(resolveRepoPath(upstreamIdentityRuntime.reportDirectory), limit);
}

export async function executeAtlasRestoreDrill(input: {
  backupPath: string;
  targetEnvironment: string;
  targetLabel: string;
  targetHost?: string | null;
  reportPath?: string | null;
  executeRestore: boolean;
  actorUserEmail?: string | null;
}, client: DatabaseClient = prisma) {
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
  let adapterResult: AtlasAutomationAdapterResult | null = null;
  let operationalIntegration: AtlasOperationalIntegrationSnapshot | null = null;

  if (input.executeRestore) {
    executionMode = "command";

    if (restoreDrillRuntime.mode === "command") {
      const integrationTarget = toExecutionTargetEnvironment(targetEnvironment);
      const resolvedIntegration =
        integrationTarget
          ? await resolveOperationalIntegrationForExecution(
              {
                kind: "RESTORE_DRILL",
                targetEnvironment: integrationTarget,
                provider: restoreDrillRuntime.provider
              },
              client
            )
          : null;
      const result = executeConfiguredCommand(restoreDrillRuntime.mode, restoreDrillRuntime.command, {
        backupPath,
        targetEnvironment,
        targetLabel,
        targetHost: targetHost || null,
        provider: restoreDrillRuntime.provider,
        operationalIntegrationId: resolvedIntegration?.id ?? null,
        ownerEmail: resolvedIntegration?.ownerEmail ?? null,
        endpointReference: resolvedIntegration?.endpointReference ?? null,
        secretReference: resolvedIntegration?.secretReference ?? null,
        configReference: resolvedIntegration?.configReference ?? null,
        executeRestore: input.executeRestore
      });

      if (result.exitCode !== 0) {
        throw new AtlasRolloutAutomationError(
          result.stderr || result.stdout || "Remote restore drill execution failed.",
          "execution_failed"
        );
      }

      executor = "configured-command";
      adapterResult = result.adapterResult;
      operationalIntegration = resolvedIntegration ? mapOperationalIntegrationSnapshot(resolvedIntegration) : null;
      execution = {
        databaseUrlRedacted: targetHost || "remote-target",
        stdout: result.stdout
      };
      if (resolvedIntegration) {
        await touchOperationalIntegrationUsage(resolvedIntegration.id, client);
      }
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
    operationalIntegration,
    adapterResult,
    completedAt: new Date().toISOString()
  };

  writeJsonArtifact(reportPath, report);
  const proofArtifacts = [
    {
      kind: "BACKUP" as const,
      label: "restore backup",
      filePath: backupPath,
      metadata: createExecutionMetadata({
        backupPath,
        targetEnvironment: report.targetEnvironment
      })
    },
    {
      kind: "MANIFEST" as const,
      label: "backup manifest",
      filePath: manifestPath,
      metadata: createExecutionMetadata({
        backupPath,
        targetEnvironment: report.targetEnvironment
      })
    },
    {
      kind: "REPORT" as const,
      label: "restore report",
      filePath: reportPath,
      metadata: createExecutionMetadata({
        targetEnvironment: report.targetEnvironment,
        targetLabel: report.targetLabel
      })
    }
  ];
  const storedArtifacts = await storeAtlasOperationalProofArtifacts({
    executionKind: "RESTORE_DRILL",
    targetEnvironment: report.targetEnvironment,
    artifacts: proofArtifacts.map((artifact) => ({
      kind: artifact.kind,
      label: artifact.label,
      filePath: artifact.filePath
    }))
  });
  await persistOperationalExecutionIfAvailable(
    {
      kind: "RESTORE_DRILL",
      mode: report.executionMode,
      status: "SUCCEEDED",
      targetEnvironment: report.targetEnvironment,
      provider: restoreDrillRuntime.provider,
      actorUserEmail: input.actorUserEmail?.trim() || "atlas-automation@atlas.local",
      summary: `Restore drill ${report.executedRestore ? "executed" : "validated"} for ${report.targetEnvironment}:${report.targetLabel}.`,
      providerOperationId: report.adapterResult?.operationId ?? null,
      targetReference: report.adapterResult?.targetRef ?? report.targetHost ?? null,
      reportPath,
      metadata: createExecutionMetadata({
        executedRestore: report.executedRestore,
        executionMode: report.executionMode,
        executor: report.executor,
        targetLabel: report.targetLabel,
        targetHost: report.targetHost,
        adapterResult: report.adapterResult,
        execution: report.execution,
        storedArtifacts
      }),
      operationalIntegration: operationalIntegration,
      completedAt: report.completedAt,
      proofArtifacts: createExecutionArtifacts(proofArtifacts, storedArtifacts)
    },
    client
  );
  return {
    report,
    reportPath
  };
}

export async function executeAtlasSecretRotation(input: {
  environment: string;
  rotatedBy: string;
  reason: string;
  secretKeys: string[];
  reportPath?: string | null;
  manifestPath?: string | null;
}, client: DatabaseClient = prisma) {
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

  const resolvedIntegration =
    secretRotationRuntime.mode === "command"
      ? await resolveOperationalIntegrationForExecution(
          {
            kind: "SECRET_ROTATION",
            targetEnvironment: environment.toUpperCase() as Uppercase<AtlasPromotionTarget>,
            provider: secretRotationRuntime.provider
          },
          client
        )
      : null;
  const command = executeConfiguredCommand(secretRotationRuntime.mode, secretRotationRuntime.command, {
    environment,
    provider: secretRotationRuntime.provider,
    rotatedBy,
    reason,
    secretKeys,
    operationalIntegrationId: resolvedIntegration?.id ?? null,
    ownerEmail: resolvedIntegration?.ownerEmail ?? null,
    endpointReference: resolvedIntegration?.endpointReference ?? null,
    secretReference: resolvedIntegration?.secretReference ?? null,
    configReference: resolvedIntegration?.configReference ?? null
  });

  if (command.exitCode !== null && command.exitCode !== 0) {
    throw new AtlasRolloutAutomationError(
      command.stderr || command.stdout || "Secret rotation command failed.",
      "execution_failed"
    );
  }

  const reportPath =
    input.reportPath && input.reportPath.trim().length > 0
      ? resolve(input.reportPath)
      : resolveRepoPath(secretRotationRuntime.reportDirectory, environment, `${createTimestampFileFragment()}.json`);
  const report: AtlasSecretRotationExecutionReport = {
    version: 1,
    environment,
    provider: secretRotationRuntime.provider,
    mode: secretRotationRuntime.mode,
    rotatedBy,
    reason,
    generatedAt,
    reportPath,
    manifestPath,
    manifest,
    operationalIntegration: resolvedIntegration ? mapOperationalIntegrationSnapshot(resolvedIntegration) : null,
    command,
    adapterResult: command.adapterResult
  };

  writeJsonArtifact(reportPath, report);
  const proofArtifacts = [
    {
      kind: "MANIFEST" as const,
      label: "rotation manifest",
      filePath: manifestPath,
      metadata: createExecutionMetadata({
        environment,
        secretCount: secretKeys.length
      })
    },
    {
      kind: "REPORT" as const,
      label: "rotation report",
      filePath: reportPath,
      metadata: createExecutionMetadata({
        environment,
        provider: report.provider
      })
    }
  ];
  const storedArtifacts = await storeAtlasOperationalProofArtifacts({
    executionKind: "SECRET_ROTATION",
    targetEnvironment: environment,
    artifacts: proofArtifacts.map((artifact) => ({
      kind: artifact.kind,
      label: artifact.label,
      filePath: artifact.filePath
    }))
  });
  if (resolvedIntegration) {
    await touchOperationalIntegrationUsage(resolvedIntegration.id, client);
  }
  await persistOperationalExecutionIfAvailable(
    {
      kind: "SECRET_ROTATION",
      mode: report.mode,
      status: "SUCCEEDED",
      targetEnvironment: environment,
      provider: report.provider,
      actorUserEmail: rotatedBy,
      summary: `Secret rotation executed for ${environment} across ${secretKeys.length} keys.`,
      providerOperationId: report.adapterResult?.operationId ?? null,
      targetReference: report.adapterResult?.targetRef ?? resolvedIntegration?.secretReference ?? null,
      reportPath,
      metadata: createExecutionMetadata({
        reason,
        secretKeys,
        adapterResult: report.adapterResult,
        command: report.command,
        storedArtifacts
      }),
      operationalIntegration: resolvedIntegration ? mapOperationalIntegrationSnapshot(resolvedIntegration) : null,
      completedAt: generatedAt,
      proofArtifacts: createExecutionArtifacts(proofArtifacts, storedArtifacts)
    },
    client
  );
  return {
    report,
    reportPath,
    manifestPath
  };
}

export function createAtlasPromotionBundle(input: {
  fromEnv: AtlasPromotionTarget;
  toEnv: AtlasPromotionTarget;
  services: AtlasRuntimeService[];
  envFile: string;
  environment: Record<string, string | undefined>;
  restoreReportPath: string;
  restoreDrillReport: AtlasRestoreDrillReport;
  secretRotationExecutionReportPath?: string | null;
  secretRotationExecutionReport?: AtlasSecretRotationExecutionReport;
  secretRotationManifestPath?: string | null;
  secretRotationManifest: AtlasSecretRotationManifest;
}) {
  const timestamp = createTimestampFileFragment();
  const outputDirectory = resolveRepoPath("release-manifests", input.toEnv, timestamp);
  mkdirSync(outputDirectory, { recursive: true });

  const manifestPaths = input.services.map((service) => {
    const manifest = createAtlasReleaseManifest(service, input.environment);
    const outputPath = resolve(outputDirectory, `${service}.json`);
    const payload = `${JSON.stringify(
      {
        promotion: {
          fromEnv: input.fromEnv,
          toEnv: input.toEnv,
          createdAt: new Date().toISOString(),
          envFile: input.envFile
        },
        manifest
      },
      null,
      2
    )}\n`;
    writeFileSync(outputPath, payload, "utf8");

    return {
      service,
      outputPath,
      sha256: computeAtlasFileSha256(outputPath)
    };
  });

  const secretRotationProofPath = input.secretRotationExecutionReportPath ?? input.secretRotationManifestPath;

  if (!secretRotationProofPath) {
    throw new AtlasRolloutAutomationError("Promotion bundle requires a secret rotation proof path.", "bad_request");
  }

  const promotionBundlePath = resolve(outputDirectory, "promotion.json");
  writeFileSync(
    promotionBundlePath,
    `${JSON.stringify(
      {
        promotion: {
          fromEnv: input.fromEnv,
          toEnv: input.toEnv,
          createdAt: new Date().toISOString(),
          envFile: input.envFile,
          restoreReportPath: input.restoreReportPath,
          secretRotationExecutionReportPath: input.secretRotationExecutionReportPath ?? null,
          secretRotationManifestPath: input.secretRotationManifestPath ?? null
        },
        artifact: {
          id: input.environment.RELEASE_ARTIFACT_ID,
          sha256: input.environment.RELEASE_ARTIFACT_SHA256
        },
        operationalProof: {
          restoreDrill: {
            path: input.restoreReportPath,
            sha256: computeAtlasFileSha256(input.restoreReportPath),
            completedAt: input.restoreDrillReport.completedAt,
            targetEnvironment: input.restoreDrillReport.targetEnvironment,
            targetLabel: input.restoreDrillReport.targetLabel
          },
          secretRotation: {
            path: secretRotationProofPath,
            sha256: computeAtlasFileSha256(secretRotationProofPath),
            generatedAt:
              input.secretRotationExecutionReport?.generatedAt ?? input.secretRotationManifest.generatedAt,
            environment: input.secretRotationManifest.environment,
            rotatedBy: input.secretRotationManifest.rotatedBy,
            provider: input.secretRotationExecutionReport?.provider ?? "manifest-only",
            mode: input.secretRotationExecutionReport?.mode ?? "dry-run",
            secretKeys: input.secretRotationManifest.secrets.map((secret) => secret.key)
          }
        },
        revision: input.environment.APP_REVISION,
        services: manifestPaths
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return {
    outputDirectory,
    manifestPaths,
    promotionBundlePath
  };
}

export async function executeAtlasPromotionAutomation(input: {
  fromEnv: string;
  toEnv: string;
  services: AtlasRuntimeService[];
  restoreDrillReport: AtlasRestoreDrillReport;
  secretRotationManifest?: AtlasSecretRotationManifest;
  secretRotationExecutionReport?: AtlasSecretRotationExecutionReport;
  environment: Record<string, string | undefined>;
  bundlePath: string;
  actorUserEmail?: string | null;
}, client: DatabaseClient = prisma) {
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
  const resolvedIntegration =
    deploymentAutomationRuntime.mode === "command"
      ? await resolveOperationalIntegrationForExecution(
          {
            kind: "DEPLOYMENT_AUTOMATION",
            targetEnvironment: toEnv.toUpperCase() as Uppercase<AtlasPromotionTarget>,
            provider: deploymentAutomationRuntime.provider
          },
          client
        )
      : null;
  const command = executeConfiguredCommand(deploymentAutomationRuntime.mode, deploymentAutomationRuntime.command, {
    fromEnv,
    toEnv,
    services: input.services,
    bundlePath,
    bundleSha256,
    provider: deploymentAutomationRuntime.provider,
    operationalIntegrationId: resolvedIntegration?.id ?? null,
    ownerEmail: resolvedIntegration?.ownerEmail ?? null,
    endpointReference: resolvedIntegration?.endpointReference ?? null,
    secretReference: resolvedIntegration?.secretReference ?? null,
    configReference: resolvedIntegration?.configReference ?? null
  });

  if (command.exitCode !== null && command.exitCode !== 0) {
    throw new AtlasRolloutAutomationError(
      command.stderr || command.stdout || "Deployment automation command failed.",
      "execution_failed"
    );
  }

  const reportPath = resolveRepoPath(
    deploymentAutomationRuntime.reportDirectory,
    toEnv,
    `${createTimestampFileFragment()}.json`
  );
  const report: AtlasPromotionExecutionReport = {
    version: 1,
    fromEnv,
    toEnv,
    services: input.services,
    mode: deploymentAutomationRuntime.mode,
    generatedAt: new Date().toISOString(),
    reportPath,
    bundlePath,
    bundleSha256,
    provider: deploymentAutomationRuntime.provider,
    operationalIntegration: resolvedIntegration ? mapOperationalIntegrationSnapshot(resolvedIntegration) : null,
    command,
    adapterResult: command.adapterResult
  };

  writeJsonArtifact(reportPath, report);
  const proofArtifacts = [
    {
      kind: "BUNDLE" as const,
      label: "promotion bundle",
      filePath: bundlePath,
      metadata: createExecutionMetadata({
        fromEnv,
        toEnv
      })
    },
    {
      kind: "REPORT" as const,
      label: "promotion report",
      filePath: reportPath,
      metadata: createExecutionMetadata({
        fromEnv,
        toEnv
      })
    }
  ];
  const storedArtifacts = await storeAtlasOperationalProofArtifacts({
    executionKind: "DEPLOYMENT_PROMOTION",
    targetEnvironment: toEnv,
    artifacts: proofArtifacts.map((artifact) => ({
      kind: artifact.kind,
      label: artifact.label,
      filePath: artifact.filePath
    }))
  });
  if (resolvedIntegration) {
    await touchOperationalIntegrationUsage(resolvedIntegration.id, client);
  }
  await persistOperationalExecutionIfAvailable(
    {
      kind: "DEPLOYMENT_PROMOTION",
      mode: report.mode,
      status: "SUCCEEDED",
      targetEnvironment: toEnv,
      provider: report.provider,
      actorUserEmail: input.actorUserEmail?.trim() || "atlas-automation@atlas.local",
      summary: `Promotion dispatched from ${fromEnv} to ${toEnv} for ${input.services.join(", ")}.`,
      providerOperationId: report.adapterResult?.operationId ?? null,
      targetReference: report.adapterResult?.targetRef ?? resolvedIntegration?.endpointReference ?? null,
      reportPath,
      metadata: createExecutionMetadata({
        fromEnv,
        toEnv,
        services: input.services,
        adapterResult: report.adapterResult,
        command: report.command,
        bundleSha256,
        storedArtifacts
      }),
      operationalIntegration: resolvedIntegration ? mapOperationalIntegrationSnapshot(resolvedIntegration) : null,
      completedAt: report.generatedAt,
      proofArtifacts: createExecutionArtifacts(proofArtifacts, storedArtifacts)
    },
    client
  );
  return {
    report,
    reportPath
  };
}

export async function executeAtlasUpstreamIdentityLifecycle(input: {
  actor: AtlasActorContext;
  assignment: AtlasExternalIdentityAssignmentRecord;
  action: AtlasUpstreamIdentityLifecycleAction;
  reason: string;
}, client: DatabaseClient = prisma) {
  assertActorEmail(input.actor.user.email);
  assertNonEmptyReason(input.reason, "Upstream identity lifecycle reason");

  const runtimeTargetEnvironment = toExecutionTargetEnvironment(appRuntime.appEnv);
  const resolvedIntegration =
    upstreamIdentityRuntime.mode === "command" && runtimeTargetEnvironment
      ? await resolveOperationalIntegrationForExecution(
          {
            kind: "UPSTREAM_IDENTITY",
            targetEnvironment: runtimeTargetEnvironment,
            provider: upstreamIdentityRuntime.provider
          },
          client
        )
      : null;
  const command = executeConfiguredCommand(upstreamIdentityRuntime.mode, upstreamIdentityRuntime.command, {
    provider: upstreamIdentityRuntime.provider,
    action: input.action,
    actorUserEmail: input.actor.user.email,
    assignmentId: input.assignment.id,
    externalEmail: input.assignment.externalEmail,
    organizationSlug: input.assignment.organizationSlug,
    role: input.assignment.role,
    reason: input.reason,
    operationalIntegrationId: resolvedIntegration?.id ?? null,
    ownerEmail: resolvedIntegration?.ownerEmail ?? null,
    endpointReference: resolvedIntegration?.endpointReference ?? null,
    secretReference: resolvedIntegration?.secretReference ?? null,
    configReference: resolvedIntegration?.configReference ?? null
  });

  if (command.exitCode !== null && command.exitCode !== 0) {
    throw new AtlasRolloutAutomationError(
      command.stderr || command.stdout || "Upstream identity lifecycle command failed.",
      "execution_failed"
    );
  }

  const reportPath = resolveRepoPath(
    upstreamIdentityRuntime.reportDirectory,
    input.assignment.organizationSlug,
    `${createTimestampFileFragment()}-${input.action.toLowerCase()}.json`
  );
  const report: AtlasUpstreamIdentityLifecycleReport = {
    version: 1,
    provider: upstreamIdentityRuntime.provider,
    mode: upstreamIdentityRuntime.mode,
    action: input.action,
    generatedAt: new Date().toISOString(),
    reportPath,
    actorUserEmail: input.actor.user.email,
    assignmentId: input.assignment.id,
    externalEmail: input.assignment.externalEmail,
    organizationSlug: input.assignment.organizationSlug,
    role: input.assignment.role,
    operationalIntegration: resolvedIntegration ? mapOperationalIntegrationSnapshot(resolvedIntegration) : null,
    command,
    adapterResult: command.adapterResult
  };

  writeJsonArtifact(reportPath, report);
  const proofArtifacts = [
    {
      kind: "REPORT" as const,
      label: "upstream identity report",
      filePath: reportPath,
      metadata: createExecutionMetadata({
        action: input.action,
        organizationSlug: input.assignment.organizationSlug
      })
    }
  ];
  const storedArtifacts = await storeAtlasOperationalProofArtifacts({
    executionKind: "UPSTREAM_IDENTITY",
    targetEnvironment: runtimeTargetEnvironment,
    artifacts: proofArtifacts.map((artifact) => ({
      kind: artifact.kind,
      label: artifact.label,
      filePath: artifact.filePath
    }))
  });
  if (resolvedIntegration) {
    await touchOperationalIntegrationUsage(resolvedIntegration.id, client);
  }
  await persistOperationalExecutionIfAvailable(
    {
      kind: "UPSTREAM_IDENTITY",
      mode: report.mode,
      status: "SUCCEEDED",
      targetEnvironment: runtimeTargetEnvironment,
      provider: report.provider,
      actorUserEmail: input.actor.user.email,
      summary: `${input.action} ${input.assignment.externalEmail} in ${input.assignment.organizationSlug}.`,
      providerOperationId: report.adapterResult?.operationId ?? null,
      targetReference: report.adapterResult?.targetRef ?? resolvedIntegration?.endpointReference ?? null,
      reportPath,
      metadata: createExecutionMetadata({
        action: input.action,
        assignmentId: input.assignment.id,
        externalEmail: input.assignment.externalEmail,
        organizationSlug: input.assignment.organizationSlug,
        role: input.assignment.role,
        adapterResult: report.adapterResult,
        command: report.command,
        storedArtifacts
      }),
      operationalIntegration: resolvedIntegration ? mapOperationalIntegrationSnapshot(resolvedIntegration) : null,
      completedAt: report.generatedAt,
      proofArtifacts: createExecutionArtifacts(proofArtifacts, storedArtifacts)
    },
    client
  );
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
