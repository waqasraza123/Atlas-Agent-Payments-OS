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

function readLogLevel(value: string | undefined, fallback: AtlasLogLevel) {
  return atlasLogLevels.includes(value as AtlasLogLevel) ? (value as AtlasLogLevel) : fallback;
}

export const atlasProduct = {
  name: "Atlas Agent Payments OS",
  summary: "Premium controls for managed AI agent spend across paid APIs and digital services."
} as const;

export type AtlasLogLevel = (typeof atlasLogLevels)[number];

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
  appEnv: readText(process.env.APP_ENV, "local"),
  logLevel: readLogLevel(process.env.LOG_LEVEL, "info"),
  releaseStage: readText(process.env.RELEASE_STAGE, "functional-alpha"),
  healthcheckTimeoutMs: readNumber(process.env.HEALTHCHECK_TIMEOUT_MS, 2000)
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
