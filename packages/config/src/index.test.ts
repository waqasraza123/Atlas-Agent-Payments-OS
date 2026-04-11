import { afterEach, describe, expect, it, vi } from "vitest";

describe("atlas config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses fallback runtime values when env is not set", async () => {
    vi.unstubAllEnvs();
    const { apiRuntime, paymentRuntime, storageRuntime, workerRuntime } = await import("./index");

    expect(apiRuntime.port).toBe(4000);
    expect(workerRuntime.redisUrl).toBe("redis://localhost:6379");
    expect(paymentRuntime.stripeEnabled).toBe(false);
    expect(storageRuntime.bucketReceipts).toBe("atlas-receipts");
  });

  it("reads runtime values from the environment", async () => {
    vi.stubEnv("API_PORT", "4105");
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6380");
    vi.stubEnv("MINIO_PORT", "9100");
    vi.stubEnv("MINIO_USE_SSL", "true");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_atlas");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_atlas");

    const { apiRuntime, paymentRuntime, storageRuntime, workerRuntime } = await import("./index");

    expect(apiRuntime.port).toBe(4105);
    expect(workerRuntime.redisUrl).toBe("redis://127.0.0.1:6380");
    expect(paymentRuntime.stripeEnabled).toBe(true);
    expect(paymentRuntime.stripeSecretKey).toBe("sk_test_atlas");
    expect(paymentRuntime.stripeWebhookSecret).toBe("whsec_atlas");
    expect(storageRuntime.port).toBe(9100);
    expect(storageRuntime.useSsl).toBe(true);
  });
});
