import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { operationsRuntime, storageRuntime, type AtlasOperationalStoredArtifact } from "@atlas/config";
import { Prisma, type PrismaClient } from "./generated/client/index.js";
import { prisma } from "./client";
import { createAtlasFileIntegrityManifest } from "./file-integrity";
import { resolveOperationalIntegrationForExecution, touchOperationalIntegrationUsage } from "./operational-integrations";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export type AtlasOperationalStoredArtifactRecord = AtlasOperationalStoredArtifact & {
  filePath: string;
  kind: "REPORT" | "MANIFEST" | "BACKUP" | "BUNDLE";
  label: string;
};

let atlasOperationalProofStorageClient: S3Client | null = null;

function getAtlasOperationalProofStorageClient() {
  if (atlasOperationalProofStorageClient) {
    return atlasOperationalProofStorageClient;
  }

  const protocol = storageRuntime.useSsl ? "https" : "http";

  atlasOperationalProofStorageClient = new S3Client({
    region: storageRuntime.region,
    endpoint: `${protocol}://${storageRuntime.endpoint}:${storageRuntime.port}`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: storageRuntime.accessKey,
      secretAccessKey: storageRuntime.secretKey
    }
  });

  return atlasOperationalProofStorageClient;
}

function sanitizeAtlasOperationalPathFragment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function detectAtlasOperationalArtifactContentType(filePath: string) {
  const extension = extname(filePath).toLowerCase();

  if (extension === ".json") {
    return "application/json";
  }

  if (extension === ".sql") {
    return "application/sql";
  }

  if (extension === ".txt" || extension === ".log") {
    return "text/plain; charset=utf-8";
  }

  return "application/octet-stream";
}

function buildAtlasOperationalArtifactObjectKey(input: {
  targetEnvironment: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
  executionKind: "RESTORE_DRILL" | "SECRET_ROTATION" | "DEPLOYMENT_PROMOTION" | "UPSTREAM_IDENTITY";
  filePath: string;
  sha256: string;
}) {
  const fileName = sanitizeAtlasOperationalPathFragment(basename(input.filePath)) || "artifact";
  const prefix = operationsRuntime.proofStoragePrefix.replace(/^\/+|\/+$/g, "");

  return [
    prefix,
    input.targetEnvironment.toLowerCase(),
    input.executionKind.toLowerCase(),
    `${input.sha256.slice(0, 16)}-${fileName}`
  ].join("/");
}

function buildAtlasOperationalArtifactUrl(bucket: string, objectKey: string) {
  const publicBaseUrl = operationsRuntime.proofStoragePublicBaseUrl;

  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/+$/g, "")}/${objectKey}`;
  }

  const protocol = storageRuntime.useSsl ? "https" : "http";
  return `${protocol}://${storageRuntime.endpoint}:${storageRuntime.port}/${bucket}/${objectKey}`;
}

export async function storeAtlasOperationalProofArtifact(
  input: {
    targetEnvironment: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
    executionKind: "RESTORE_DRILL" | "SECRET_ROTATION" | "DEPLOYMENT_PROMOTION" | "UPSTREAM_IDENTITY";
    artifactKind: "REPORT" | "MANIFEST" | "BACKUP" | "BUNDLE";
    label: string;
    filePath: string;
  },
  client: DatabaseClient = prisma
) {
  if (operationsRuntime.proofStorageMode === "disabled") {
    return null;
  }

  const manifest = createAtlasFileIntegrityManifest(input.filePath);
  const contentType = detectAtlasOperationalArtifactContentType(manifest.filePath);
  const objectKey = buildAtlasOperationalArtifactObjectKey({
    targetEnvironment: input.targetEnvironment,
    executionKind: input.executionKind,
    filePath: manifest.filePath,
    sha256: manifest.sha256
  });
  const integration = await resolveOperationalIntegrationForExecution(
    {
      kind: "PROOF_STORAGE",
      targetEnvironment: input.targetEnvironment,
      provider: operationsRuntime.proofStorageMode
    },
    client
  );
  const result = await getAtlasOperationalProofStorageClient().send(
    new PutObjectCommand({
      Bucket: storageRuntime.bucketOperations,
      Key: objectKey,
      Body: readFileSync(manifest.filePath),
      ContentType: contentType,
      Metadata: {
        sha256: manifest.sha256,
        artifactkind: input.artifactKind.toLowerCase(),
        executionkind: input.executionKind.toLowerCase(),
        label: input.label.slice(0, 120)
      }
    })
  );

  await touchOperationalIntegrationUsage(integration.id, client);

  return {
    provider: operationsRuntime.proofStorageMode,
    bucket: storageRuntime.bucketOperations,
    objectKey,
    storageUrl: buildAtlasOperationalArtifactUrl(storageRuntime.bucketOperations, objectKey),
    contentType,
    sha256: manifest.sha256,
    sizeBytes: manifest.sizeBytes,
    etag: typeof result.ETag === "string" ? result.ETag.replaceAll("\"", "") : null,
    uploadedAt: new Date().toISOString()
  } satisfies AtlasOperationalStoredArtifact;
}

export async function storeAtlasOperationalProofArtifacts(
  input: {
    executionKind: "RESTORE_DRILL" | "SECRET_ROTATION" | "DEPLOYMENT_PROMOTION" | "UPSTREAM_IDENTITY";
    targetEnvironment: "local" | "development" | "staging" | "production" | "DEVELOPMENT" | "STAGING" | "PRODUCTION" | null;
    artifacts: Array<{
      kind: "REPORT" | "MANIFEST" | "BACKUP" | "BUNDLE";
      label: string;
      filePath: string;
    }>;
  },
  client: DatabaseClient = prisma
) {
  if (!input.targetEnvironment) {
    return [] satisfies AtlasOperationalStoredArtifactRecord[];
  }

  if (input.targetEnvironment === "local") {
    return [] satisfies AtlasOperationalStoredArtifactRecord[];
  }

  const targetEnvironment =
    input.targetEnvironment === "development"
      ? "DEVELOPMENT"
      : input.targetEnvironment === "staging"
        ? "STAGING"
        : input.targetEnvironment === "production"
          ? "PRODUCTION"
          : input.targetEnvironment;

  const storedArtifacts = await Promise.all(
    input.artifacts.map(async (artifact) => {
      const storedArtifact = await storeAtlasOperationalProofArtifact(
        {
          targetEnvironment,
          executionKind: input.executionKind,
          artifactKind: artifact.kind,
          label: artifact.label,
          filePath: artifact.filePath
        },
        client
      );

      if (!storedArtifact) {
        return null;
      }

      return {
        ...storedArtifact,
        filePath: createAtlasFileIntegrityManifest(artifact.filePath).filePath,
        kind: artifact.kind,
        label: artifact.label
      } satisfies AtlasOperationalStoredArtifactRecord;
    })
  );

  return storedArtifacts.filter((artifact) => artifact !== null);
}
