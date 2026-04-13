import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn(async (_command?: unknown) => ({
  ETag: '"etag-1"'
}));
const putObjectCommandMock = vi.fn();
class PutObjectCommandMock {
  constructor(input: Record<string, unknown>) {
    putObjectCommandMock(input);
    Object.assign(this, input);
  }
}

const s3ClientMock = vi.fn();
class S3ClientMock {
  constructor(input?: Record<string, unknown>) {
    s3ClientMock(input);
  }

  send(command: unknown) {
    return sendMock(command);
  }
}

vi.mock("@aws-sdk/client-s3", () => ({
  PutObjectCommand: PutObjectCommandMock,
  S3Client: S3ClientMock
}));

function createOperationalIntegrationClient() {
  return {
    operationalIntegration: {
      findMany: vi.fn(async () => [
        {
          id: "integration-proof-1",
          kind: "PROOF_STORAGE",
          targetEnvironment: "STAGING",
          provider: "s3-compatible",
          label: "staging proof bucket",
          ownerEmail: "platform-ops@atlas.local",
          endpointReference: "minio://atlas-operations-staging",
          secretReference: "aws-secrets://atlas/staging/minio",
          configReference: "rollout-proof/staging",
          status: "ACTIVE",
          verificationStatus: "VERIFIED",
          verificationReason: "Verified against the owned staging operations bucket.",
          statusReason: null,
          metadata: null,
          lastVerifiedAt: new Date("2026-04-13T00:00:00.000Z"),
          lastUsedAt: null,
          createdAt: new Date("2026-04-13T00:00:00.000Z"),
          updatedAt: new Date("2026-04-13T00:00:00.000Z"),
          createdByUser: {
            email: "operator-admin@atlas.local"
          },
          updatedByUser: null
        }
      ]),
      update: vi.fn(async () => undefined)
    }
  };
}

describe("operational proof storage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns null when remote proof storage is disabled", async () => {
    vi.stubEnv("APP_ENV", "local");
    vi.stubEnv("OPERATIONAL_PROOF_STORAGE_MODE", "disabled");

    const sandbox = mkdtempSync(join(tmpdir(), "atlas-proof-storage-disabled-"));
    const filePath = join(sandbox, "report.json");
    writeFileSync(filePath, JSON.stringify({ ok: true }), "utf8");

    const { storeAtlasOperationalProofArtifact } = await import("./operational-proof-storage");
    const result = await storeAtlasOperationalProofArtifact({
      targetEnvironment: "STAGING",
      executionKind: "RESTORE_DRILL",
      artifactKind: "REPORT",
      label: "restore report",
      filePath
    });

    expect(result).toBeNull();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("uploads proof artifacts to the owned operations bucket", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("OPERATIONAL_PROOF_STORAGE_MODE", "s3-compatible");
    vi.stubEnv("OPERATIONAL_PROOF_STORAGE_PREFIX", "rollout-proof/staging");
    vi.stubEnv("MINIO_ENDPOINT", "minio.staging.internal");
    vi.stubEnv("MINIO_PORT", "9000");
    vi.stubEnv("MINIO_USE_SSL", "true");
    vi.stubEnv("MINIO_REGION", "us-east-1");
    vi.stubEnv("MINIO_ACCESS_KEY", "atlasminio");
    vi.stubEnv("MINIO_SECRET_KEY", "atlassecret");
    vi.stubEnv("MINIO_BUCKET_OPERATIONS", "atlas-operations-staging");

    const sandbox = mkdtempSync(join(tmpdir(), "atlas-proof-storage-"));
    const filePath = join(sandbox, "rotation-report.json");
    writeFileSync(filePath, JSON.stringify({ ok: true }), "utf8");

    const client = createOperationalIntegrationClient();
    const { storeAtlasOperationalProofArtifact } = await import("./operational-proof-storage");
    const result = await storeAtlasOperationalProofArtifact(
      {
        targetEnvironment: "STAGING",
        executionKind: "SECRET_ROTATION",
        artifactKind: "REPORT",
        label: "rotation report",
        filePath
      },
      client as never
    );

    expect(result).toMatchObject({
      provider: "s3-compatible",
      bucket: "atlas-operations-staging"
    });
    expect(result?.objectKey).toContain("rollout-proof/staging/staging/secret_rotation/");
    expect(result?.storageUrl).toContain("/atlas-operations-staging/");
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(putObjectCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: "atlas-operations-staging",
        ContentType: "application/json"
      })
    );
    expect(client.operationalIntegration.update).toHaveBeenCalled();
  });
});
