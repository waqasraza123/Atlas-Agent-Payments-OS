function readNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function readText(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function readTextList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function readBoolean(value: string | undefined, fallback: boolean) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

const atlasLogLevels = ["debug", "info", "warn", "error"] as const;
const atlasAppEnvironments = ["local", "development", "staging", "production"] as const;
const atlasIdentityProviderModes = ["local-signed", "identity-bridge", "external-oidc"] as const;
const atlasCommandAdapterModes = ["dry-run", "command"] as const;
const atlasOperationalProofStorageModes = ["disabled", "s3-compatible"] as const;
const atlasUpstreamIdentityProviders = ["generic-oidc-admin", "okta-scim", "auth0-management"] as const;
const atlasAlertDispatchProviders = ["generic-webhook", "slack-webhook"] as const;
const atlasRestoreDrillProviders = ["local-psql", "ssh-postgres", "kubernetes-job"] as const;
const atlasSecretRotationProviders = ["generic-secret-manager", "aws-secrets-manager", "hashicorp-vault"] as const;
const atlasDeploymentAutomationProviders = ["generic-deployer", "github-actions", "argo-rollouts"] as const;
const atlasDefaultSecretRotationKeys = [
  "AUTH_SESSION_SIGNING_SECRET",
  "AUTH_IDENTITY_BRIDGE_SECRET",
  "DATABASE_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "MINIO_SECRET_KEY"
] as const;
const atlasReleaseStages = [
  "internal-concept-demo",
  "functional-alpha",
  "design-partner-pilot",
  "private-beta",
  "public-beta",
  "ga",
  "enterprise-rollout"
] as const;

function readLogLevel(value: string | undefined, fallback: AtlasLogLevel) {
  return atlasLogLevels.includes(value as AtlasLogLevel) ? (value as AtlasLogLevel) : fallback;
}

function readAppEnvironment(value: string | undefined) {
  return atlasAppEnvironments.includes(value as AtlasAppEnvironment)
    ? (value as AtlasAppEnvironment)
    : "local";
}

function readReleaseStage(value: string | undefined) {
  return atlasReleaseStages.includes(value as AtlasReleaseStage)
    ? (value as AtlasReleaseStage)
    : "functional-alpha";
}

function readIdentityProviderMode(value: string | undefined) {
  return atlasIdentityProviderModes.includes(value as AtlasIdentityProviderMode)
    ? (value as AtlasIdentityProviderMode)
    : "local-signed";
}

function readCommandAdapterMode(value: string | undefined, fallback: AtlasCommandAdapterMode) {
  return atlasCommandAdapterModes.includes(value as AtlasCommandAdapterMode)
    ? (value as AtlasCommandAdapterMode)
    : fallback;
}

function readOperationalProofStorageMode(value: string | undefined, fallback: AtlasOperationalProofStorageMode) {
  return atlasOperationalProofStorageModes.includes(value as AtlasOperationalProofStorageMode)
    ? (value as AtlasOperationalProofStorageMode)
    : fallback;
}

function readUpstreamIdentityProvider(value: string | undefined) {
  return atlasUpstreamIdentityProviders.includes(value as AtlasUpstreamIdentityProvider)
    ? (value as AtlasUpstreamIdentityProvider)
    : "generic-oidc-admin";
}

function readAlertDispatchProvider(value: string | undefined) {
  return atlasAlertDispatchProviders.includes(value as AtlasAlertDispatchProvider)
    ? (value as AtlasAlertDispatchProvider)
    : "generic-webhook";
}

function readRestoreDrillProvider(value: string | undefined) {
  return atlasRestoreDrillProviders.includes(value as AtlasRestoreDrillProvider)
    ? (value as AtlasRestoreDrillProvider)
    : "local-psql";
}

function readSecretRotationProvider(value: string | undefined) {
  return atlasSecretRotationProviders.includes(value as AtlasSecretRotationProvider)
    ? (value as AtlasSecretRotationProvider)
    : "generic-secret-manager";
}

function readDeploymentAutomationProvider(value: string | undefined) {
  return atlasDeploymentAutomationProviders.includes(value as AtlasDeploymentAutomationProvider)
    ? (value as AtlasDeploymentAutomationProvider)
    : "generic-deployer";
}

export const atlasProduct = {
  name: "Atlas Agent Payments OS",
  summary: "Premium controls for managed AI agent spend across paid APIs and digital services."
} as const;

export type AtlasLogLevel = (typeof atlasLogLevels)[number];
export type AtlasAppEnvironment = (typeof atlasAppEnvironments)[number];
export type AtlasIdentityProviderMode = (typeof atlasIdentityProviderModes)[number];
export type AtlasCommandAdapterMode = (typeof atlasCommandAdapterModes)[number];
export type AtlasOperationalProofStorageMode = (typeof atlasOperationalProofStorageModes)[number];
export type AtlasUpstreamIdentityProvider = (typeof atlasUpstreamIdentityProviders)[number];
export type AtlasAlertDispatchProvider = (typeof atlasAlertDispatchProviders)[number];
export type AtlasRestoreDrillProvider = (typeof atlasRestoreDrillProviders)[number];
export type AtlasSecretRotationProvider = (typeof atlasSecretRotationProviders)[number];
export type AtlasDeploymentAutomationProvider = (typeof atlasDeploymentAutomationProviders)[number];
export type AtlasReleaseStage = (typeof atlasReleaseStages)[number];
export type AtlasRuntimeService = "api" | "web" | "worker";
export type AtlasPromotionTarget = Exclude<AtlasAppEnvironment, "local">;
export type AtlasOperationalIntegrationKind =
  | "UPSTREAM_IDENTITY"
  | "RESTORE_DRILL"
  | "SECRET_ROTATION"
  | "DEPLOYMENT_AUTOMATION"
  | "PROOF_STORAGE"
  | "ALERT_DISPATCH";
export type AtlasOperationalIntegrationVerificationStatus = "PENDING" | "VERIFIED" | "STALE" | "FAILED";

export type AtlasStructuredLogPayload = {
  timestamp: string;
  level: AtlasLogLevel;
  service: string;
  appEnv: string;
  nodeEnv: string;
  releaseStage: string;
  message: string;
} & Record<string, unknown>;

export const premiumSurfaces = [
  { href: "/buyer", label: "Controls", title: "Buyer workspace" },
  { href: "/seller", label: "Services", title: "Seller workspace" },
  { href: "/operator", label: "Oversight", title: "Operator workspace" }
] as const;

export const appRuntime = {
  nodeEnv: readText(process.env.NODE_ENV, "development"),
  appEnv: readAppEnvironment(process.env.APP_ENV),
  logLevel: readLogLevel(process.env.LOG_LEVEL, "info"),
  releaseStage: readReleaseStage(process.env.RELEASE_STAGE),
  healthcheckTimeoutMs: readNumber(process.env.HEALTHCHECK_TIMEOUT_MS, 2000)
} as const;

export const deploymentRuntime = {
  revision: readText(process.env.APP_REVISION, "local-development"),
  deploymentSlot: readText(process.env.DEPLOYMENT_SLOT, "local"),
  backupDirectory: readText(process.env.DATABASE_BACKUP_DIR, "backups"),
  releaseArtifactId: readText(process.env.RELEASE_ARTIFACT_ID, "local-artifact"),
  releaseArtifactSha256: readText(
    process.env.RELEASE_ARTIFACT_SHA256,
    "0000000000000000000000000000000000000000000000000000000000000000"
  )
} as const;

export const authRuntime = {
  providerMode: readIdentityProviderMode(process.env.AUTH_PROVIDER_MODE),
  sessionSigningSecret: readText(process.env.AUTH_SESSION_SIGNING_SECRET, "atlas-local-session-secret"),
  identityBridgeSecret: readText(process.env.AUTH_IDENTITY_BRIDGE_SECRET, "atlas-identity-bridge-secret"),
  identityBridgeProvider: readText(process.env.AUTH_IDENTITY_BRIDGE_PROVIDER, "generic-sso"),
  externalOidcIssuer: readText(process.env.AUTH_EXTERNAL_OIDC_ISSUER, "https://id.atlas.local"),
  externalOidcAudience: readText(process.env.AUTH_EXTERNAL_OIDC_AUDIENCE, "atlas-agent-payments-os"),
  externalOidcProvider: readText(process.env.AUTH_EXTERNAL_OIDC_PROVIDER, "external-oidc"),
  externalOidcJwksJson: readText(process.env.AUTH_EXTERNAL_OIDC_JWKS_JSON, '{"keys":[]}'),
  identitySessionTtlMinutes: readNumber(process.env.AUTH_IDENTITY_SESSION_TTL_MINUTES, 480),
  localSessionTtlMinutes: readNumber(process.env.AUTH_LOCAL_SESSION_TTL_MINUTES, 480),
  supportAccessTtlMinutes: readNumber(process.env.AUTH_SUPPORT_ACCESS_TTL_MINUTES, 60),
  supportAccessReviewTtlHours: readNumber(process.env.AUTH_SUPPORT_ACCESS_REVIEW_TTL_HOURS, 24),
  supportAccessReviewLookaheadHours: readNumber(process.env.AUTH_SUPPORT_ACCESS_REVIEW_LOOKAHEAD_HOURS, 24),
  supportAccessAllowedEmails: readTextList(process.env.AUTH_SUPPORT_ACCESS_ALLOWED_EMAILS)
} as const;

export const upstreamIdentityRuntime = {
  mode: readCommandAdapterMode(process.env.AUTH_UPSTREAM_IDENTITY_MODE, "dry-run"),
  provider: readUpstreamIdentityProvider(process.env.AUTH_UPSTREAM_IDENTITY_PROVIDER),
  command: readOptionalText(process.env.AUTH_UPSTREAM_IDENTITY_COMMAND),
  reportDirectory: readText(process.env.AUTH_UPSTREAM_IDENTITY_REPORT_DIR, "operations-artifacts/upstream-identity"),
  oktaOrgUrl: readOptionalText(process.env.AUTH_OKTA_ORG_URL),
  oktaScimAppId: readOptionalText(process.env.AUTH_OKTA_SCIM_APP_ID),
  oktaApiToken: readOptionalText(process.env.AUTH_OKTA_API_TOKEN),
  auth0Domain: readOptionalText(process.env.AUTH_AUTH0_DOMAIN),
  auth0OrganizationId: readOptionalText(process.env.AUTH_AUTH0_ORGANIZATION_ID),
  auth0ManagementApiToken: readOptionalText(process.env.AUTH_AUTH0_MANAGEMENT_API_TOKEN)
} as const;

export const apiRuntime = {
  port: readNumber(process.env.API_PORT, 4000),
  baseUrl: readText(process.env.API_BASE_URL, `http://localhost:${readNumber(process.env.API_PORT, 4000)}`)
} as const;

export const webRuntime = {
  baseUrl: readText(process.env.NEXT_PUBLIC_APP_URL, "http://localhost:3000")
} as const;

export const workerRuntime = {
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379"
} as const;

export const paymentRuntime = {
  stripeSecretKey: readOptionalText(process.env.STRIPE_SECRET_KEY),
  stripeWebhookSecret: readOptionalText(process.env.STRIPE_WEBHOOK_SECRET),
  stripeEnabled: Boolean(readOptionalText(process.env.STRIPE_SECRET_KEY))
} as const;

export const programmableSettlementRuntime = {
  enabled: readBoolean(process.env.PROGRAMMABLE_SETTLEMENT_ENABLED, false),
  chainKey: process.env.PROGRAMMABLE_SETTLEMENT_CHAIN_KEY ?? "BASE_SEPOLIA",
  chainId: readNumber(process.env.PROGRAMMABLE_SETTLEMENT_CHAIN_ID, 84532),
  networkName: process.env.PROGRAMMABLE_SETTLEMENT_NETWORK_NAME ?? "Base Sepolia",
  assetSymbol: process.env.PROGRAMMABLE_SETTLEMENT_ASSET_SYMBOL ?? "USDC",
  explorerBaseUrl:
    process.env.PROGRAMMABLE_SETTLEMENT_EXPLORER_BASE_URL ?? "https://sepolia.basescan.org/tx/",
  requiredConfirmations: readNumber(process.env.PROGRAMMABLE_SETTLEMENT_REQUIRED_CONFIRMATIONS, 2)
} as const;

export const storageRuntime = {
  endpoint: process.env.MINIO_ENDPOINT ?? "localhost",
  port: readNumber(process.env.MINIO_PORT, 9000),
  useSsl: process.env.MINIO_USE_SSL === "true",
  region: readText(process.env.MINIO_REGION, "us-east-1"),
  accessKey: process.env.MINIO_ACCESS_KEY ?? "atlasminio",
  secretKey: process.env.MINIO_SECRET_KEY ?? "atlasminio",
  bucketReceipts: process.env.MINIO_BUCKET_RECEIPTS ?? "atlas-receipts",
  bucketOperations: process.env.MINIO_BUCKET_OPERATIONS ?? "atlas-operations"
} as const;

function readOperationsRuntime(env: Record<string, string | undefined>) {
  const configuredKeys = readTextList(env.SECRET_ROTATION_REQUIRED_KEYS);
  const appEnv = readAppEnvironment(env.APP_ENV);

  return {
    restoreDrillMaxAgeHours: readNumber(env.RESTORE_DRILL_MAX_AGE_HOURS, 168),
    secretRotationMaxAgeHours: readNumber(env.SECRET_ROTATION_MAX_AGE_HOURS, 720),
    proofStorageMode: readOperationalProofStorageMode(
      env.OPERATIONAL_PROOF_STORAGE_MODE,
      appEnv === "local" ? "disabled" : "s3-compatible"
    ),
    proofStoragePrefix: readText(env.OPERATIONAL_PROOF_STORAGE_PREFIX, "rollout-proof"),
    proofStoragePublicBaseUrl: readOptionalText(env.OPERATIONAL_PROOF_STORAGE_PUBLIC_BASE_URL),
    secretRotationRequiredKeys:
      configuredKeys.length > 0 ? configuredKeys : [...atlasDefaultSecretRotationKeys]
  } as const;
}

export const operationsRuntime = readOperationsRuntime(process.env);

export const restoreDrillRuntime = {
  mode: readCommandAdapterMode(process.env.RESTORE_DRILL_MODE, "dry-run"),
  command: readOptionalText(process.env.RESTORE_DRILL_COMMAND),
  provider: readRestoreDrillProvider(process.env.RESTORE_DRILL_PROVIDER),
  reportDirectory: readText(process.env.RESTORE_DRILL_REPORT_DIR, "restore-drills"),
  sshDestination: readOptionalText(process.env.RESTORE_DRILL_SSH_DESTINATION),
  kubernetesNamespace: readOptionalText(process.env.RESTORE_DRILL_KUBERNETES_NAMESPACE),
  kubernetesJobTemplate: readOptionalText(process.env.RESTORE_DRILL_KUBERNETES_JOB_TEMPLATE)
} as const;

export const secretRotationRuntime = {
  mode: readCommandAdapterMode(process.env.SECRET_ROTATION_MODE, "dry-run"),
  provider: readSecretRotationProvider(process.env.SECRET_ROTATION_PROVIDER),
  command: readOptionalText(process.env.SECRET_ROTATION_COMMAND),
  reportDirectory: readText(process.env.SECRET_ROTATION_REPORT_DIR, "rotation-executions"),
  manifestDirectory: readText(process.env.SECRET_ROTATION_MANIFEST_DIR, "rotation-manifests"),
  awsRegion: readOptionalText(process.env.SECRET_ROTATION_AWS_REGION),
  awsPrefix: readOptionalText(process.env.SECRET_ROTATION_AWS_PREFIX),
  vaultAddress: readOptionalText(process.env.SECRET_ROTATION_VAULT_ADDR),
  vaultMount: readOptionalText(process.env.SECRET_ROTATION_VAULT_MOUNT)
} as const;

export const deploymentAutomationRuntime = {
  mode: readCommandAdapterMode(process.env.DEPLOYMENT_AUTOMATION_MODE, "dry-run"),
  command: readOptionalText(process.env.DEPLOYMENT_AUTOMATION_COMMAND),
  provider: readDeploymentAutomationProvider(process.env.DEPLOYMENT_AUTOMATION_PROVIDER),
  reportDirectory: readText(process.env.DEPLOYMENT_AUTOMATION_REPORT_DIR, "promotion-executions"),
  githubRepository: readOptionalText(process.env.DEPLOYMENT_AUTOMATION_GITHUB_REPOSITORY),
  githubWorkflow: readOptionalText(process.env.DEPLOYMENT_AUTOMATION_GITHUB_WORKFLOW),
  githubRef: readText(process.env.DEPLOYMENT_AUTOMATION_GITHUB_REF, "main"),
  githubApiUrl: readText(process.env.DEPLOYMENT_AUTOMATION_GITHUB_API_URL, "https://api.github.com"),
  argoServer: readOptionalText(process.env.DEPLOYMENT_AUTOMATION_ARGO_SERVER),
  argoApplication: readOptionalText(process.env.DEPLOYMENT_AUTOMATION_ARGO_APPLICATION)
} as const;

export const observabilityRuntime = {
  telemetryRetentionDays: readNumber(process.env.OBSERVABILITY_TELEMETRY_RETENTION_DAYS, 30),
  snapshotDirectory: readText(process.env.OBSERVABILITY_SNAPSHOT_DIR, "operations-artifacts/observability/snapshots"),
  alertDispatchMode: readCommandAdapterMode(process.env.OBSERVABILITY_ALERT_DISPATCH_MODE, "dry-run"),
  alertDispatchProvider: readAlertDispatchProvider(process.env.OBSERVABILITY_ALERT_DISPATCH_PROVIDER),
  alertDispatchCommand: readOptionalText(process.env.OBSERVABILITY_ALERT_DISPATCH_COMMAND),
  alertDispatchReportDirectory: readText(
    process.env.OBSERVABILITY_ALERT_DISPATCH_REPORT_DIR,
    "operations-artifacts/observability/dispatches"
  ),
  alertDispatchWebhookUrl: readOptionalText(process.env.OBSERVABILITY_ALERT_DISPATCH_WEBHOOK_URL),
  alertDispatchSlackWebhookUrl: readOptionalText(process.env.OBSERVABILITY_ALERT_DISPATCH_SLACK_WEBHOOK_URL)
} as const;

export type AtlasOperationalStoredArtifact = {
  provider: Exclude<AtlasOperationalProofStorageMode, "disabled">;
  bucket: string;
  objectKey: string;
  storageUrl: string;
  contentType: string;
  sha256: string;
  sizeBytes: number;
  etag: string | null;
  uploadedAt: string;
};

export function createAtlasStructuredLogPayload(
  service: string,
  level: AtlasLogLevel,
  message: string,
  fields: Record<string, unknown> = {}
): AtlasStructuredLogPayload {
  return {
    timestamp: new Date().toISOString(),
    level,
    service,
    appEnv: appRuntime.appEnv,
    nodeEnv: appRuntime.nodeEnv,
    releaseStage: appRuntime.releaseStage,
    message,
    ...fields
  };
}

export function writeAtlasStructuredLog(
  service: string,
  level: AtlasLogLevel,
  message: string,
  fields: Record<string, unknown> = {}
) {
  const payload = createAtlasStructuredLogPayload(service, level, message, fields);
  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export type AtlasRuntimeValidationIssue = {
  variable: string;
  message: string;
};

export type AtlasRuntimeValidationResult = {
  service: AtlasRuntimeService;
  appEnv: AtlasAppEnvironment;
  ok: boolean;
  requiredVariables: string[];
  issues: AtlasRuntimeValidationIssue[];
};

export type AtlasReleaseManifest = {
  product: string;
  service: AtlasRuntimeService;
  appEnv: AtlasAppEnvironment;
  releaseStage: AtlasReleaseStage;
  authProviderMode: AtlasIdentityProviderMode;
  revision: string;
  deploymentSlot: string;
  artifact: {
    id: string;
    sha256: string;
  };
  generatedAt: string;
  baseUrls: {
    api: string;
    web: string;
  };
  requiredVariables: string[];
  commands: {
    releaseVerification: string;
    runtimeVerification: string;
    backup: string;
    restore: string;
    rollbackReadiness: string;
  };
};

export type AtlasSecretRotationManifest = {
  version: 1;
  environment: AtlasPromotionTarget;
  rotatedBy: string;
  reason: string;
  generatedAt: string;
  maxAgeHours: number;
  secrets: Array<{
    key: string;
    rotatedAt: string;
  }>;
};

export type AtlasAutomationCommandResult = {
  configured: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type AtlasAutomationAdapterResult = {
  version: 1;
  adapter: string;
  provider: string;
  operationId: string;
  summary: string;
  targetRef: string | null;
  metadata: Record<string, string | number | boolean | null>;
};

export type AtlasOperationalIntegrationSnapshot = {
  id: string;
  kind: AtlasOperationalIntegrationKind;
  targetEnvironment: Uppercase<AtlasPromotionTarget>;
  provider: string;
  label: string;
  ownerEmail: string;
  endpointReference: string | null;
  secretReference: string | null;
  configReference: string | null;
  verificationStatus: AtlasOperationalIntegrationVerificationStatus;
  lastVerifiedAt: string | null;
};

export type AtlasSecretRotationExecutionReport = {
  version: 1;
  environment: AtlasPromotionTarget;
  provider: string;
  mode: AtlasCommandAdapterMode;
  rotatedBy: string;
  reason: string;
  generatedAt: string;
  reportPath: string;
  manifestPath: string;
  manifest: AtlasSecretRotationManifest;
  operationalIntegration: AtlasOperationalIntegrationSnapshot | null;
  command: AtlasAutomationCommandResult | null;
  adapterResult: AtlasAutomationAdapterResult | null;
};

export type AtlasRestoreDrillReport = {
  version: 1;
  appEnv: AtlasAppEnvironment;
  releaseStage: AtlasReleaseStage;
  revision: string;
  backupPath: string;
  manifestPath: string;
  executedRestore: boolean;
  targetEnvironment: AtlasAppEnvironment;
  targetLabel: string;
  backupIntegrity: {
    version: 1;
    filePath: string;
    sha256: string;
    sizeBytes: number;
    generatedAt: string;
  };
  executionMode: AtlasCommandAdapterMode;
  executor: string;
  targetHost: string | null;
  proofArtifactPath: string | null;
  execution: {
    databaseUrlRedacted: string;
    stdout: string;
  } | null;
  operationalIntegration: AtlasOperationalIntegrationSnapshot | null;
  adapterResult: AtlasAutomationAdapterResult | null;
  completedAt: string;
};

export type AtlasPromotionExecutionReport = {
  version: 1;
  fromEnv: AtlasPromotionTarget;
  toEnv: AtlasPromotionTarget;
  services: AtlasRuntimeService[];
  mode: AtlasCommandAdapterMode;
  generatedAt: string;
  reportPath: string;
  bundlePath: string;
  bundleSha256: string;
  provider: string;
  operationalIntegration: AtlasOperationalIntegrationSnapshot | null;
  command: AtlasAutomationCommandResult | null;
  adapterResult: AtlasAutomationAdapterResult | null;
};

export type AtlasUpstreamIdentityLifecycleAction = "PROVISION" | "SUSPEND" | "REACTIVATE" | "REVOKE";

export type AtlasUpstreamIdentityLifecycleReport = {
  version: 1;
  provider: string;
  mode: AtlasCommandAdapterMode;
  action: AtlasUpstreamIdentityLifecycleAction;
  generatedAt: string;
  reportPath: string;
  actorUserEmail: string;
  assignmentId: string;
  externalEmail: string;
  organizationSlug: string;
  role: string;
  operationalIntegration: AtlasOperationalIntegrationSnapshot | null;
  command: AtlasAutomationCommandResult | null;
  adapterResult: AtlasAutomationAdapterResult | null;
};

function atlasBaseRuntimeVariables() {
  return ["APP_ENV", "LOG_LEVEL", "RELEASE_STAGE", "HEALTHCHECK_TIMEOUT_MS"] as const;
}

function atlasServiceRuntimeVariables(service: AtlasRuntimeService) {
  if (service === "api") {
    return [
      ...atlasBaseRuntimeVariables(),
      "AUTH_PROVIDER_MODE",
      "AUTH_SESSION_SIGNING_SECRET",
      "AUTH_SUPPORT_ACCESS_REVIEW_TTL_HOURS",
      "API_PORT",
      "API_BASE_URL",
      "NEXT_PUBLIC_APP_URL",
      "DATABASE_URL",
      "REDIS_URL",
      "MINIO_ENDPOINT",
      "MINIO_PORT",
      "MINIO_ACCESS_KEY",
      "MINIO_SECRET_KEY",
      "MINIO_BUCKET_RECEIPTS"
    ] as const;
  }

  if (service === "worker") {
    return [...atlasBaseRuntimeVariables(), "REDIS_URL", "DATABASE_URL"] as const;
  }

  return [
    ...atlasBaseRuntimeVariables(),
    "AUTH_SESSION_SIGNING_SECRET",
    "AUTH_PROVIDER_MODE",
    "AUTH_SUPPORT_ACCESS_REVIEW_TTL_HOURS",
    "NEXT_PUBLIC_APP_URL",
    "API_BASE_URL"
  ] as const;
}

function requireRuntimeVariable(
  issues: AtlasRuntimeValidationIssue[],
  env: Record<string, string | undefined>,
  variable: string,
  message: string
) {
  const value = env[variable];

  if (!value || value.trim().length === 0) {
    issues.push({
      variable,
      message
    });
  }
}

export function listAtlasRuntimeVariables(service: AtlasRuntimeService) {
  return [...atlasServiceRuntimeVariables(service)];
}

export function validateAtlasRuntimeConfiguration(
  service: AtlasRuntimeService,
  env: Record<string, string | undefined> = process.env
): AtlasRuntimeValidationResult {
  const appEnv = readAppEnvironment(env.APP_ENV);
  const providerMode = readIdentityProviderMode(env.AUTH_PROVIDER_MODE);
  const requiredVariables = [
    ...listAtlasRuntimeVariables(service),
    ...(appEnv !== "local"
      ? ["APP_REVISION", "DEPLOYMENT_SLOT", "RELEASE_ARTIFACT_ID", "RELEASE_ARTIFACT_SHA256"]
      : []),
    ...(service !== "worker" && providerMode === "identity-bridge"
      ? ["AUTH_IDENTITY_BRIDGE_SECRET", "AUTH_IDENTITY_BRIDGE_PROVIDER", "AUTH_IDENTITY_SESSION_TTL_MINUTES"]
      : []),
    ...(service !== "worker" && providerMode === "external-oidc"
      ? [
          "AUTH_EXTERNAL_OIDC_ISSUER",
          "AUTH_EXTERNAL_OIDC_AUDIENCE",
          "AUTH_EXTERNAL_OIDC_PROVIDER",
          "AUTH_EXTERNAL_OIDC_JWKS_JSON",
          "AUTH_IDENTITY_SESSION_TTL_MINUTES"
        ]
      : [])
  ];
  const issues = requiredVariables.flatMap((variable) => {
    const value = env[variable];
    return value && value.trim().length > 0
      ? []
      : [
          {
            variable,
            message: `${variable} is required for the ${service} runtime in ${appEnv}.`
          }
        ];
  });

  const commandModeRequirements = [
    {
      variable: "AUTH_UPSTREAM_IDENTITY_COMMAND",
      modeVariable: "AUTH_UPSTREAM_IDENTITY_MODE",
      modeValue: readCommandAdapterMode(env.AUTH_UPSTREAM_IDENTITY_MODE, "dry-run")
    },
    {
      variable: "RESTORE_DRILL_COMMAND",
      modeVariable: "RESTORE_DRILL_MODE",
      modeValue: readCommandAdapterMode(env.RESTORE_DRILL_MODE, "dry-run")
    },
    {
      variable: "SECRET_ROTATION_COMMAND",
      modeVariable: "SECRET_ROTATION_MODE",
      modeValue: readCommandAdapterMode(env.SECRET_ROTATION_MODE, "dry-run")
    },
    {
      variable: "DEPLOYMENT_AUTOMATION_COMMAND",
      modeVariable: "DEPLOYMENT_AUTOMATION_MODE",
      modeValue: readCommandAdapterMode(env.DEPLOYMENT_AUTOMATION_MODE, "dry-run")
    },
    {
      variable: "OBSERVABILITY_ALERT_DISPATCH_COMMAND",
      modeVariable: "OBSERVABILITY_ALERT_DISPATCH_MODE",
      modeValue: readCommandAdapterMode(env.OBSERVABILITY_ALERT_DISPATCH_MODE, "dry-run")
    }
  ];

  for (const requirement of commandModeRequirements) {
    if (requirement.modeValue === "command") {
      const value = env[requirement.variable];

      if (!value || value.trim().length === 0) {
        issues.push({
          variable: requirement.variable,
          message: `${requirement.variable} is required when ${requirement.modeVariable}=command.`
        });
      }
    }
  }

  if (readCommandAdapterMode(env.AUTH_UPSTREAM_IDENTITY_MODE, "dry-run") === "command") {
    const provider = readUpstreamIdentityProvider(env.AUTH_UPSTREAM_IDENTITY_PROVIDER);

    if (provider === "okta-scim") {
      requireRuntimeVariable(
        issues,
        env,
        "AUTH_OKTA_ORG_URL",
        "AUTH_OKTA_ORG_URL is required when AUTH_UPSTREAM_IDENTITY_PROVIDER=okta-scim."
      );
      requireRuntimeVariable(
        issues,
        env,
        "AUTH_OKTA_SCIM_APP_ID",
        "AUTH_OKTA_SCIM_APP_ID is required when AUTH_UPSTREAM_IDENTITY_PROVIDER=okta-scim."
      );
      requireRuntimeVariable(
        issues,
        env,
        "AUTH_OKTA_API_TOKEN",
        "AUTH_OKTA_API_TOKEN is required when AUTH_UPSTREAM_IDENTITY_PROVIDER=okta-scim."
      );
    }

    if (provider === "auth0-management") {
      requireRuntimeVariable(
        issues,
        env,
        "AUTH_AUTH0_DOMAIN",
        "AUTH_AUTH0_DOMAIN is required when AUTH_UPSTREAM_IDENTITY_PROVIDER=auth0-management."
      );
      requireRuntimeVariable(
        issues,
        env,
        "AUTH_AUTH0_ORGANIZATION_ID",
        "AUTH_AUTH0_ORGANIZATION_ID is required when AUTH_UPSTREAM_IDENTITY_PROVIDER=auth0-management."
      );
      requireRuntimeVariable(
        issues,
        env,
        "AUTH_AUTH0_MANAGEMENT_API_TOKEN",
        "AUTH_AUTH0_MANAGEMENT_API_TOKEN is required when AUTH_UPSTREAM_IDENTITY_PROVIDER=auth0-management."
      );
    }
  }

  if (readCommandAdapterMode(env.RESTORE_DRILL_MODE, "dry-run") === "command") {
    const provider = readRestoreDrillProvider(env.RESTORE_DRILL_PROVIDER);

    if (provider === "ssh-postgres") {
      requireRuntimeVariable(
        issues,
        env,
        "RESTORE_DRILL_SSH_DESTINATION",
        "RESTORE_DRILL_SSH_DESTINATION is required when RESTORE_DRILL_PROVIDER=ssh-postgres."
      );
    }

    if (provider === "kubernetes-job") {
      requireRuntimeVariable(
        issues,
        env,
        "RESTORE_DRILL_KUBERNETES_NAMESPACE",
        "RESTORE_DRILL_KUBERNETES_NAMESPACE is required when RESTORE_DRILL_PROVIDER=kubernetes-job."
      );
      requireRuntimeVariable(
        issues,
        env,
        "RESTORE_DRILL_KUBERNETES_JOB_TEMPLATE",
        "RESTORE_DRILL_KUBERNETES_JOB_TEMPLATE is required when RESTORE_DRILL_PROVIDER=kubernetes-job."
      );
    }
  }

  if (readCommandAdapterMode(env.SECRET_ROTATION_MODE, "dry-run") === "command") {
    const provider = readSecretRotationProvider(env.SECRET_ROTATION_PROVIDER);

    if (provider === "aws-secrets-manager") {
      requireRuntimeVariable(
        issues,
        env,
        "SECRET_ROTATION_AWS_REGION",
        "SECRET_ROTATION_AWS_REGION is required when SECRET_ROTATION_PROVIDER=aws-secrets-manager."
      );
      requireRuntimeVariable(
        issues,
        env,
        "SECRET_ROTATION_AWS_PREFIX",
        "SECRET_ROTATION_AWS_PREFIX is required when SECRET_ROTATION_PROVIDER=aws-secrets-manager."
      );
    }

    if (provider === "hashicorp-vault") {
      requireRuntimeVariable(
        issues,
        env,
        "SECRET_ROTATION_VAULT_ADDR",
        "SECRET_ROTATION_VAULT_ADDR is required when SECRET_ROTATION_PROVIDER=hashicorp-vault."
      );
      requireRuntimeVariable(
        issues,
        env,
        "SECRET_ROTATION_VAULT_MOUNT",
        "SECRET_ROTATION_VAULT_MOUNT is required when SECRET_ROTATION_PROVIDER=hashicorp-vault."
      );
    }
  }

  if (readCommandAdapterMode(env.DEPLOYMENT_AUTOMATION_MODE, "dry-run") === "command") {
    const provider = readDeploymentAutomationProvider(env.DEPLOYMENT_AUTOMATION_PROVIDER);

    if (provider === "github-actions") {
      requireRuntimeVariable(
        issues,
        env,
        "DEPLOYMENT_AUTOMATION_GITHUB_REPOSITORY",
        "DEPLOYMENT_AUTOMATION_GITHUB_REPOSITORY is required when DEPLOYMENT_AUTOMATION_PROVIDER=github-actions."
      );
      requireRuntimeVariable(
        issues,
        env,
        "DEPLOYMENT_AUTOMATION_GITHUB_WORKFLOW",
        "DEPLOYMENT_AUTOMATION_GITHUB_WORKFLOW is required when DEPLOYMENT_AUTOMATION_PROVIDER=github-actions."
      );
    }

    if (provider === "argo-rollouts") {
      requireRuntimeVariable(
        issues,
        env,
        "DEPLOYMENT_AUTOMATION_ARGO_SERVER",
        "DEPLOYMENT_AUTOMATION_ARGO_SERVER is required when DEPLOYMENT_AUTOMATION_PROVIDER=argo-rollouts."
      );
      requireRuntimeVariable(
        issues,
        env,
        "DEPLOYMENT_AUTOMATION_ARGO_APPLICATION",
        "DEPLOYMENT_AUTOMATION_ARGO_APPLICATION is required when DEPLOYMENT_AUTOMATION_PROVIDER=argo-rollouts."
      );
    }
  }

  if (readCommandAdapterMode(env.OBSERVABILITY_ALERT_DISPATCH_MODE, "dry-run") === "command") {
    const provider = readAlertDispatchProvider(env.OBSERVABILITY_ALERT_DISPATCH_PROVIDER);

    if (provider === "generic-webhook") {
      requireRuntimeVariable(
        issues,
        env,
        "OBSERVABILITY_ALERT_DISPATCH_WEBHOOK_URL",
        "OBSERVABILITY_ALERT_DISPATCH_WEBHOOK_URL is required when OBSERVABILITY_ALERT_DISPATCH_PROVIDER=generic-webhook."
      );
    }

    if (provider === "slack-webhook") {
      requireRuntimeVariable(
        issues,
        env,
        "OBSERVABILITY_ALERT_DISPATCH_SLACK_WEBHOOK_URL",
        "OBSERVABILITY_ALERT_DISPATCH_SLACK_WEBHOOK_URL is required when OBSERVABILITY_ALERT_DISPATCH_PROVIDER=slack-webhook."
      );
    }
  }

  if (readOperationalProofStorageMode(
    env.OPERATIONAL_PROOF_STORAGE_MODE,
    readAppEnvironment(env.APP_ENV) === "local" ? "disabled" : "s3-compatible"
  ) === "s3-compatible") {
    const requiresStorageConfiguration = service === "api" || service === "web";

    if (requiresStorageConfiguration) {
      requireRuntimeVariable(
        issues,
        env,
        "MINIO_REGION",
        "MINIO_REGION is required when OPERATIONAL_PROOF_STORAGE_MODE=s3-compatible."
      );
      requireRuntimeVariable(
        issues,
        env,
        "MINIO_ENDPOINT",
        "MINIO_ENDPOINT is required when OPERATIONAL_PROOF_STORAGE_MODE=s3-compatible."
      );
      requireRuntimeVariable(
        issues,
        env,
        "MINIO_PORT",
        "MINIO_PORT is required when OPERATIONAL_PROOF_STORAGE_MODE=s3-compatible."
      );
      requireRuntimeVariable(
        issues,
        env,
        "MINIO_ACCESS_KEY",
        "MINIO_ACCESS_KEY is required when OPERATIONAL_PROOF_STORAGE_MODE=s3-compatible."
      );
      requireRuntimeVariable(
        issues,
        env,
        "MINIO_SECRET_KEY",
        "MINIO_SECRET_KEY is required when OPERATIONAL_PROOF_STORAGE_MODE=s3-compatible."
      );
      requireRuntimeVariable(
        issues,
        env,
        "MINIO_BUCKET_OPERATIONS",
        "MINIO_BUCKET_OPERATIONS is required when OPERATIONAL_PROOF_STORAGE_MODE=s3-compatible."
      );
    }
  }

  return {
    service,
    appEnv,
    ok: issues.length === 0,
    requiredVariables,
    issues
  };
}

export function assertAtlasRuntimeConfiguration(
  service: AtlasRuntimeService,
  env: Record<string, string | undefined> = process.env
) {
  const result = validateAtlasRuntimeConfiguration(service, env);

  if (result.ok) {
    return result;
  }

  throw new Error(
    [`Invalid runtime configuration for ${service}.`, ...result.issues.map((issue) => issue.message)].join(" ")
  );
}

export function createAtlasReleaseManifest(
  service: AtlasRuntimeService,
  env: Record<string, string | undefined> = process.env
): AtlasReleaseManifest {
  return {
    product: atlasProduct.name,
    service,
    appEnv: readAppEnvironment(env.APP_ENV),
    releaseStage: readReleaseStage(env.RELEASE_STAGE),
    authProviderMode: readIdentityProviderMode(env.AUTH_PROVIDER_MODE),
    revision: readText(env.APP_REVISION, deploymentRuntime.revision),
    deploymentSlot: readText(env.DEPLOYMENT_SLOT, deploymentRuntime.deploymentSlot),
    artifact: {
      id: readText(env.RELEASE_ARTIFACT_ID, deploymentRuntime.releaseArtifactId),
      sha256: readText(env.RELEASE_ARTIFACT_SHA256, deploymentRuntime.releaseArtifactSha256)
    },
    generatedAt: new Date().toISOString(),
    baseUrls: {
      api: readText(env.API_BASE_URL, apiRuntime.baseUrl),
      web: readText(env.NEXT_PUBLIC_APP_URL, webRuntime.baseUrl)
    },
    requiredVariables: listAtlasRuntimeVariables(service),
    commands: {
      releaseVerification: "pnpm verify:release",
      runtimeVerification: "pnpm verify:ops",
      backup: "pnpm db:backup",
      restore: "pnpm db:restore <backup-file>",
      rollbackReadiness: "pnpm verify:rollback"
    }
  };
}

const atlasPromotionOrder: AtlasPromotionTarget[] = ["development", "staging", "production"];

export function canAtlasPromoteEnvironment(fromEnv: AtlasPromotionTarget, toEnv: AtlasPromotionTarget) {
  const fromIndex = atlasPromotionOrder.indexOf(fromEnv);
  const toIndex = atlasPromotionOrder.indexOf(toEnv);

  return fromIndex >= 0 && toIndex >= 0 && toIndex === fromIndex + 1;
}

export function validateAtlasPromotionReadiness(
  toEnv: AtlasPromotionTarget,
  env: Record<string, string | undefined> = process.env
) {
  const issues: string[] = [];
  const providerMode = readIdentityProviderMode(env.AUTH_PROVIDER_MODE);
  const allowedSupportEmails = readTextList(env.AUTH_SUPPORT_ACCESS_ALLOWED_EMAILS);

  if (toEnv === "staging" && providerMode === "local-signed") {
    issues.push("Promotion to staging requires AUTH_PROVIDER_MODE=identity-bridge or AUTH_PROVIDER_MODE=external-oidc.");
  }

  if (toEnv === "production" && providerMode !== "external-oidc") {
    issues.push("Promotion to production requires AUTH_PROVIDER_MODE=external-oidc.");
  }

  if (toEnv === "production" && allowedSupportEmails.length === 0) {
    issues.push("Promotion to production requires AUTH_SUPPORT_ACCESS_ALLOWED_EMAILS to be explicitly configured.");
  }

  if (toEnv === "production" && readNumber(env.AUTH_SUPPORT_ACCESS_REVIEW_TTL_HOURS, 0) <= 0) {
    issues.push("Promotion to production requires AUTH_SUPPORT_ACCESS_REVIEW_TTL_HOURS to be explicitly configured.");
  }

  const revision = readText(env.APP_REVISION, deploymentRuntime.revision);
  const artifactId = readText(env.RELEASE_ARTIFACT_ID, deploymentRuntime.releaseArtifactId);
  const artifactSha256 = readText(env.RELEASE_ARTIFACT_SHA256, deploymentRuntime.releaseArtifactSha256);

  if ((toEnv === "staging" || toEnv === "production") && revision === "local-development") {
    issues.push(`Promotion to ${toEnv} requires APP_REVISION to identify a non-local release.`);
  }

  if ((toEnv === "staging" || toEnv === "production") && artifactId === "local-artifact") {
    issues.push(`Promotion to ${toEnv} requires RELEASE_ARTIFACT_ID to identify the release artifact.`);
  }

  if ((toEnv === "staging" || toEnv === "production") && !/^[a-f0-9]{64}$/i.test(artifactSha256)) {
    issues.push(`Promotion to ${toEnv} requires RELEASE_ARTIFACT_SHA256 to be a 64-character artifact digest.`);
  }

  return issues;
}

function validateTimestampAge(label: string, value: string, maxAgeHours: number, issues: string[]) {
  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    issues.push(`${label} must be a valid ISO timestamp.`);
    return;
  }

  if (Date.now() - parsed > maxAgeHours * 60 * 60 * 1000) {
    issues.push(`${label} is older than the allowed ${maxAgeHours}-hour freshness window.`);
  }
}

export function validateAtlasSecretRotationManifest(
  targetEnv: AtlasPromotionTarget,
  manifest: AtlasSecretRotationManifest,
  env: Record<string, string | undefined> = process.env
) {
  const runtime = readOperationsRuntime(env);
  const issues: string[] = [];

  if (manifest.version !== 1) {
    issues.push("Secret rotation manifest version must equal 1.");
  }

  if (manifest.environment !== targetEnv) {
    issues.push(`Secret rotation manifest must target ${targetEnv}.`);
  }

  if (typeof manifest.rotatedBy !== "string" || manifest.rotatedBy.trim().length < 5) {
    issues.push("Secret rotation manifest must include the operator who completed the rotation.");
  }

  if (typeof manifest.reason !== "string" || manifest.reason.trim().length < 12) {
    issues.push("Secret rotation manifest must include a durable operational reason.");
  }

  validateTimestampAge("Secret rotation manifest generatedAt", manifest.generatedAt, runtime.secretRotationMaxAgeHours, issues);

  if (!Array.isArray(manifest.secrets) || manifest.secrets.length === 0) {
    issues.push("Secret rotation manifest must include at least one rotated secret.");
    return issues;
  }

  const seenKeys = new Set<string>();
  for (const secret of manifest.secrets) {
    if (typeof secret.key !== "string" || secret.key.trim().length < 2) {
      issues.push("Secret rotation manifest entries must include a non-empty key.");
      continue;
    }

    if (seenKeys.has(secret.key)) {
      issues.push(`Secret rotation manifest cannot contain duplicate entries for ${secret.key}.`);
      continue;
    }

    seenKeys.add(secret.key);
    validateTimestampAge(
      `Secret rotation timestamp for ${secret.key}`,
      secret.rotatedAt,
      runtime.secretRotationMaxAgeHours,
      issues
    );
  }

  for (const requiredKey of runtime.secretRotationRequiredKeys) {
    if (!seenKeys.has(requiredKey)) {
      issues.push(`Secret rotation manifest must include ${requiredKey}.`);
    }
  }

  return issues;
}

export function validateAtlasSecretRotationExecutionReport(
  targetEnv: AtlasPromotionTarget,
  report: AtlasSecretRotationExecutionReport,
  env: Record<string, string | undefined> = process.env
) {
  const issues = validateAtlasSecretRotationManifest(targetEnv, report.manifest, env);

  if (report.version !== 1) {
    issues.push("Secret rotation execution report version must equal 1.");
  }

  if (report.environment !== targetEnv) {
    issues.push(`Secret rotation execution report must target ${targetEnv}.`);
  }

  if (report.mode !== "dry-run" && report.mode !== "command") {
    issues.push("Secret rotation execution report mode must be dry-run or command.");
  }

  if (typeof report.provider !== "string" || report.provider.trim().length < 2) {
    issues.push("Secret rotation execution report must include a provider label.");
  }

  if (typeof report.manifestPath !== "string" || report.manifestPath.trim().length < 3) {
    issues.push("Secret rotation execution report must include the stored manifest path.");
  }

  if (report.operationalIntegration) {
    issues.push(
      ...validateAtlasOperationalIntegrationSnapshot(
        report.operationalIntegration,
        "SECRET_ROTATION",
        targetEnv.toUpperCase() as Uppercase<AtlasPromotionTarget>,
        report.provider
      )
    );
  }

  if (report.adapterResult) {
    issues.push(...validateAtlasAutomationAdapterResult(report.adapterResult, report.provider));
  }

  return issues;
}

export function validateAtlasAutomationAdapterResult(
  adapterResult: AtlasAutomationAdapterResult,
  expectedProvider?: string
) {
  const issues: string[] = [];

  if (adapterResult.version !== 1) {
    issues.push("Automation adapter result version must equal 1.");
  }

  if (typeof adapterResult.adapter !== "string" || adapterResult.adapter.trim().length < 2) {
    issues.push("Automation adapter result must include an adapter label.");
  }

  if (typeof adapterResult.provider !== "string" || adapterResult.provider.trim().length < 2) {
    issues.push("Automation adapter result must include a provider label.");
  }

  if (expectedProvider && adapterResult.provider !== expectedProvider) {
    issues.push(`Automation adapter result provider must equal ${expectedProvider}.`);
  }

  if (typeof adapterResult.operationId !== "string" || adapterResult.operationId.trim().length < 6) {
    issues.push("Automation adapter result must include a durable operationId.");
  }

  if (typeof adapterResult.summary !== "string" || adapterResult.summary.trim().length < 6) {
    issues.push("Automation adapter result must include an execution summary.");
  }

  if (!adapterResult.metadata || typeof adapterResult.metadata !== "object" || Array.isArray(adapterResult.metadata)) {
    issues.push("Automation adapter result must include metadata.");
  }

  return issues;
}

export function validateAtlasOperationalIntegrationSnapshot(
  integration: AtlasOperationalIntegrationSnapshot,
  expectedKind?: AtlasOperationalIntegrationKind,
  expectedTargetEnvironment?: Uppercase<AtlasPromotionTarget>,
  expectedProvider?: string
) {
  const issues: string[] = [];

  if (typeof integration.id !== "string" || integration.id.trim().length < 6) {
    issues.push("Operational integration snapshot must include a durable id.");
  }

  if (
    integration.kind !== "UPSTREAM_IDENTITY" &&
    integration.kind !== "RESTORE_DRILL" &&
    integration.kind !== "SECRET_ROTATION" &&
    integration.kind !== "DEPLOYMENT_AUTOMATION" &&
    integration.kind !== "PROOF_STORAGE" &&
    integration.kind !== "ALERT_DISPATCH"
  ) {
    issues.push("Operational integration snapshot must include a valid kind.");
  }

  if (expectedKind && integration.kind !== expectedKind) {
    issues.push(`Operational integration snapshot kind must equal ${expectedKind}.`);
  }

  if (
    integration.targetEnvironment !== "DEVELOPMENT" &&
    integration.targetEnvironment !== "STAGING" &&
    integration.targetEnvironment !== "PRODUCTION"
  ) {
    issues.push("Operational integration snapshot must include a valid target environment.");
  }

  if (expectedTargetEnvironment && integration.targetEnvironment !== expectedTargetEnvironment) {
    issues.push(`Operational integration snapshot target environment must equal ${expectedTargetEnvironment}.`);
  }

  if (typeof integration.provider !== "string" || integration.provider.trim().length < 2) {
    issues.push("Operational integration snapshot must include a provider label.");
  }

  if (expectedProvider && integration.provider !== expectedProvider) {
    issues.push(`Operational integration snapshot provider must equal ${expectedProvider}.`);
  }

  if (typeof integration.label !== "string" || integration.label.trim().length < 3) {
    issues.push("Operational integration snapshot must include a human-readable label.");
  }

  if (typeof integration.ownerEmail !== "string" || !integration.ownerEmail.includes("@")) {
    issues.push("Operational integration snapshot must include an owner email.");
  }

  if (
    integration.verificationStatus !== "PENDING" &&
    integration.verificationStatus !== "VERIFIED" &&
    integration.verificationStatus !== "STALE" &&
    integration.verificationStatus !== "FAILED"
  ) {
    issues.push("Operational integration snapshot must include a valid verification status.");
  }

  if (integration.verificationStatus !== "VERIFIED") {
    issues.push("Operational integration snapshot must be verified for executable automation.");
  }

  return issues;
}

export function validateAtlasRestoreDrillReport(
  targetEnv: AtlasPromotionTarget,
  report: AtlasRestoreDrillReport,
  env: Record<string, string | undefined> = process.env
) {
  const runtime = readOperationsRuntime(env);
  const restoreProvider = readRestoreDrillProvider(env.RESTORE_DRILL_PROVIDER);
  const issues: string[] = [];

  if (report.version !== 1) {
    issues.push("Restore drill report version must equal 1.");
  }

  if (report.targetEnvironment !== targetEnv) {
    issues.push(`Restore drill report must target ${targetEnv}.`);
  }

  if (!report.executedRestore) {
    issues.push(`Promotion to ${targetEnv} requires an executed restore drill report, not a dry run.`);
  }

  if (typeof report.targetLabel !== "string" || report.targetLabel.trim().length < 3) {
    issues.push("Restore drill report must include a target label.");
  }

  if (report.executionMode !== "dry-run" && report.executionMode !== "command") {
    issues.push("Restore drill report executionMode must be dry-run or command.");
  }

  if (typeof report.executor !== "string" || report.executor.trim().length < 2) {
    issues.push("Restore drill report must include the executor label.");
  }

  if (report.operationalIntegration) {
    issues.push(
      ...validateAtlasOperationalIntegrationSnapshot(
        report.operationalIntegration,
        "RESTORE_DRILL",
        targetEnv.toUpperCase() as Uppercase<AtlasPromotionTarget>,
        restoreProvider
      )
    );
  }

  if (report.adapterResult) {
    issues.push(...validateAtlasAutomationAdapterResult(report.adapterResult, restoreProvider));
  }

  validateTimestampAge("Restore drill completedAt", report.completedAt, runtime.restoreDrillMaxAgeHours, issues);

  if (!/^[a-f0-9]{64}$/i.test(report.backupIntegrity.sha256)) {
    issues.push("Restore drill report must include a backup integrity sha256 digest.");
  }

  if (report.backupIntegrity.sizeBytes <= 0) {
    issues.push("Restore drill report must include a positive backup size.");
  }

  return issues;
}

export function validateAtlasPromotionOperationalReadiness(
  targetEnv: AtlasPromotionTarget,
  evidence: {
    restoreDrillReport: AtlasRestoreDrillReport;
    secretRotationManifest?: AtlasSecretRotationManifest;
    secretRotationExecutionReport?: AtlasSecretRotationExecutionReport;
  },
  env: Record<string, string | undefined> = process.env
) {
  const secretRotationIssues =
    evidence.secretRotationExecutionReport
      ? validateAtlasSecretRotationExecutionReport(targetEnv, evidence.secretRotationExecutionReport, env)
      : evidence.secretRotationManifest
        ? validateAtlasSecretRotationManifest(targetEnv, evidence.secretRotationManifest, env)
        : ["Promotion operational readiness requires secret rotation evidence."];

  return [
    ...validateAtlasRestoreDrillReport(targetEnv, evidence.restoreDrillReport, env),
    ...secretRotationIssues
  ];
}

export function assertAtlasPromotionOperationalReadiness(
  targetEnv: AtlasPromotionTarget,
  evidence: {
    restoreDrillReport: AtlasRestoreDrillReport;
    secretRotationManifest?: AtlasSecretRotationManifest;
    secretRotationExecutionReport?: AtlasSecretRotationExecutionReport;
  },
  env: Record<string, string | undefined> = process.env
) {
  const issues = validateAtlasPromotionOperationalReadiness(targetEnv, evidence, env);

  if (issues.length > 0) {
    throw new Error(issues.join(" "));
  }

  return issues;
}

export function assertAtlasPromotionReadiness(
  toEnv: AtlasPromotionTarget,
  env: Record<string, string | undefined> = process.env
) {
  const issues = validateAtlasPromotionReadiness(toEnv, env);

  if (issues.length > 0) {
    throw new Error(issues.join(" "));
  }

  return issues;
}
