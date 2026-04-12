import { afterEach, describe, expect, it, vi } from "vitest";

describe("health service", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it(
    "simulates readiness checks in test mode",
    async () => {
    vi.stubEnv("NODE_ENV", "test");

    const { HealthService } = await import("../src/modules/health/health.service");
    const service = new HealthService();
    const readiness = await service.getReadiness();

    expect(readiness.status).toBe("ready");
    expect(readiness.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dependency: "database", status: "skipped" }),
        expect.objectContaining({ dependency: "redis", status: "skipped" }),
        expect.objectContaining({ dependency: "object-storage", status: "skipped" })
      ])
    );
    },
    10000
  );

  it("returns startup metadata from runtime config", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("RELEASE_STAGE", "private-beta");
    vi.stubEnv("API_BASE_URL", "https://api.atlas.local");

    const { HealthService } = await import("../src/modules/health/health.service");
    const service = new HealthService();
    const startup = service.getStartup();

    expect(startup).toMatchObject({
      status: "started",
      appEnv: "staging",
      releaseStage: "private-beta",
      baseUrl: "https://api.atlas.local",
      verificationCommand: "pnpm verify:release"
    });
  });
});
