import { afterEach, describe, expect, it, vi } from "vitest";

describe("atlas config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses fallback runtime values when env is not set", async () => {
    vi.unstubAllEnvs();
    const {
      apiRuntime,
      appRuntime,
      deploymentRuntime,
      paymentRuntime,
      programmableSettlementRuntime,
      storageRuntime,
      webRuntime,
      workerRuntime,
      createAtlasStructuredLogPayload,
      createAtlasReleaseManifest,
      validateAtlasRuntimeConfiguration
    } = await import("./index");

    expect(apiRuntime.port).toBe(4000);
    expect(apiRuntime.baseUrl).toBe("http://localhost:4000");
    expect(appRuntime.appEnv).toBe("local");
    expect(appRuntime.logLevel).toBe("info");
    expect(deploymentRuntime.revision).toBe("local-development");
    expect(webRuntime.baseUrl).toBe("http://localhost:3000");
    expect(workerRuntime.redisUrl).toBe("redis://localhost:6379");
    expect(paymentRuntime.stripeEnabled).toBe(false);
    expect(programmableSettlementRuntime.enabled).toBe(false);
    expect(programmableSettlementRuntime.chainId).toBe(84532);
    expect(storageRuntime.bucketReceipts).toBe("atlas-receipts");
    expect(
      createAtlasStructuredLogPayload("api", "info", "booted", {
        requestId: "req-1"
      })
    ).toMatchObject({
      service: "api",
      level: "info",
      appEnv: "local",
      message: "booted",
        requestId: "req-1"
      });
    expect(validateAtlasRuntimeConfiguration("web", {})).toMatchObject({
      service: "web",
      ok: false
    });
    expect(createAtlasReleaseManifest("api")).toMatchObject({
      service: "api",
      appEnv: "local",
      revision: "local-development",
      commands: {
        releaseVerification: "pnpm verify:release"
      }
    });
  });

  it("reads runtime values from the environment", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("LOG_LEVEL", "debug");
    vi.stubEnv("RELEASE_STAGE", "private-beta");
    vi.stubEnv("HEALTHCHECK_TIMEOUT_MS", "3500");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://atlas.local");
    vi.stubEnv("API_BASE_URL", "https://api.atlas.local");
    vi.stubEnv("APP_REVISION", "rev-123");
    vi.stubEnv("DEPLOYMENT_SLOT", "blue");
    vi.stubEnv("DATABASE_URL", "postgresql://atlas:atlas@127.0.0.1:5432/atlas");
    vi.stubEnv("API_PORT", "4105");
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6380");
    vi.stubEnv("MINIO_ENDPOINT", "minio.atlas.local");
    vi.stubEnv("MINIO_PORT", "9100");
    vi.stubEnv("MINIO_USE_SSL", "true");
    vi.stubEnv("MINIO_ACCESS_KEY", "atlasminio");
    vi.stubEnv("MINIO_SECRET_KEY", "atlassecret");
    vi.stubEnv("MINIO_BUCKET_RECEIPTS", "atlas-receipts");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_atlas");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_atlas");
    vi.stubEnv("PROGRAMMABLE_SETTLEMENT_ENABLED", "true");
    vi.stubEnv("PROGRAMMABLE_SETTLEMENT_CHAIN_KEY", "BASE_MAINNET");
    vi.stubEnv("PROGRAMMABLE_SETTLEMENT_CHAIN_ID", "8453");
    vi.stubEnv("PROGRAMMABLE_SETTLEMENT_NETWORK_NAME", "Base");
    vi.stubEnv("PROGRAMMABLE_SETTLEMENT_ASSET_SYMBOL", "USDC");
    vi.stubEnv("PROGRAMMABLE_SETTLEMENT_EXPLORER_BASE_URL", "https://basescan.org/tx/");
    vi.stubEnv("PROGRAMMABLE_SETTLEMENT_REQUIRED_CONFIRMATIONS", "6");

    const {
      apiRuntime,
      appRuntime,
      deploymentRuntime,
      paymentRuntime,
      programmableSettlementRuntime,
      storageRuntime,
      webRuntime,
      workerRuntime,
      createAtlasReleaseManifest,
      validateAtlasRuntimeConfiguration,
      assertAtlasRuntimeConfiguration
    } = await import("./index");

    expect(apiRuntime.port).toBe(4105);
    expect(apiRuntime.baseUrl).toBe("https://api.atlas.local");
    expect(webRuntime.baseUrl).toBe("https://atlas.local");
    expect(appRuntime.appEnv).toBe("staging");
    expect(appRuntime.logLevel).toBe("debug");
    expect(appRuntime.releaseStage).toBe("private-beta");
    expect(appRuntime.healthcheckTimeoutMs).toBe(3500);
    expect(deploymentRuntime.revision).toBe("rev-123");
    expect(deploymentRuntime.deploymentSlot).toBe("blue");
    expect(workerRuntime.redisUrl).toBe("redis://127.0.0.1:6380");
    expect(paymentRuntime.stripeEnabled).toBe(true);
    expect(paymentRuntime.stripeSecretKey).toBe("sk_test_atlas");
    expect(paymentRuntime.stripeWebhookSecret).toBe("whsec_atlas");
    expect(programmableSettlementRuntime.enabled).toBe(true);
    expect(programmableSettlementRuntime.chainKey).toBe("BASE_MAINNET");
    expect(programmableSettlementRuntime.chainId).toBe(8453);
    expect(programmableSettlementRuntime.requiredConfirmations).toBe(6);
    expect(storageRuntime.port).toBe(9100);
    expect(storageRuntime.useSsl).toBe(true);
    expect(validateAtlasRuntimeConfiguration("api")).toMatchObject({
      service: "api",
      appEnv: "staging",
      ok: true
    });
    expect(createAtlasReleaseManifest("worker")).toMatchObject({
      service: "worker",
      appEnv: "staging",
      revision: "rev-123",
      deploymentSlot: "blue"
    });
    expect(() => assertAtlasRuntimeConfiguration("worker")).not.toThrow();
  });

  it("reports missing runtime variables clearly", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("LOG_LEVEL", "info");
    vi.stubEnv("RELEASE_STAGE", "ga");

    const { validateAtlasRuntimeConfiguration, assertAtlasRuntimeConfiguration } = await import("./index");

    const result = validateAtlasRuntimeConfiguration("api", {
      APP_ENV: "production",
      LOG_LEVEL: "info",
      RELEASE_STAGE: "ga"
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.variable)).toContain("DATABASE_URL");
    expect(() =>
      assertAtlasRuntimeConfiguration("api", {
        APP_ENV: "production",
        LOG_LEVEL: "info",
        RELEASE_STAGE: "ga"
      })
    ).toThrow(/DATABASE_URL/);
  });
});
