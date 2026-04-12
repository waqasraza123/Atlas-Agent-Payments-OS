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
      authRuntime,
      canAtlasPromoteEnvironment,
      deploymentRuntime,
      operationsRuntime,
      paymentRuntime,
      programmableSettlementRuntime,
      storageRuntime,
      webRuntime,
      workerRuntime,
      createAtlasStructuredLogPayload,
      createAtlasReleaseManifest,
      validateAtlasPromotionOperationalReadiness,
      validateAtlasPromotionReadiness,
      validateAtlasRestoreDrillReport,
      validateAtlasSecretRotationManifest,
      validateAtlasRuntimeConfiguration
    } = await import("./index");

    expect(apiRuntime.port).toBe(4000);
    expect(apiRuntime.baseUrl).toBe("http://localhost:4000");
    expect(appRuntime.appEnv).toBe("local");
    expect(appRuntime.logLevel).toBe("info");
    expect(authRuntime.providerMode).toBe("local-signed");
    expect(authRuntime.sessionSigningSecret).toBe("atlas-local-session-secret");
    expect(deploymentRuntime.revision).toBe("local-development");
    expect(deploymentRuntime.releaseArtifactId).toBe("local-artifact");
    expect(deploymentRuntime.releaseArtifactSha256).toBe(
      "0000000000000000000000000000000000000000000000000000000000000000"
    );
    expect(webRuntime.baseUrl).toBe("http://localhost:3000");
    expect(workerRuntime.redisUrl).toBe("redis://localhost:6379");
    expect(paymentRuntime.stripeEnabled).toBe(false);
    expect(programmableSettlementRuntime.enabled).toBe(false);
    expect(programmableSettlementRuntime.chainId).toBe(84532);
    expect(storageRuntime.bucketReceipts).toBe("atlas-receipts");
    expect(operationsRuntime.restoreDrillMaxAgeHours).toBe(168);
    expect(operationsRuntime.secretRotationMaxAgeHours).toBe(720);
    expect(operationsRuntime.secretRotationRequiredKeys).toEqual([
      "AUTH_SESSION_SIGNING_SECRET",
      "AUTH_IDENTITY_BRIDGE_SECRET",
      "DATABASE_URL",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "MINIO_SECRET_KEY"
    ]);
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
    expect(canAtlasPromoteEnvironment("development", "staging")).toBe(true);
    expect(canAtlasPromoteEnvironment("development", "production")).toBe(false);
    expect(validateAtlasPromotionReadiness("development")).toEqual([]);
    expect(
      validateAtlasSecretRotationManifest("staging", {
        version: 1,
        environment: "staging",
        rotatedBy: "operator-admin@atlas.local",
        reason: "Rotate shared staging secrets before partner validation.",
        generatedAt: new Date().toISOString(),
        maxAgeHours: 720,
        secrets: [
          { key: "AUTH_SESSION_SIGNING_SECRET", rotatedAt: new Date().toISOString() },
          { key: "AUTH_IDENTITY_BRIDGE_SECRET", rotatedAt: new Date().toISOString() },
          { key: "DATABASE_URL", rotatedAt: new Date().toISOString() },
          { key: "STRIPE_SECRET_KEY", rotatedAt: new Date().toISOString() },
          { key: "STRIPE_WEBHOOK_SECRET", rotatedAt: new Date().toISOString() },
          { key: "MINIO_SECRET_KEY", rotatedAt: new Date().toISOString() }
        ]
      })
    ).toEqual([]);
    expect(
      validateAtlasRestoreDrillReport("staging", {
        version: 1,
        appEnv: "staging",
        releaseStage: "private-beta",
        revision: "rev-123",
        backupPath: "/tmp/atlas.sql",
        manifestPath: "/tmp/atlas.sql.manifest.json",
        executedRestore: true,
        targetEnvironment: "staging",
        targetLabel: "staging-restore-slot",
        backupIntegrity: {
          version: 1,
          filePath: "/tmp/atlas.sql",
          sha256: "a".repeat(64),
          sizeBytes: 128,
          generatedAt: new Date().toISOString()
        },
        execution: {
          databaseUrlRedacted: "postgresql://atlas:***@postgres.staging.internal:5432/atlas_restore",
          stdout: "RESTORE"
        },
        completedAt: new Date().toISOString()
      })
    ).toEqual([]);
    expect(
      validateAtlasPromotionOperationalReadiness("staging", {
        restoreDrillReport: {
          version: 1,
          appEnv: "staging",
          releaseStage: "private-beta",
          revision: "rev-123",
          backupPath: "/tmp/atlas.sql",
          manifestPath: "/tmp/atlas.sql.manifest.json",
          executedRestore: true,
          targetEnvironment: "staging",
          targetLabel: "staging-restore-slot",
          backupIntegrity: {
            version: 1,
            filePath: "/tmp/atlas.sql",
            sha256: "a".repeat(64),
            sizeBytes: 128,
            generatedAt: new Date().toISOString()
          },
          execution: {
            databaseUrlRedacted: "postgresql://atlas:***@postgres.staging.internal:5432/atlas_restore",
            stdout: "RESTORE"
          },
          completedAt: new Date().toISOString()
        },
        secretRotationManifest: {
          version: 1,
          environment: "staging",
          rotatedBy: "operator-admin@atlas.local",
          reason: "Rotate shared staging secrets before partner validation.",
          generatedAt: new Date().toISOString(),
          maxAgeHours: 720,
          secrets: [
            { key: "AUTH_SESSION_SIGNING_SECRET", rotatedAt: new Date().toISOString() },
            { key: "AUTH_IDENTITY_BRIDGE_SECRET", rotatedAt: new Date().toISOString() },
            { key: "DATABASE_URL", rotatedAt: new Date().toISOString() },
            { key: "STRIPE_SECRET_KEY", rotatedAt: new Date().toISOString() },
            { key: "STRIPE_WEBHOOK_SECRET", rotatedAt: new Date().toISOString() },
            { key: "MINIO_SECRET_KEY", rotatedAt: new Date().toISOString() }
          ]
        }
      })
    ).toEqual([]);
  });

  it("reads runtime values from the environment", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("LOG_LEVEL", "debug");
    vi.stubEnv("RELEASE_STAGE", "private-beta");
    vi.stubEnv("HEALTHCHECK_TIMEOUT_MS", "3500");
    vi.stubEnv("AUTH_SESSION_SIGNING_SECRET", "atlas-secret");
    vi.stubEnv("AUTH_PROVIDER_MODE", "identity-bridge");
    vi.stubEnv("AUTH_IDENTITY_BRIDGE_SECRET", "atlas-bridge-secret");
    vi.stubEnv("AUTH_IDENTITY_BRIDGE_PROVIDER", "generic-sso");
    vi.stubEnv("AUTH_IDENTITY_SESSION_TTL_MINUTES", "240");
    vi.stubEnv("AUTH_LOCAL_SESSION_TTL_MINUTES", "120");
    vi.stubEnv("AUTH_SUPPORT_ACCESS_TTL_MINUTES", "30");
    vi.stubEnv("AUTH_SUPPORT_ACCESS_REVIEW_TTL_HOURS", "24");
    vi.stubEnv("AUTH_SUPPORT_ACCESS_REVIEW_LOOKAHEAD_HOURS", "12");
    vi.stubEnv("AUTH_SUPPORT_ACCESS_ALLOWED_EMAILS", "operator@atlas.local,operator-admin@atlas.local");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://atlas.local");
    vi.stubEnv("API_BASE_URL", "https://api.atlas.local");
    vi.stubEnv("APP_REVISION", "rev-123");
    vi.stubEnv("DEPLOYMENT_SLOT", "blue");
    vi.stubEnv("RELEASE_ARTIFACT_ID", "atlas-staging-build");
    vi.stubEnv("RELEASE_ARTIFACT_SHA256", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    vi.stubEnv("DATABASE_URL", "postgresql://atlas:atlas@127.0.0.1:5432/atlas");
    vi.stubEnv("API_PORT", "4105");
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6380");
    vi.stubEnv("MINIO_ENDPOINT", "minio.atlas.local");
    vi.stubEnv("MINIO_PORT", "9100");
    vi.stubEnv("MINIO_USE_SSL", "true");
    vi.stubEnv("MINIO_ACCESS_KEY", "atlasminio");
    vi.stubEnv("MINIO_SECRET_KEY", "atlassecret");
    vi.stubEnv("MINIO_BUCKET_RECEIPTS", "atlas-receipts");
    vi.stubEnv("RESTORE_DRILL_MAX_AGE_HOURS", "168");
    vi.stubEnv("SECRET_ROTATION_MAX_AGE_HOURS", "720");
    vi.stubEnv(
      "SECRET_ROTATION_REQUIRED_KEYS",
      "AUTH_SESSION_SIGNING_SECRET,AUTH_IDENTITY_BRIDGE_SECRET,DATABASE_URL,STRIPE_SECRET_KEY,STRIPE_WEBHOOK_SECRET,MINIO_SECRET_KEY"
    );
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
      authRuntime,
      deploymentRuntime,
      operationsRuntime,
      paymentRuntime,
      programmableSettlementRuntime,
      storageRuntime,
      webRuntime,
      workerRuntime,
      createAtlasReleaseManifest,
      validateAtlasPromotionReadiness,
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
    expect(authRuntime.sessionSigningSecret).toBe("atlas-secret");
    expect(authRuntime.providerMode).toBe("identity-bridge");
    expect(authRuntime.identityBridgeSecret).toBe("atlas-bridge-secret");
    expect(authRuntime.identityBridgeProvider).toBe("generic-sso");
    expect(authRuntime.identitySessionTtlMinutes).toBe(240);
    expect(authRuntime.localSessionTtlMinutes).toBe(120);
    expect(authRuntime.supportAccessTtlMinutes).toBe(30);
    expect(authRuntime.supportAccessReviewTtlHours).toBe(24);
    expect(authRuntime.supportAccessReviewLookaheadHours).toBe(12);
    expect(authRuntime.supportAccessAllowedEmails).toEqual(["operator@atlas.local", "operator-admin@atlas.local"]);
    expect(deploymentRuntime.revision).toBe("rev-123");
    expect(deploymentRuntime.deploymentSlot).toBe("blue");
    expect(deploymentRuntime.releaseArtifactId).toBe("atlas-staging-build");
    expect(deploymentRuntime.releaseArtifactSha256).toBe(
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
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
    expect(operationsRuntime.restoreDrillMaxAgeHours).toBe(168);
    expect(operationsRuntime.secretRotationMaxAgeHours).toBe(720);
    expect(operationsRuntime.secretRotationRequiredKeys).toEqual([
      "AUTH_SESSION_SIGNING_SECRET",
      "AUTH_IDENTITY_BRIDGE_SECRET",
      "DATABASE_URL",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "MINIO_SECRET_KEY"
    ]);
    expect(validateAtlasRuntimeConfiguration("api")).toMatchObject({
      service: "api",
      appEnv: "staging",
      ok: true
    });
    expect(createAtlasReleaseManifest("worker")).toMatchObject({
      service: "worker",
      appEnv: "staging",
      authProviderMode: "identity-bridge",
      revision: "rev-123",
      deploymentSlot: "blue",
      artifact: {
        id: "atlas-staging-build",
        sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      }
    });
    expect(() => assertAtlasRuntimeConfiguration("worker")).not.toThrow();
    expect(validateAtlasPromotionReadiness("staging")).toEqual([]);
    expect(validateAtlasPromotionReadiness("production")).toEqual([
      "Promotion to production requires AUTH_PROVIDER_MODE=external-oidc."
    ]);
  });

  it("reads direct external oidc runtime values from the environment", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("LOG_LEVEL", "info");
    vi.stubEnv("RELEASE_STAGE", "ga");
    vi.stubEnv("AUTH_SESSION_SIGNING_SECRET", "atlas-secret");
    vi.stubEnv("AUTH_PROVIDER_MODE", "external-oidc");
    vi.stubEnv("AUTH_EXTERNAL_OIDC_ISSUER", "https://id.atlas.example");
    vi.stubEnv("AUTH_EXTERNAL_OIDC_AUDIENCE", "atlas-agent-payments-os");
    vi.stubEnv("AUTH_EXTERNAL_OIDC_PROVIDER", "okta-design-partner");
    vi.stubEnv("AUTH_EXTERNAL_OIDC_JWKS_JSON", '{"keys":[{"kid":"atlas-test-key","kty":"RSA"}]}');
    vi.stubEnv("AUTH_IDENTITY_SESSION_TTL_MINUTES", "480");
    vi.stubEnv("AUTH_LOCAL_SESSION_TTL_MINUTES", "120");
    vi.stubEnv("AUTH_SUPPORT_ACCESS_TTL_MINUTES", "30");
    vi.stubEnv("AUTH_SUPPORT_ACCESS_ALLOWED_EMAILS", "operator-admin@atlas.local");
    vi.stubEnv("AUTH_SUPPORT_ACCESS_REVIEW_TTL_HOURS", "24");
    vi.stubEnv("AUTH_SUPPORT_ACCESS_REVIEW_LOOKAHEAD_HOURS", "12");
    vi.stubEnv("APP_REVISION", "production-build");
    vi.stubEnv("DEPLOYMENT_SLOT", "blue");
    vi.stubEnv("RELEASE_ARTIFACT_ID", "atlas-production-build");
    vi.stubEnv("RELEASE_ARTIFACT_SHA256", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    vi.stubEnv("HEALTHCHECK_TIMEOUT_MS", "2000");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://atlas.example");
    vi.stubEnv("API_BASE_URL", "https://api.atlas.example");
    vi.stubEnv("DATABASE_URL", "postgresql://atlas:atlas@127.0.0.1:5432/atlas");
    vi.stubEnv("API_PORT", "4000");
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6379");
    vi.stubEnv("MINIO_ENDPOINT", "minio.atlas.example");
    vi.stubEnv("MINIO_PORT", "9000");
    vi.stubEnv("MINIO_ACCESS_KEY", "atlasminio");
    vi.stubEnv("MINIO_SECRET_KEY", "atlasminio");
    vi.stubEnv("MINIO_BUCKET_RECEIPTS", "atlas-receipts");

    const { authRuntime, validateAtlasRuntimeConfiguration, validateAtlasPromotionReadiness } = await import("./index");

    expect(authRuntime.providerMode).toBe("external-oidc");
    expect(authRuntime.externalOidcIssuer).toBe("https://id.atlas.example");
    expect(authRuntime.externalOidcAudience).toBe("atlas-agent-payments-os");
    expect(authRuntime.externalOidcProvider).toBe("okta-design-partner");
    expect(authRuntime.supportAccessReviewTtlHours).toBe(24);
    expect(authRuntime.supportAccessReviewLookaheadHours).toBe(12);
    expect(validateAtlasRuntimeConfiguration("api")).toMatchObject({
      ok: true
    });
    expect(validateAtlasPromotionReadiness("production")).toEqual([]);
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
    expect(result.issues.map((issue) => issue.variable)).toContain("AUTH_PROVIDER_MODE");
    expect(result.issues.map((issue) => issue.variable)).toContain("AUTH_SESSION_SIGNING_SECRET");
    expect(result.issues.map((issue) => issue.variable)).toContain("DATABASE_URL");
    expect(() =>
      assertAtlasRuntimeConfiguration("api", {
        APP_ENV: "production",
        LOG_LEVEL: "info",
        RELEASE_STAGE: "ga"
      })
    ).toThrow(/AUTH_SESSION_SIGNING_SECRET/);
  });

  it("blocks unsafe promotion readiness in higher environments", async () => {
    const { validateAtlasPromotionOperationalReadiness, validateAtlasPromotionReadiness } = await import("./index");

    expect(
      validateAtlasPromotionReadiness("staging", {
        AUTH_PROVIDER_MODE: "local-signed"
      })
    ).toContain("Promotion to staging requires AUTH_PROVIDER_MODE=identity-bridge or AUTH_PROVIDER_MODE=external-oidc.");

    expect(
      validateAtlasPromotionReadiness("production", {
        AUTH_PROVIDER_MODE: "identity-bridge",
        AUTH_SUPPORT_ACCESS_ALLOWED_EMAILS: ""
      })
    ).toContain("Promotion to production requires AUTH_PROVIDER_MODE=external-oidc.");

    expect(
      validateAtlasPromotionReadiness("staging", {
        AUTH_PROVIDER_MODE: "external-oidc",
        APP_REVISION: "local-development",
        RELEASE_ARTIFACT_ID: "local-artifact",
        RELEASE_ARTIFACT_SHA256: "bad-digest"
      })
    ).toEqual([
      "Promotion to staging requires APP_REVISION to identify a non-local release.",
      "Promotion to staging requires RELEASE_ARTIFACT_ID to identify the release artifact.",
      "Promotion to staging requires RELEASE_ARTIFACT_SHA256 to be a 64-character artifact digest."
    ]);

    expect(
      validateAtlasPromotionOperationalReadiness("production", {
        restoreDrillReport: {
          version: 1,
          appEnv: "production",
          releaseStage: "ga",
          revision: "rev-1",
          backupPath: "/tmp/atlas.sql",
          manifestPath: "/tmp/atlas.sql.manifest.json",
          executedRestore: false,
          targetEnvironment: "staging",
          targetLabel: "staging-restore-slot",
          backupIntegrity: {
            version: 1,
            filePath: "/tmp/atlas.sql",
            sha256: "bad",
            sizeBytes: 0,
            generatedAt: new Date("2020-01-01T00:00:00.000Z").toISOString()
          },
          execution: null,
          completedAt: new Date("2020-01-01T00:00:00.000Z").toISOString()
        },
        secretRotationManifest: {
          version: 1,
          environment: "staging",
          rotatedBy: "ops",
          reason: "too short",
          generatedAt: new Date("2020-01-01T00:00:00.000Z").toISOString(),
          maxAgeHours: 720,
          secrets: [{ key: "AUTH_SESSION_SIGNING_SECRET", rotatedAt: new Date("2020-01-01T00:00:00.000Z").toISOString() }]
        }
      })
    ).toEqual([
      "Restore drill report must target production.",
      "Promotion to production requires an executed restore drill report, not a dry run.",
      "Restore drill completedAt is older than the allowed 168-hour freshness window.",
      "Restore drill report must include a backup integrity sha256 digest.",
      "Restore drill report must include a positive backup size.",
      "Secret rotation manifest must target production.",
      "Secret rotation manifest must include the operator who completed the rotation.",
      "Secret rotation manifest must include a durable operational reason.",
      "Secret rotation manifest generatedAt is older than the allowed 720-hour freshness window.",
      "Secret rotation timestamp for AUTH_SESSION_SIGNING_SECRET is older than the allowed 720-hour freshness window.",
      "Secret rotation manifest must include AUTH_IDENTITY_BRIDGE_SECRET.",
      "Secret rotation manifest must include DATABASE_URL.",
      "Secret rotation manifest must include STRIPE_SECRET_KEY.",
      "Secret rotation manifest must include STRIPE_WEBHOOK_SECRET.",
      "Secret rotation manifest must include MINIO_SECRET_KEY."
    ]);
  });
});
