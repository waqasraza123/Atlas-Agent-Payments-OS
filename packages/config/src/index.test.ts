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
      deploymentAutomationRuntime,
      deploymentRuntime,
      observabilityRuntime,
      operationsRuntime,
      paymentRuntime,
      programmableSettlementRuntime,
      restoreDrillRuntime,
      storageRuntime,
      secretRotationRuntime,
      upstreamIdentityRuntime,
      webRuntime,
      workerRuntime,
      createAtlasStructuredLogPayload,
      createAtlasReleaseManifest,
      validateAtlasPromotionOperationalReadiness,
      validateAtlasPromotionReadiness,
      validateAtlasSecretRotationExecutionReport,
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
    expect(storageRuntime.region).toBe("us-east-1");
    expect(storageRuntime.bucketReceipts).toBe("atlas-receipts");
    expect(storageRuntime.bucketOperations).toBe("atlas-operations");
    expect(upstreamIdentityRuntime.mode).toBe("dry-run");
    expect(upstreamIdentityRuntime.provider).toBe("generic-oidc-admin");
    expect(restoreDrillRuntime.provider).toBe("local-psql");
    expect(restoreDrillRuntime.mode).toBe("dry-run");
    expect(secretRotationRuntime.mode).toBe("dry-run");
    expect(secretRotationRuntime.provider).toBe("generic-secret-manager");
    expect(deploymentAutomationRuntime.mode).toBe("dry-run");
    expect(deploymentAutomationRuntime.provider).toBe("generic-deployer");
    expect(operationsRuntime.proofStorageMode).toBe("disabled");
    expect(operationsRuntime.restoreDrillMaxAgeHours).toBe(168);
    expect(operationsRuntime.proofStoragePrefix).toBe("rollout-proof");
    expect(operationsRuntime.secretRotationMaxAgeHours).toBe(720);
    expect(operationsRuntime.secretRotationRequiredKeys).toEqual([
      "AUTH_SESSION_SIGNING_SECRET",
      "AUTH_IDENTITY_BRIDGE_SECRET",
      "DATABASE_URL",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "MINIO_SECRET_KEY"
    ]);
    expect(observabilityRuntime.traceHistoryLimit).toBe(20);
    expect(observabilityRuntime.snapshotRetentionDays).toBe(30);
    expect(observabilityRuntime.dispatchRetentionDays).toBe(30);
    expect(observabilityRuntime.incidentRetentionDays).toBe(30);
    expect(observabilityRuntime.automationRetentionDays).toBe(30);
    expect(observabilityRuntime.incidentReportDirectory).toBe("operations-artifacts/observability/incidents");
    expect(observabilityRuntime.incidentMinimumSeverity).toBe("critical");
    expect(observabilityRuntime.automationScheduleMode).toBe("disabled");
    expect(observabilityRuntime.automationScheduleIntervalMinutes).toBe(15);
    expect(observabilityRuntime.automationScheduleStartupDelaySeconds).toBe(30);
    expect(observabilityRuntime.automationTelemetryOwnershipPolicy).toBe("monitor");
    expect(observabilityRuntime.automationActorUserEmail).toBeNull();
    expect(observabilityRuntime.automationReason).toBeNull();
    expect(observabilityRuntime.automationDispatchAlerts).toBe(false);
    expect(observabilityRuntime.automationTriggerIncidents).toBe(true);
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
        executionMode: "command",
        executor: "psql",
        targetHost: "postgres.staging.internal",
        proofArtifactPath: "/tmp/restore-report.json",
        execution: {
          databaseUrlRedacted: "postgresql://atlas:***@postgres.staging.internal:5432/atlas_restore",
          stdout: "RESTORE"
        },
        operationalIntegration: {
          id: "integration-restore-1",
          kind: "RESTORE_DRILL",
          targetEnvironment: "STAGING",
          provider: "local-psql",
          label: "staging restore owner",
          ownerEmail: "platform-ops@atlas.local",
          endpointReference: "postgres.staging.internal",
          secretReference: "aws-secrets://atlas/staging/restore",
          configReference: "atlas-restore-job",
          verificationStatus: "VERIFIED",
          lastVerifiedAt: new Date().toISOString()
        },
        adapterResult: {
          version: 1,
          adapter: "kubernetes-restore-job",
          provider: "local-psql",
          operationId: "local-psql-123456",
          summary: "Executed restore drill.",
          targetRef: "postgres.staging.internal",
          metadata: {}
        },
        completedAt: new Date().toISOString()
      })
    ).toEqual([]);
    expect(
      validateAtlasSecretRotationExecutionReport("staging", {
        version: 1,
        environment: "staging",
        provider: "aws-secrets-manager",
        mode: "command",
        rotatedBy: "operator-admin@atlas.local",
        reason: "Rotate shared staging secrets before partner validation.",
        generatedAt: new Date().toISOString(),
        reportPath: "/tmp/rotation-report.json",
        manifestPath: "/tmp/rotation-manifest.json",
        manifest: {
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
        },
        operationalIntegration: {
          id: "integration-rotation-1",
          kind: "SECRET_ROTATION",
          targetEnvironment: "STAGING",
          provider: "aws-secrets-manager",
          label: "staging secret owner",
          ownerEmail: "platform-ops@atlas.local",
          endpointReference: "us-east-1",
          secretReference: "atlas/staging",
          configReference: null,
          verificationStatus: "VERIFIED",
          lastVerifiedAt: new Date().toISOString()
        },
        command: {
          configured: true,
          exitCode: 0,
          stdout: "rotated",
          stderr: ""
        },
        adapterResult: {
          version: 1,
          adapter: "aws-secrets-manager-rotation",
          provider: "aws-secrets-manager",
          operationId: "aws-secrets-manager-123456",
          summary: "Rotate 6 secrets for staging.",
          targetRef: "us-east-1:atlas/staging",
          metadata: {}
        }
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
          executionMode: "command",
          executor: "psql",
          targetHost: "postgres.staging.internal",
          proofArtifactPath: "/tmp/restore-report.json",
          execution: {
            databaseUrlRedacted: "postgresql://atlas:***@postgres.staging.internal:5432/atlas_restore",
            stdout: "RESTORE"
          },
          operationalIntegration: {
            id: "integration-restore-1",
            kind: "RESTORE_DRILL",
            targetEnvironment: "STAGING",
            provider: "local-psql",
            label: "staging restore owner",
            ownerEmail: "platform-ops@atlas.local",
            endpointReference: "postgres.staging.internal",
            secretReference: "aws-secrets://atlas/staging/restore",
            configReference: "atlas-restore-job",
            verificationStatus: "VERIFIED",
            lastVerifiedAt: new Date().toISOString()
          },
          adapterResult: {
            version: 1,
            adapter: "kubernetes-restore-job",
            provider: "local-psql",
            operationId: "local-psql-123456",
            summary: "Executed restore drill.",
            targetRef: "postgres.staging.internal",
            metadata: {}
          },
          completedAt: new Date().toISOString()
        },
        secretRotationExecutionReport: {
          version: 1,
          environment: "staging",
          provider: "aws-secrets-manager",
          mode: "command",
          rotatedBy: "operator-admin@atlas.local",
          reason: "Rotate shared staging secrets before partner validation.",
          generatedAt: new Date().toISOString(),
          reportPath: "/tmp/rotation-report.json",
          manifestPath: "/tmp/rotation-manifest.json",
          manifest: {
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
          },
          operationalIntegration: {
            id: "integration-rotation-1",
            kind: "SECRET_ROTATION",
            targetEnvironment: "STAGING",
            provider: "aws-secrets-manager",
            label: "staging secret owner",
            ownerEmail: "platform-ops@atlas.local",
            endpointReference: "us-east-1",
            secretReference: "atlas/staging",
            configReference: null,
            verificationStatus: "VERIFIED",
            lastVerifiedAt: new Date().toISOString()
          },
          command: {
            configured: true,
            exitCode: 0,
            stdout: "rotated",
            stderr: ""
          },
          adapterResult: {
            version: 1,
            adapter: "aws-secrets-manager-rotation",
            provider: "aws-secrets-manager",
            operationId: "aws-secrets-manager-123456",
            summary: "Rotate 6 secrets for staging.",
            targetRef: "us-east-1:atlas/staging",
            metadata: {}
          }
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
    vi.stubEnv("AUTH_UPSTREAM_IDENTITY_MODE", "command");
    vi.stubEnv("AUTH_UPSTREAM_IDENTITY_PROVIDER", "okta-scim");
    vi.stubEnv("AUTH_UPSTREAM_IDENTITY_COMMAND", "atlas-identity-admin --payload \"$ATLAS_OPERATION_PAYLOAD\"");
    vi.stubEnv("AUTH_OKTA_ORG_URL", "https://atlas.okta.example");
    vi.stubEnv("AUTH_OKTA_SCIM_APP_ID", "atlas-okta-app");
    vi.stubEnv("AUTH_OKTA_API_TOKEN", "okta-token");
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
    vi.stubEnv("MINIO_REGION", "us-east-1");
    vi.stubEnv("MINIO_ACCESS_KEY", "atlasminio");
    vi.stubEnv("MINIO_SECRET_KEY", "atlassecret");
    vi.stubEnv("MINIO_BUCKET_RECEIPTS", "atlas-receipts");
    vi.stubEnv("MINIO_BUCKET_OPERATIONS", "atlas-operations");
    vi.stubEnv("OPERATIONAL_PROOF_STORAGE_MODE", "s3-compatible");
    vi.stubEnv("OPERATIONAL_PROOF_STORAGE_PREFIX", "rollout-proof/staging");
    vi.stubEnv("RESTORE_DRILL_MAX_AGE_HOURS", "168");
    vi.stubEnv("RESTORE_DRILL_MODE", "command");
    vi.stubEnv("RESTORE_DRILL_PROVIDER", "kubernetes-job");
    vi.stubEnv("RESTORE_DRILL_COMMAND", "atlas-restore-drill --payload \"$ATLAS_OPERATION_PAYLOAD\"");
    vi.stubEnv("RESTORE_DRILL_KUBERNETES_NAMESPACE", "atlas-staging");
    vi.stubEnv("RESTORE_DRILL_KUBERNETES_JOB_TEMPLATE", "atlas-restore-drill");
    vi.stubEnv("SECRET_ROTATION_MAX_AGE_HOURS", "720");
    vi.stubEnv(
      "SECRET_ROTATION_REQUIRED_KEYS",
      "AUTH_SESSION_SIGNING_SECRET,AUTH_IDENTITY_BRIDGE_SECRET,DATABASE_URL,STRIPE_SECRET_KEY,STRIPE_WEBHOOK_SECRET,MINIO_SECRET_KEY"
    );
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_atlas");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_atlas");
    vi.stubEnv("SECRET_ROTATION_MODE", "command");
    vi.stubEnv("SECRET_ROTATION_PROVIDER", "aws-secrets-manager");
    vi.stubEnv("SECRET_ROTATION_COMMAND", "atlas-secret-rotation --payload \"$ATLAS_OPERATION_PAYLOAD\"");
    vi.stubEnv("SECRET_ROTATION_AWS_REGION", "us-east-1");
    vi.stubEnv("SECRET_ROTATION_AWS_PREFIX", "atlas/staging");
    vi.stubEnv("DEPLOYMENT_AUTOMATION_MODE", "command");
    vi.stubEnv("DEPLOYMENT_AUTOMATION_PROVIDER", "github-actions");
    vi.stubEnv("DEPLOYMENT_AUTOMATION_COMMAND", "atlas-deploy --payload \"$ATLAS_OPERATION_PAYLOAD\"");
    vi.stubEnv("DEPLOYMENT_AUTOMATION_GITHUB_REPOSITORY", "atlas/payments-os");
    vi.stubEnv("DEPLOYMENT_AUTOMATION_GITHUB_WORKFLOW", "deploy-staging");
    vi.stubEnv("DEPLOYMENT_AUTOMATION_GITHUB_REF", "main");
    vi.stubEnv("DEPLOYMENT_AUTOMATION_GITHUB_API_URL", "https://api.github.com");
    vi.stubEnv("OBSERVABILITY_TELEMETRY_RETENTION_DAYS", "45");
    vi.stubEnv("OBSERVABILITY_SNAPSHOT_RETENTION_DAYS", "60");
    vi.stubEnv("OBSERVABILITY_DISPATCH_RETENTION_DAYS", "20");
    vi.stubEnv("OBSERVABILITY_INCIDENT_RETENTION_DAYS", "90");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_RETENTION_DAYS", "14");
    vi.stubEnv("OBSERVABILITY_SNAPSHOT_DIR", "operations-artifacts/observability/snapshots");
    vi.stubEnv("OBSERVABILITY_RUNTIME_SNAPSHOT_DIR", "operations-artifacts/observability/runtime");
    vi.stubEnv("OBSERVABILITY_TRACE_HISTORY_LIMIT", "30");
    vi.stubEnv("OBSERVABILITY_WORKER_STALE_AFTER_MINUTES", "15");
    vi.stubEnv("OBSERVABILITY_ALERT_DISPATCH_MODE", "command");
    vi.stubEnv("OBSERVABILITY_ALERT_DISPATCH_PROVIDER", "generic-webhook");
    vi.stubEnv("OBSERVABILITY_ALERT_DISPATCH_COMMAND", "atlas-alert-dispatch --payload \"$ATLAS_OPERATION_PAYLOAD\"");
    vi.stubEnv("OBSERVABILITY_ALERT_DISPATCH_REPORT_DIR", "operations-artifacts/observability/dispatches");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_REPORT_DIR", "operations-artifacts/observability/automation");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_DEFAULT_MINIMUM_SEVERITY", "critical");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_SCHEDULE_MODE", "interval");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_INTERVAL_MINUTES", "20");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_STARTUP_DELAY_SECONDS", "45");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_TELEMETRY_POLICY", "recover");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_ACTOR_USER_EMAIL", "operator-admin@atlas.local");
    vi.stubEnv(
      "OBSERVABILITY_AUTOMATION_REASON",
      "Run scheduled observability automation for the current release slot."
    );
    vi.stubEnv("OBSERVABILITY_AUTOMATION_DISPATCH_ALERTS", "true");
    vi.stubEnv("OBSERVABILITY_INCIDENT_REPORT_DIR", "operations-artifacts/observability/incidents");
    vi.stubEnv("OBSERVABILITY_INCIDENT_MINIMUM_SEVERITY", "warning");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_TRIGGER_INCIDENTS", "false");
    vi.stubEnv("OBSERVABILITY_ALERT_DISPATCH_WEBHOOK_URL", "https://alerts.atlas.local/webhook");
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
      deploymentAutomationRuntime,
      deploymentRuntime,
      observabilityRuntime,
      operationsRuntime,
      paymentRuntime,
      programmableSettlementRuntime,
      restoreDrillRuntime,
      storageRuntime,
      secretRotationRuntime,
      upstreamIdentityRuntime,
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
    expect(upstreamIdentityRuntime.mode).toBe("command");
    expect(upstreamIdentityRuntime.provider).toBe("okta-scim");
    expect(upstreamIdentityRuntime.oktaApiToken).toBe("okta-token");
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
    expect(storageRuntime.region).toBe("us-east-1");
    expect(storageRuntime.bucketOperations).toBe("atlas-operations");
    expect(restoreDrillRuntime.mode).toBe("command");
    expect(restoreDrillRuntime.provider).toBe("kubernetes-job");
    expect(secretRotationRuntime.mode).toBe("command");
    expect(secretRotationRuntime.provider).toBe("aws-secrets-manager");
    expect(deploymentAutomationRuntime.mode).toBe("command");
    expect(deploymentAutomationRuntime.provider).toBe("github-actions");
    expect(observabilityRuntime.telemetryRetentionDays).toBe(45);
    expect(observabilityRuntime.snapshotRetentionDays).toBe(60);
    expect(observabilityRuntime.dispatchRetentionDays).toBe(20);
    expect(observabilityRuntime.incidentRetentionDays).toBe(90);
    expect(observabilityRuntime.automationRetentionDays).toBe(14);
    expect(observabilityRuntime.runtimeSnapshotDirectory).toBe("operations-artifacts/observability/runtime");
    expect(observabilityRuntime.traceHistoryLimit).toBe(30);
    expect(observabilityRuntime.workerTelemetryStaleAfterMinutes).toBe(15);
    expect(observabilityRuntime.alertDispatchMode).toBe("command");
    expect(observabilityRuntime.alertDispatchProvider).toBe("generic-webhook");
    expect(observabilityRuntime.automationReportDirectory).toBe("operations-artifacts/observability/automation");
    expect(observabilityRuntime.automationDefaultMinimumSeverity).toBe("critical");
    expect(observabilityRuntime.automationScheduleMode).toBe("interval");
    expect(observabilityRuntime.automationScheduleIntervalMinutes).toBe(20);
    expect(observabilityRuntime.automationScheduleStartupDelaySeconds).toBe(45);
    expect(observabilityRuntime.automationTelemetryOwnershipPolicy).toBe("recover");
    expect(observabilityRuntime.automationActorUserEmail).toBe("operator-admin@atlas.local");
    expect(observabilityRuntime.automationReason).toBe(
      "Run scheduled observability automation for the current release slot."
    );
    expect(observabilityRuntime.automationDispatchAlerts).toBe(true);
    expect(observabilityRuntime.incidentReportDirectory).toBe("operations-artifacts/observability/incidents");
    expect(observabilityRuntime.incidentMinimumSeverity).toBe("warning");
    expect(observabilityRuntime.automationTriggerIncidents).toBe(false);
    expect(observabilityRuntime.alertDispatchWebhookUrl).toBe("https://alerts.atlas.local/webhook");
    expect(operationsRuntime.proofStorageMode).toBe("s3-compatible");
    expect(operationsRuntime.proofStoragePrefix).toBe("rollout-proof/staging");
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
    vi.stubEnv("MINIO_REGION", "us-east-1");
    vi.stubEnv("MINIO_ACCESS_KEY", "atlasminio");
    vi.stubEnv("MINIO_SECRET_KEY", "atlasminio");
    vi.stubEnv("MINIO_BUCKET_RECEIPTS", "atlas-receipts");
    vi.stubEnv("MINIO_BUCKET_OPERATIONS", "atlas-operations-production");

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

  it("requires provider-specific adapter variables for command integrations", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("AUTH_PROVIDER_MODE", "external-oidc");
    vi.stubEnv("AUTH_SESSION_SIGNING_SECRET", "atlas-secret");
    vi.stubEnv("AUTH_EXTERNAL_OIDC_ISSUER", "https://id.atlas.example");
    vi.stubEnv("AUTH_EXTERNAL_OIDC_AUDIENCE", "atlas-agent-payments-os");
    vi.stubEnv("AUTH_EXTERNAL_OIDC_PROVIDER", "external-oidc");
    vi.stubEnv("AUTH_EXTERNAL_OIDC_JWKS_JSON", '{"keys":[]}');
    vi.stubEnv("AUTH_IDENTITY_SESSION_TTL_MINUTES", "480");
    vi.stubEnv("AUTH_SUPPORT_ACCESS_REVIEW_TTL_HOURS", "24");
    vi.stubEnv("API_PORT", "4000");
    vi.stubEnv("API_BASE_URL", "https://api.atlas.example");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://atlas.example");
    vi.stubEnv("DATABASE_URL", "postgresql://atlas:atlas@127.0.0.1:5432/atlas");
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6379");
    vi.stubEnv("MINIO_ENDPOINT", "minio.atlas.example");
    vi.stubEnv("MINIO_PORT", "9000");
    vi.stubEnv("MINIO_ACCESS_KEY", "atlasminio");
    vi.stubEnv("MINIO_SECRET_KEY", "atlasminio");
    vi.stubEnv("MINIO_BUCKET_RECEIPTS", "atlas-receipts");
    vi.stubEnv("APP_REVISION", "rev-1");
    vi.stubEnv("DEPLOYMENT_SLOT", "blue");
    vi.stubEnv("RELEASE_ARTIFACT_ID", "artifact-1");
    vi.stubEnv("RELEASE_ARTIFACT_SHA256", "a".repeat(64));
    vi.stubEnv("AUTH_UPSTREAM_IDENTITY_MODE", "command");
    vi.stubEnv("AUTH_UPSTREAM_IDENTITY_PROVIDER", "okta-scim");
    vi.stubEnv("AUTH_UPSTREAM_IDENTITY_COMMAND", "identity-command");
    vi.stubEnv("RESTORE_DRILL_MODE", "command");
    vi.stubEnv("RESTORE_DRILL_PROVIDER", "kubernetes-job");
    vi.stubEnv("RESTORE_DRILL_COMMAND", "restore-command");
    vi.stubEnv("SECRET_ROTATION_MODE", "command");
    vi.stubEnv("SECRET_ROTATION_PROVIDER", "aws-secrets-manager");
    vi.stubEnv("SECRET_ROTATION_COMMAND", "rotation-command");
    vi.stubEnv("DEPLOYMENT_AUTOMATION_MODE", "command");
    vi.stubEnv("DEPLOYMENT_AUTOMATION_PROVIDER", "github-actions");
    vi.stubEnv("DEPLOYMENT_AUTOMATION_COMMAND", "deploy-command");
    vi.stubEnv("OBSERVABILITY_ALERT_DISPATCH_MODE", "command");
    vi.stubEnv("OBSERVABILITY_ALERT_DISPATCH_PROVIDER", "generic-webhook");
    vi.stubEnv("OBSERVABILITY_ALERT_DISPATCH_COMMAND", "alert-command");

    const { validateAtlasRuntimeConfiguration } = await import("./index");
    const result = validateAtlasRuntimeConfiguration("api");

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.variable)).toEqual(
      expect.arrayContaining([
        "AUTH_OKTA_ORG_URL",
        "AUTH_OKTA_SCIM_APP_ID",
        "AUTH_OKTA_API_TOKEN",
        "RESTORE_DRILL_KUBERNETES_NAMESPACE",
        "RESTORE_DRILL_KUBERNETES_JOB_TEMPLATE",
        "SECRET_ROTATION_AWS_REGION",
        "SECRET_ROTATION_AWS_PREFIX",
        "DEPLOYMENT_AUTOMATION_GITHUB_REPOSITORY",
        "DEPLOYMENT_AUTOMATION_GITHUB_WORKFLOW",
        "OBSERVABILITY_ALERT_DISPATCH_WEBHOOK_URL",
        "MINIO_REGION",
        "MINIO_BUCKET_OPERATIONS"
      ])
    );
  });

  it("requires paging-provider variables for command dispatch integrations", async () => {
    const { validateAtlasRuntimeConfiguration } = await import("./index");

    const pagerDutyResult = validateAtlasRuntimeConfiguration("api", {
      APP_ENV: "staging",
      LOG_LEVEL: "info",
      RELEASE_STAGE: "private-beta",
      AUTH_PROVIDER_MODE: "external-oidc",
      AUTH_SESSION_SIGNING_SECRET: "atlas-secret",
      AUTH_EXTERNAL_OIDC_ISSUER: "https://id.atlas.example",
      AUTH_EXTERNAL_OIDC_AUDIENCE: "atlas-agent-payments-os",
      AUTH_EXTERNAL_OIDC_PROVIDER: "external-oidc",
      AUTH_EXTERNAL_OIDC_JWKS_JSON: '{"keys":[]}',
      AUTH_IDENTITY_SESSION_TTL_MINUTES: "480",
      AUTH_SUPPORT_ACCESS_REVIEW_TTL_HOURS: "24",
      API_PORT: "4000",
      API_BASE_URL: "https://api.atlas.example",
      NEXT_PUBLIC_APP_URL: "https://atlas.example",
      DATABASE_URL: "postgresql://atlas:atlas@127.0.0.1:5432/atlas",
      REDIS_URL: "redis://127.0.0.1:6379",
      MINIO_ENDPOINT: "minio.atlas.example",
      MINIO_PORT: "9000",
      MINIO_REGION: "us-east-1",
      MINIO_ACCESS_KEY: "atlasminio",
      MINIO_SECRET_KEY: "atlasminio",
      MINIO_BUCKET_RECEIPTS: "atlas-receipts",
      MINIO_BUCKET_OPERATIONS: "atlas-operations",
      APP_REVISION: "rev-1",
      DEPLOYMENT_SLOT: "blue",
      RELEASE_ARTIFACT_ID: "artifact-1",
      RELEASE_ARTIFACT_SHA256: "a".repeat(64),
      OBSERVABILITY_ALERT_DISPATCH_MODE: "command",
      OBSERVABILITY_ALERT_DISPATCH_PROVIDER: "pagerduty-events",
      OBSERVABILITY_ALERT_DISPATCH_COMMAND: "alert-command"
    });

    expect(pagerDutyResult.issues.map((issue) => issue.variable)).toContain(
      "OBSERVABILITY_ALERT_DISPATCH_PAGERDUTY_ROUTING_KEY"
    );

    const opsgenieResult = validateAtlasRuntimeConfiguration("api", {
      APP_ENV: "staging",
      LOG_LEVEL: "info",
      RELEASE_STAGE: "private-beta",
      AUTH_PROVIDER_MODE: "external-oidc",
      AUTH_SESSION_SIGNING_SECRET: "atlas-secret",
      AUTH_EXTERNAL_OIDC_ISSUER: "https://id.atlas.example",
      AUTH_EXTERNAL_OIDC_AUDIENCE: "atlas-agent-payments-os",
      AUTH_EXTERNAL_OIDC_PROVIDER: "external-oidc",
      AUTH_EXTERNAL_OIDC_JWKS_JSON: '{"keys":[]}',
      AUTH_IDENTITY_SESSION_TTL_MINUTES: "480",
      AUTH_SUPPORT_ACCESS_REVIEW_TTL_HOURS: "24",
      API_PORT: "4000",
      API_BASE_URL: "https://api.atlas.example",
      NEXT_PUBLIC_APP_URL: "https://atlas.example",
      DATABASE_URL: "postgresql://atlas:atlas@127.0.0.1:5432/atlas",
      REDIS_URL: "redis://127.0.0.1:6379",
      MINIO_ENDPOINT: "minio.atlas.example",
      MINIO_PORT: "9000",
      MINIO_REGION: "us-east-1",
      MINIO_ACCESS_KEY: "atlasminio",
      MINIO_SECRET_KEY: "atlasminio",
      MINIO_BUCKET_RECEIPTS: "atlas-receipts",
      MINIO_BUCKET_OPERATIONS: "atlas-operations",
      APP_REVISION: "rev-1",
      DEPLOYMENT_SLOT: "blue",
      RELEASE_ARTIFACT_ID: "artifact-1",
      RELEASE_ARTIFACT_SHA256: "a".repeat(64),
      OBSERVABILITY_ALERT_DISPATCH_MODE: "command",
      OBSERVABILITY_ALERT_DISPATCH_PROVIDER: "opsgenie-alerts",
      OBSERVABILITY_ALERT_DISPATCH_COMMAND: "alert-command"
    });

    expect(opsgenieResult.issues.map((issue) => issue.variable)).toEqual(
      expect.arrayContaining([
        "OBSERVABILITY_ALERT_DISPATCH_OPSGENIE_API_KEY",
        "OBSERVABILITY_ALERT_DISPATCH_OPSGENIE_TEAM"
      ])
    );
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

  it("requires command definitions when command adapters are enabled", async () => {
    const { validateAtlasRuntimeConfiguration } = await import("./index");

    const result = validateAtlasRuntimeConfiguration("api", {
      APP_ENV: "staging",
      LOG_LEVEL: "info",
      RELEASE_STAGE: "private-beta",
      AUTH_PROVIDER_MODE: "external-oidc",
      AUTH_SESSION_SIGNING_SECRET: "atlas-secret",
      AUTH_EXTERNAL_OIDC_ISSUER: "https://id.atlas.example",
      AUTH_EXTERNAL_OIDC_AUDIENCE: "atlas-agent-payments-os",
      AUTH_EXTERNAL_OIDC_PROVIDER: "okta",
      AUTH_EXTERNAL_OIDC_JWKS_JSON: '{"keys":[]}',
      AUTH_IDENTITY_SESSION_TTL_MINUTES: "480",
      AUTH_SUPPORT_ACCESS_REVIEW_TTL_HOURS: "24",
      API_PORT: "4000",
      API_BASE_URL: "https://api.atlas.example",
      NEXT_PUBLIC_APP_URL: "https://atlas.example",
      DATABASE_URL: "postgresql://atlas:atlas@127.0.0.1:5432/atlas",
      REDIS_URL: "redis://127.0.0.1:6379",
      MINIO_ENDPOINT: "minio.atlas.example",
      MINIO_PORT: "9000",
      MINIO_REGION: "us-east-1",
      MINIO_ACCESS_KEY: "atlasminio",
      MINIO_SECRET_KEY: "atlassecret",
      MINIO_BUCKET_RECEIPTS: "atlas-receipts",
      MINIO_BUCKET_OPERATIONS: "atlas-operations",
      APP_REVISION: "rev-1",
      DEPLOYMENT_SLOT: "blue",
      RELEASE_ARTIFACT_ID: "atlas-staging-build",
      RELEASE_ARTIFACT_SHA256: "a".repeat(64),
      AUTH_UPSTREAM_IDENTITY_MODE: "command",
      RESTORE_DRILL_MODE: "command",
      SECRET_ROTATION_MODE: "command",
      DEPLOYMENT_AUTOMATION_MODE: "command",
      OBSERVABILITY_ALERT_DISPATCH_MODE: "command"
    });

    expect(result.issues.map((issue) => issue.variable)).toEqual(
      expect.arrayContaining([
        "AUTH_UPSTREAM_IDENTITY_COMMAND",
        "RESTORE_DRILL_COMMAND",
        "SECRET_ROTATION_COMMAND",
        "DEPLOYMENT_AUTOMATION_COMMAND",
        "OBSERVABILITY_ALERT_DISPATCH_COMMAND"
      ])
    );
  });

  it("requires explicit worker automation scheduler ownership when interval mode is enabled", async () => {
    const { validateAtlasRuntimeConfiguration } = await import("./index");

    const result = validateAtlasRuntimeConfiguration("worker", {
      APP_ENV: "staging",
      LOG_LEVEL: "info",
      RELEASE_STAGE: "private-beta",
      DATABASE_URL: "postgresql://atlas:atlas@127.0.0.1:5432/atlas",
      REDIS_URL: "redis://127.0.0.1:6379",
      APP_REVISION: "rev-1",
      DEPLOYMENT_SLOT: "green",
      RELEASE_ARTIFACT_ID: "atlas-staging-build",
      RELEASE_ARTIFACT_SHA256: "a".repeat(64),
      OBSERVABILITY_AUTOMATION_SCHEDULE_MODE: "interval",
      OBSERVABILITY_AUTOMATION_INTERVAL_MINUTES: "0",
      OBSERVABILITY_AUTOMATION_STARTUP_DELAY_SECONDS: "-1"
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.variable)).toEqual(
      expect.arrayContaining([
        "OBSERVABILITY_AUTOMATION_INTERVAL_MINUTES",
        "OBSERVABILITY_AUTOMATION_TELEMETRY_POLICY",
        "OBSERVABILITY_AUTOMATION_ACTOR_USER_EMAIL",
        "OBSERVABILITY_AUTOMATION_REASON",
        "OBSERVABILITY_AUTOMATION_STARTUP_DELAY_SECONDS"
      ])
    );
  });

  it("rejects invalid telemetry ownership policy values", async () => {
    const { validateAtlasRuntimeConfiguration } = await import("./index");

    const result = validateAtlasRuntimeConfiguration("worker", {
      APP_ENV: "staging",
      LOG_LEVEL: "info",
      RELEASE_STAGE: "private-beta",
      DATABASE_URL: "postgresql://atlas:atlas@127.0.0.1:5432/atlas",
      REDIS_URL: "redis://127.0.0.1:6379",
      APP_REVISION: "rev-1",
      DEPLOYMENT_SLOT: "green",
      RELEASE_ARTIFACT_ID: "atlas-staging-build",
      RELEASE_ARTIFACT_SHA256: "a".repeat(64),
      OBSERVABILITY_AUTOMATION_SCHEDULE_MODE: "interval",
      OBSERVABILITY_AUTOMATION_INTERVAL_MINUTES: "15",
      OBSERVABILITY_AUTOMATION_STARTUP_DELAY_SECONDS: "30",
      OBSERVABILITY_AUTOMATION_TELEMETRY_POLICY: "automatic",
      OBSERVABILITY_AUTOMATION_ACTOR_USER_EMAIL: "operator-admin@atlas.local",
      OBSERVABILITY_AUTOMATION_REASON: "Run scheduled observability automation for the current release slot."
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        variable: "OBSERVABILITY_AUTOMATION_TELEMETRY_POLICY"
      })
    );
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
        executionMode: "dry-run",
        executor: "dry-run",
        targetHost: null,
        proofArtifactPath: null,
        execution: null,
        operationalIntegration: null,
        adapterResult: null,
        completedAt: new Date("2020-01-01T00:00:00.000Z").toISOString()
      },
      secretRotationExecutionReport: {
        version: 1,
        environment: "staging",
        provider: "",
        mode: "dry-run",
        rotatedBy: "ops",
        reason: "too short",
        generatedAt: new Date("2020-01-01T00:00:00.000Z").toISOString(),
        reportPath: "/tmp/rotation-report.json",
        manifestPath: "",
        manifest: {
          version: 1,
          environment: "staging",
          rotatedBy: "ops",
          reason: "too short",
          generatedAt: new Date("2020-01-01T00:00:00.000Z").toISOString(),
          maxAgeHours: 720,
          secrets: [{ key: "AUTH_SESSION_SIGNING_SECRET", rotatedAt: new Date("2020-01-01T00:00:00.000Z").toISOString() }]
        },
        command: {
          configured: false,
          exitCode: null,
          stdout: "",
          stderr: ""
        },
        operationalIntegration: null,
        adapterResult: null
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
      "Secret rotation manifest must include MINIO_SECRET_KEY.",
      "Secret rotation execution report must target production.",
      "Secret rotation execution report must include a provider label.",
      "Secret rotation execution report must include the stored manifest path."
    ]);
  });

  it("reports release-stage auth governance violations in runtime validation", async () => {
    const { validateAtlasRuntimeConfiguration } = await import("./index");

    expect(
      validateAtlasRuntimeConfiguration("api", {
        APP_ENV: "staging",
        LOG_LEVEL: "info",
        RELEASE_STAGE: "private-beta",
        AUTH_PROVIDER_MODE: "local-signed",
        AUTH_SESSION_SIGNING_SECRET: "atlas-secret",
        AUTH_SUPPORT_ACCESS_REVIEW_TTL_HOURS: "24",
        API_PORT: "4000",
        API_BASE_URL: "https://api.atlas.example",
        NEXT_PUBLIC_APP_URL: "https://atlas.example",
        DATABASE_URL: "postgresql://atlas:atlas@127.0.0.1:5432/atlas",
        REDIS_URL: "redis://127.0.0.1:6379",
        MINIO_ENDPOINT: "minio.atlas.example",
        MINIO_PORT: "9000",
        MINIO_REGION: "us-east-1",
        MINIO_ACCESS_KEY: "atlasminio",
        MINIO_SECRET_KEY: "atlassecret",
        MINIO_BUCKET_RECEIPTS: "atlas-receipts",
        MINIO_BUCKET_OPERATIONS: "atlas-operations",
        APP_REVISION: "rev-1",
        DEPLOYMENT_SLOT: "blue",
        RELEASE_ARTIFACT_ID: "atlas-staging-build",
        RELEASE_ARTIFACT_SHA256: "a".repeat(64)
      }).issues.map((issue) => issue.message)
    ).toEqual(
      expect.arrayContaining([
        "staging requires AUTH_PROVIDER_MODE=identity-bridge or AUTH_PROVIDER_MODE=external-oidc.",
        "staging and RELEASE_STAGE=private-beta require AUTH_SUPPORT_ACCESS_ALLOWED_EMAILS to be explicitly configured for operator governance."
      ])
    );

    expect(
      validateAtlasRuntimeConfiguration("api", {
        APP_ENV: "production",
        LOG_LEVEL: "info",
        RELEASE_STAGE: "ga",
        AUTH_PROVIDER_MODE: "identity-bridge",
        AUTH_SESSION_SIGNING_SECRET: "atlas-secret",
        AUTH_IDENTITY_BRIDGE_SECRET: "bridge-secret",
        AUTH_IDENTITY_BRIDGE_PROVIDER: "generic-sso",
        AUTH_IDENTITY_SESSION_TTL_MINUTES: "480",
        AUTH_SUPPORT_ACCESS_ALLOWED_EMAILS: "operator-admin@atlas.local",
        AUTH_SUPPORT_ACCESS_REVIEW_TTL_HOURS: "24",
        API_PORT: "4000",
        API_BASE_URL: "https://api.atlas.example",
        NEXT_PUBLIC_APP_URL: "https://atlas.example",
        DATABASE_URL: "postgresql://atlas:atlas@127.0.0.1:5432/atlas",
        REDIS_URL: "redis://127.0.0.1:6379",
        MINIO_ENDPOINT: "minio.atlas.example",
        MINIO_PORT: "9000",
        MINIO_REGION: "us-east-1",
        MINIO_ACCESS_KEY: "atlasminio",
        MINIO_SECRET_KEY: "atlassecret",
        MINIO_BUCKET_RECEIPTS: "atlas-receipts",
        MINIO_BUCKET_OPERATIONS: "atlas-operations",
        APP_REVISION: "rev-2",
        DEPLOYMENT_SLOT: "green",
        RELEASE_ARTIFACT_ID: "atlas-production-build",
        RELEASE_ARTIFACT_SHA256: "b".repeat(64)
      }).issues.map((issue) => issue.message)
    ).toEqual(
      expect.arrayContaining([
        "RELEASE_STAGE=ga requires AUTH_PROVIDER_MODE=external-oidc."
      ])
    );
  });
});
