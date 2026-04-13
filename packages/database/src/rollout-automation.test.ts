import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AtlasActorContext } from "@atlas/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function createOperatorActor(email = "operator-admin@atlas.local") {
  return {
    user: {
      id: "user-operator",
      email,
      name: "Operator Admin"
    },
    organization: {
      id: "org-operator",
      slug: "atlas-demo-operator",
      name: "Atlas Demo Operator",
      kind: "OPERATOR"
    },
    membership: {
      id: "membership-operator",
      role: "ADMIN"
    },
    workspace: "OPERATOR",
    agentId: null,
    source: "identity-provider",
    providerMode: "external-oidc",
    sessionId: "session-1"
  } satisfies AtlasActorContext;
}

function adapterScriptPath(fileName: string) {
  return fileURLToPath(new URL(`../../../scripts/adapters/${fileName}`, import.meta.url));
}

function createOperationalIntegrationRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "integration-1",
    kind: "RESTORE_DRILL",
    targetEnvironment: "STAGING",
    provider: "kubernetes-job",
    label: "staging restore owner",
    ownerEmail: "platform-ops@atlas.local",
    endpointReference: "atlas-staging/atlas-restore-job",
    secretReference: "aws-secrets://atlas/staging/restore",
    configReference: "atlas-restore-job",
    status: "ACTIVE",
    verificationStatus: "VERIFIED",
    verificationReason: "Verified against the owned staging restore target.",
    statusReason: null,
    metadata: null,
    lastVerifiedAt: new Date("2026-04-12T00:00:00.000Z"),
    lastUsedAt: null,
    createdByUser: {
      email: "operator-admin@atlas.local"
    },
    updatedByUser: {
      email: "operator-admin@atlas.local"
    },
    createdAt: new Date("2026-04-12T00:00:00.000Z"),
    updatedAt: new Date("2026-04-12T00:00:00.000Z"),
    ...overrides
  };
}

function createOperationalIntegrationClient(record = createOperationalIntegrationRecord()) {
  return {
    externalIdentityAssignment: {
      update: vi.fn(async () => undefined)
    },
    operationalIntegration: {
      findMany: vi.fn(async () => [record]),
      update: vi.fn(async () => undefined)
    },
    operationalExecution: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "execution-1",
        kind: data.kind,
        mode: data.mode,
        status: data.status,
        targetEnvironment: data.targetEnvironment ?? null,
        provider: data.provider,
        actorUserEmail: data.actorUserEmail,
        summary: data.summary,
        providerOperationId: data.providerOperationId ?? null,
        targetReference: data.targetReference ?? null,
        reportPath: data.reportPath ?? null,
        metadata: data.metadata ?? null,
        completedAt: new Date("2026-04-12T00:00:00.000Z"),
        createdAt: new Date("2026-04-12T00:00:00.000Z"),
        operationalIntegration: null,
        proofArtifacts: []
      }))
    }
  };
}

