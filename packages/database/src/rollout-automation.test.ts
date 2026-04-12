import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AtlasActorContext } from "@atlas/auth";
import { afterEach, describe, expect, it, vi } from "vitest";

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

describe("rollout automation", () => {
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
    const result = executeAtlasRestoreDrill({
      backupPath,
      targetEnvironment: "staging",
      targetLabel: "staging-restore-slot",
      executeRestore: false
    });

    expect(result.report.executedRestore).toBe(false);
    expect(result.report.executionMode).toBe("dry-run");
    expect(result.report.executor).toBe("dry-run");
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
    const result = executeAtlasSecretRotation({
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
    });

    expect(result.report.mode).toBe("dry-run");
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
    const now = new Date().toISOString();
    const result = executeAtlasPromotionAutomation({
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
        command: {
          configured: true,
          exitCode: 0,
          stdout: "rotated",
          stderr: ""
        }
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
    });

    expect(result.report.mode).toBe("dry-run");
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
    const result = executeAtlasUpstreamIdentityLifecycle({
      actor: createOperatorActor(),
      assignment: {
        id: "assignment-1",
        provider: "okta-design-partner",
        externalEmail: "buyer-admin@example.com",
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
        provisionedAt: new Date().toISOString(),
        lastExchangedAt: null,
        statusChangedAt: null,
        provisionedByUserEmail: "operator-admin@atlas.local",
        statusChangedByUserEmail: null,
        activeSessionCount: 0
      },
      action: "SUSPEND",
      reason: "Suspend upstream tenant access while ownership evidence is reviewed."
    });

    expect(result.report.mode).toBe("dry-run");
    expect(listAtlasUpstreamIdentityLifecycleReports(1)).toEqual([
      expect.objectContaining({
        assignmentId: "assignment-1",
        action: "SUSPEND"
      })
    ]);
  });
});
