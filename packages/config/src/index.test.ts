import { afterEach, describe, expect, it, vi } from "vitest";

describe("atlas config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses fallback runtime values when env is not set", async () => {
    vi.unstubAllEnvs();
    const { apiRuntime, storageRuntime, workerRuntime } = await import("./index");

    expect(apiRuntime.port).toBe(4000);
    expect(workerRuntime.redisUrl).toBe("redis://localhost:6379");
    expect(storageRuntime.bucketReceipts).toBe("atlas-receipts");
  });

  it("reads runtime values from the environment", async () => {
    vi.stubEnv("API_PORT", "4105");
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6380");
    vi.stubEnv("MINIO_PORT", "9100");
    vi.stubEnv("MINIO_USE_SSL", "true");

    const { apiRuntime, storageRuntime, workerRuntime } = await import("./index");

    expect(apiRuntime.port).toBe(4105);
    expect(workerRuntime.redisUrl).toBe("redis://127.0.0.1:6380");
    expect(storageRuntime.port).toBe(9100);
    expect(storageRuntime.useSsl).toBe(true);
  });
});
