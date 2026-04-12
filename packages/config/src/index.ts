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

export const atlasProduct = {
  name: "Atlas Agent Payments OS",
  summary: "Premium controls for managed AI agent spend across paid APIs and digital services."
} as const;

export type AtlasLogLevel = (typeof atlasLogLevels)[number];
export type AtlasAppEnvironment = (typeof atlasAppEnvironments)[number];
export type AtlasIdentityProviderMode = (typeof atlasIdentityProviderModes)[number];
export type AtlasReleaseStage = (typeof atlasReleaseStages)[number];
export type AtlasRuntimeService = "api" | "web" | "worker";
export type AtlasPromotionTarget = Exclude<AtlasAppEnvironment, "local">;

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
  backupDirectory: readText(process.env.DATABASE_BACKUP_DIR, "backups")
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
  supportAccessAllowedEmails: readTextList(process.env.AUTH_SUPPORT_ACCESS_ALLOWED_EMAILS)
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
  accessKey: process.env.MINIO_ACCESS_KEY ?? "atlasminio",
  secretKey: process.env.MINIO_SECRET_KEY ?? "atlasminio",
  bucketReceipts: process.env.MINIO_BUCKET_RECEIPTS ?? "atlas-receipts"
} as const;

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