describe("rollout automation", { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.stubEnv("OPERATIONAL_PROOF_STORAGE_MODE", "disabled");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("creates dry-run restore drill proof artifacts", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "atlas-restore-"));
    const backupPath = join(sandbox, "restore.sql");
    writeFileSync(backupPath, "select 1;\n", "utf8");

    vi.stubEnv("RESTORE_DRILL_REPORT_DIR", join(sandbox, "restore-reports"));

    const { executeAtlasRestoreDrill, listAtlasRestoreDrillReports } = await import("./rollout-automation");
    const client = createOperationalIntegrationClient();
    const result = await executeAtlasRestoreDrill({
      backupPath,
      targetEnvironment: "staging",
      targetLabel: "staging-restore-slot",
      executeRestore: false
    }, client as never);

    expect(result.report.executedRestore).toBe(false);
    expect(result.report.executionMode).toBe("dry-run");
    expect(result.report.executor).toBe("dry-run");
    expect(result.report.operationalIntegration).toBeNull();
    expect(result.report.adapterResult).toBeNull();
    expect(listAtlasRestoreDrillReports(1)).toEqual([
      expect.objectContaining({
        targetEnvironment: "staging",
        targetLabel: "staging-restore-slot"
      })
    ]);
  });

  it("creates secret rotation execution reports in dry-run mode", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "atlas-rotation-"));

    vi.stubEnv("SECRET_ROTATION_REPORT_DIR", join(sandbox, "rotation-reports"));
    vi.stubEnv("SECRET_ROTATION_MANIFEST_DIR", join(sandbox, "rotation-manifests"));

    const { executeAtlasSecretRotation, listAtlasSecretRotationExecutionReports } = await import("./rollout-automation");
    const client = createOperationalIntegrationClient();
    const result = await executeAtlasSecretRotation({
      environment: "staging",
      rotatedBy: "operator-admin@atlas.local",
      reason: "Rotate staging secrets before validating release promotion.",
      secretKeys: [
        "AUTH_SESSION_SIGNING_SECRET",
        "AUTH_IDENTITY_BRIDGE_SECRET",
        "DATABASE_URL",
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "MINIO_SECRET_KEY"
      ]
    }, client as never);

    expect(result.report.mode).toBe("dry-run");
    expect(result.report.reportPath).toBe(result.reportPath);
    expect(result.report.operationalIntegration).toBeNull();
    expect(result.report.command).toEqual(
      expect.objectContaining({
        configured: false,
        exitCode: null
      })
    );
    expect(listAtlasSecretRotationExecutionReports(1)).toEqual([
      expect.objectContaining({
        environment: "staging",
        provider: "generic-secret-manager"
      })
    ]);
  });

  it("creates promotion execution reports in dry-run mode", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "atlas-promotion-"));
    const bundlePath = join(sandbox, "promotion.json");
    writeFileSync(bundlePath, JSON.stringify({ ok: true }), "utf8");

    vi.stubEnv("DEPLOYMENT_AUTOMATION_REPORT_DIR", join(sandbox, "promotion-reports"));

    const { executeAtlasPromotionAutomation, listAtlasPromotionExecutionReports } = await import("./rollout-automation");
    const client = createOperationalIntegrationClient();
    const now = new Date().toISOString();
    const result = await executeAtlasPromotionAutomation({
      fromEnv: "development",
      toEnv: "staging",
      services: ["api"],
      restoreDrillReport: {
        version: 1,
        appEnv: "staging",
        releaseStage: "private-beta",
        revision: "rev-1",
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
          generatedAt: now
        },
        executionMode: "command",
        executor: "psql",
        targetHost: "postgres.staging.internal",
        proofArtifactPath: "/tmp/restore-report.json",
        execution: {
          databaseUrlRedacted: "postgresql://atlas:***@postgres.staging.internal:5432/atlas",
          stdout: "RESTORE"
        },
        operationalIntegration: null,
        adapterResult: null,
        completedAt: now
      },
      secretRotationExecutionReport: {
        version: 1,
        environment: "staging",
        provider: "aws-secrets-manager",
        mode: "command",
        rotatedBy: "operator-admin@atlas.local",
        reason: "Rotate staging secrets before validating release promotion.",
        generatedAt: now,
        reportPath: "/tmp/rotation-report.json",
        manifestPath: "/tmp/rotation-manifest.json",
        manifest: {
          version: 1,
          environment: "staging",
          rotatedBy: "operator-admin@atlas.local",
          reason: "Rotate staging secrets before validating release promotion.",
          generatedAt: now,
          maxAgeHours: 720,
          secrets: [
            { key: "AUTH_SESSION_SIGNING_SECRET", rotatedAt: now },
            { key: "AUTH_IDENTITY_BRIDGE_SECRET", rotatedAt: now },
            { key: "DATABASE_URL", rotatedAt: now },
            { key: "STRIPE_SECRET_KEY", rotatedAt: now },
            { key: "STRIPE_WEBHOOK_SECRET", rotatedAt: now },
            { key: "MINIO_SECRET_KEY", rotatedAt: now }
          ]
        },
        operationalIntegration: null,
        command: {
          configured: true,
          exitCode: 0,
          stdout: "rotated",
          stderr: ""
        },
        adapterResult: null
      },
      environment: {
        APP_ENV: "staging",
        AUTH_PROVIDER_MODE: "external-oidc",
        AUTH_SUPPORT_ACCESS_ALLOWED_EMAILS: "operator-admin@atlas.local",
        AUTH_SUPPORT_ACCESS_REVIEW_TTL_HOURS: "24",
        APP_REVISION: "rev-1",
        DEPLOYMENT_SLOT: "blue",
        RELEASE_ARTIFACT_ID: "atlas-staging-build",
        RELEASE_ARTIFACT_SHA256: "a".repeat(64)
      },
      bundlePath
    }, client as never);

    expect(result.report.mode).toBe("dry-run");
    expect(result.report.reportPath).toBe(result.reportPath);
    expect(result.report.operationalIntegration).toBeNull();
    expect(listAtlasPromotionExecutionReports(1)).toEqual([
      expect.objectContaining({
        toEnv: "staging",
        services: ["api"]
      })
    ]);
  });

  it("creates upstream identity execution reports in dry-run mode", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "atlas-upstream-"));

    vi.stubEnv("AUTH_UPSTREAM_IDENTITY_REPORT_DIR", join(sandbox, "upstream-reports"));

    const { executeAtlasUpstreamIdentityLifecycle, listAtlasUpstreamIdentityLifecycleReports } = await import(
      "./rollout-automation"
    );
    const client = createOperationalIntegrationClient();
    const result = await executeAtlasUpstreamIdentityLifecycle({
      actor: createOperatorActor(),
      assignment: {
        id: "assignment-1",
        provider: "okta-design-partner",
        externalEmail: "buyer-admin@example.com",
        providerSubject: null,
        userId: "user-buyer",
        userEmail: "buyer-admin@example.com",
        userName: "Buyer Admin",
        organizationId: "org-buyer",
        organizationSlug: "atlas-demo-buyer",
        organizationName: "Atlas Demo Buyer",
        workspace: "BUYER",
        membershipId: "membership-buyer",
        role: "ADMIN",
        status: "ACTIVE",
        statusReason: null,
        upstreamUserId: null,
        upstreamAssignmentId: null,
        upstreamTargetRef: null,
        upstreamStatus: null,
        provisionedAt: new Date().toISOString(),
        lastExchangedAt: null,
        lastUpstreamSyncedAt: null,
        statusChangedAt: null,
        provisionedByUserEmail: "operator-admin@atlas.local",
        statusChangedByUserEmail: null,
        activeSessionCount: 0
      },
      action: "SUSPEND",
      reason: "Suspend upstream tenant access while ownership evidence is reviewed."
    }, client as never);

    expect(result.report.mode).toBe("dry-run");
    expect(result.report.reportPath).toBe(result.reportPath);
    expect(result.report.operationalIntegration).toBeNull();
    expect(listAtlasUpstreamIdentityLifecycleReports(1)).toEqual([
      expect.objectContaining({
        assignmentId: "assignment-1",
        action: "SUSPEND"
      })
    ]);
  });

  it("parses command adapter output for restore drills", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "atlas-restore-command-"));
    const backupPath = join(sandbox, "restore.sql");
    writeFileSync(backupPath, "select 1;\n", "utf8");

    vi.stubEnv("RESTORE_DRILL_MODE", "command");
    vi.stubEnv("RESTORE_DRILL_PROVIDER", "kubernetes-job");
    vi.stubEnv("RESTORE_DRILL_KUBERNETES_NAMESPACE", "atlas-staging");
    vi.stubEnv("RESTORE_DRILL_KUBERNETES_JOB_TEMPLATE", "atlas-restore-job");
    vi.stubEnv("RESTORE_DRILL_COMMAND", `${process.execPath} ${adapterScriptPath("restore-drill.mjs")}`);
    vi.stubEnv("RESTORE_DRILL_REPORT_DIR", join(sandbox, "restore-reports"));

    const { executeAtlasRestoreDrill } = await import("./rollout-automation");
    const client = createOperationalIntegrationClient();
    const result = await executeAtlasRestoreDrill({
      backupPath,
      targetEnvironment: "staging",
      targetLabel: "staging-restore-slot",
      targetHost: "postgres.staging.internal",
      executeRestore: true
    }, client as never);

    expect(result.report.adapterResult).toEqual(
      expect.objectContaining({
        provider: "kubernetes-job",
        adapter: "kubernetes-restore-job"
      })
    );
    expect(result.report.operationalIntegration).toEqual(
      expect.objectContaining({
        id: "integration-1",
        kind: "RESTORE_DRILL"
      })
    );
  });

  it("parses command adapter output for secret rotation", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "atlas-rotation-command-"));

    vi.stubEnv("SECRET_ROTATION_MODE", "command");
    vi.stubEnv("SECRET_ROTATION_PROVIDER", "aws-secrets-manager");
    vi.stubEnv("SECRET_ROTATION_AWS_REGION", "us-east-1");
    vi.stubEnv("SECRET_ROTATION_AWS_PREFIX", "atlas/staging");
    vi.stubEnv("SECRET_ROTATION_COMMAND", `${process.execPath} ${adapterScriptPath("secret-rotation.mjs")}`);
    vi.stubEnv("SECRET_ROTATION_REPORT_DIR", join(sandbox, "rotation-reports"));
    vi.stubEnv("SECRET_ROTATION_MANIFEST_DIR", join(sandbox, "rotation-manifests"));

    const { executeAtlasSecretRotation } = await import("./rollout-automation");
    const client = createOperationalIntegrationClient(
      createOperationalIntegrationRecord({
        kind: "SECRET_ROTATION",
        provider: "aws-secrets-manager",
        label: "staging secret rotation",
        endpointReference: "us-east-1",
        secretReference: "atlas/staging"
      })
    );
    const result = await executeAtlasSecretRotation({
      environment: "staging",
      rotatedBy: "operator-admin@atlas.local",
      reason: "Rotate staging secrets before validating release promotion.",
      secretKeys: ["AUTH_SESSION_SIGNING_SECRET"]
    }, client as never);

    expect(result.report.adapterResult).toEqual(
      expect.objectContaining({
        provider: "aws-secrets-manager",
        adapter: "aws-secrets-manager-rotation"
      })
    );
    expect(result.report.operationalIntegration).toEqual(
      expect.objectContaining({
        kind: "SECRET_ROTATION",
        provider: "aws-secrets-manager"
      })
    );
  });

  it("parses command adapter output for promotion automation", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "atlas-promotion-command-"));
    const bundlePath = join(sandbox, "promotion.json");
    writeFileSync(bundlePath, JSON.stringify({ ok: true }), "utf8");
    const now = new Date().toISOString();

    vi.stubEnv("DEPLOYMENT_AUTOMATION_MODE", "command");
    vi.stubEnv("DEPLOYMENT_AUTOMATION_PROVIDER", "github-actions");
    vi.stubEnv("DEPLOYMENT_AUTOMATION_GITHUB_REPOSITORY", "atlas/payments-os");
    vi.stubEnv("DEPLOYMENT_AUTOMATION_GITHUB_WORKFLOW", "deploy-staging");
    vi.stubEnv("DEPLOYMENT_AUTOMATION_COMMAND", `${process.execPath} ${adapterScriptPath("deployment-promotion.mjs")}`);
    vi.stubEnv("DEPLOYMENT_AUTOMATION_REPORT_DIR", join(sandbox, "promotion-reports"));

    const { executeAtlasPromotionAutomation } = await import("./rollout-automation");
    const client = createOperationalIntegrationClient(
      createOperationalIntegrationRecord({
        kind: "DEPLOYMENT_AUTOMATION",
        provider: "github-actions",
        label: "staging github deployment",
        endpointReference: "atlas/payments-os"
      })
    );
    const result = await executeAtlasPromotionAutomation({
      fromEnv: "development",
      toEnv: "staging",
      services: ["api"],
      restoreDrillReport: {
        version: 1,
        appEnv: "staging",
        releaseStage: "private-beta",
        revision: "rev-1",
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
          generatedAt: now
        },
        executionMode: "command",
        executor: "configured-command",
        targetHost: "postgres.staging.internal",
        proofArtifactPath: "/tmp/restore-report.json",
        execution: {
          databaseUrlRedacted: "postgresql://atlas:***@postgres.staging.internal:5432/atlas",
          stdout: "RESTORE"
        },
        operationalIntegration: null,
        adapterResult: {
          version: 1,
          adapter: "kubernetes-restore-job",
          provider: "kubernetes-job",
          operationId: "kubernetes-job-123456",
          summary: "Restore drill.",
          targetRef: "atlas-staging/atlas-restore-job",
          metadata: {}
        },
        completedAt: now
      },
      secretRotationExecutionReport: {
        version: 1,
        environment: "staging",
        provider: "aws-secrets-manager",
        mode: "command",
        rotatedBy: "operator-admin@atlas.local",
        reason: "Rotate staging secrets before validating release promotion.",
        generatedAt: now,
        reportPath: "/tmp/rotation-report.json",
        manifestPath: "/tmp/rotation-manifest.json",
        manifest: {
          version: 1,
          environment: "staging",
          rotatedBy: "operator-admin@atlas.local",
          reason: "Rotate staging secrets before validating release promotion.",
          generatedAt: now,
          maxAgeHours: 720,
          secrets: [
            { key: "AUTH_SESSION_SIGNING_SECRET", rotatedAt: now },
            { key: "AUTH_IDENTITY_BRIDGE_SECRET", rotatedAt: now },
            { key: "DATABASE_URL", rotatedAt: now },
            { key: "STRIPE_SECRET_KEY", rotatedAt: now },
            { key: "STRIPE_WEBHOOK_SECRET", rotatedAt: now },
            { key: "MINIO_SECRET_KEY", rotatedAt: now }
          ]
        },
        operationalIntegration: null,
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
          summary: "Rotate staging secrets.",
          targetRef: "us-east-1:atlas/staging",
          metadata: {}
        }
      },
      environment: {
        APP_ENV: "staging",
        AUTH_PROVIDER_MODE: "external-oidc",
        AUTH_SUPPORT_ACCESS_ALLOWED_EMAILS: "operator-admin@atlas.local",
        AUTH_SUPPORT_ACCESS_REVIEW_TTL_HOURS: "24",
        RESTORE_DRILL_PROVIDER: "kubernetes-job",
        APP_REVISION: "rev-1",
        DEPLOYMENT_SLOT: "blue",
        RELEASE_ARTIFACT_ID: "atlas-staging-build",
        RELEASE_ARTIFACT_SHA256: "a".repeat(64)
      },
      bundlePath
    }, client as never);

    expect(result.report.adapterResult).toEqual(
      expect.objectContaining({
        provider: "github-actions",
        adapter: "github-actions-dispatch"
      })
    );
    expect(result.report.operationalIntegration).toEqual(
      expect.objectContaining({
        kind: "DEPLOYMENT_AUTOMATION",
        provider: "github-actions"
      })
    );
  });

  it("parses command adapter output for upstream identity lifecycle", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "atlas-upstream-command-"));

    vi.stubEnv("AUTH_UPSTREAM_IDENTITY_MODE", "command");
    vi.stubEnv("AUTH_UPSTREAM_IDENTITY_PROVIDER", "okta-scim");
    vi.stubEnv("AUTH_OKTA_ORG_URL", "https://atlas.okta.example");
    vi.stubEnv("AUTH_OKTA_SCIM_APP_ID", "atlas-okta-app");
    vi.stubEnv("AUTH_OKTA_API_TOKEN", "okta-token");
    vi.stubEnv("AUTH_UPSTREAM_IDENTITY_COMMAND", `${process.execPath} ${adapterScriptPath("upstream-identity.mjs")}`);
    vi.stubEnv("AUTH_UPSTREAM_IDENTITY_REPORT_DIR", join(sandbox, "upstream-reports"));
    vi.stubEnv("ATLAS_SIMULATE_EXTERNAL_EXECUTION", "true");

    vi.stubEnv("APP_ENV", "staging");

    const { executeAtlasUpstreamIdentityLifecycle } = await import("./rollout-automation");
    const client = createOperationalIntegrationClient(
      createOperationalIntegrationRecord({
        kind: "UPSTREAM_IDENTITY",
        provider: "okta-scim",
        label: "staging okta lifecycle",
        endpointReference: "https://atlas.okta.example"
      })
    );
    const result = await executeAtlasUpstreamIdentityLifecycle({
      actor: createOperatorActor(),
      assignment: {
        id: "assignment-1",
        provider: "okta-design-partner",
        externalEmail: "buyer-admin@example.com",
        providerSubject: null,
        userId: "user-buyer",
        userEmail: "buyer-admin@example.com",
        userName: "Buyer Admin",
        organizationId: "org-buyer",
        organizationSlug: "atlas-demo-buyer",
        organizationName: "Atlas Demo Buyer",
        workspace: "BUYER",
        membershipId: "membership-buyer",
        role: "ADMIN",
        status: "ACTIVE",
        statusReason: null,
        upstreamUserId: null,
        upstreamAssignmentId: null,
        upstreamTargetRef: null,
        upstreamStatus: null,
        provisionedAt: new Date().toISOString(),
        lastExchangedAt: null,
        lastUpstreamSyncedAt: null,
        statusChangedAt: null,
        provisionedByUserEmail: "operator-admin@atlas.local",
        statusChangedByUserEmail: null,
        activeSessionCount: 0
      },
      action: "REVOKE",
      reason: "Revoke upstream tenant access after access review closure."
    }, client as never);

    expect(result.report.adapterResult).toEqual(
      expect.objectContaining({
        provider: "okta-scim",
        adapter: "okta-scim-admin"
      })
    );
    expect(result.report.operationalIntegration).toEqual(
      expect.objectContaining({
        kind: "UPSTREAM_IDENTITY",
        provider: "okta-scim"
      })
    );
    expect(client.externalIdentityAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "assignment-1"
        },
        data: expect.objectContaining({
          providerSubject: expect.any(String),
          upstreamUserId: expect.any(String),
          upstreamStatus: "REVOKED",
          lastUpstreamSyncedAt: expect.any(Date)
        })
      })
    );
  });
});
