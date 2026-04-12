import { canAtlasActorMutate, type AtlasActorContext } from "@atlas/auth";
import type {
  AtlasAppEnvironment,
  AtlasCommandAdapterMode,
  AtlasOperationalIntegrationSnapshot
} from "@atlas/config";
import { Prisma, type PrismaClient } from "./generated/client/index.js";
import { prisma } from "./client";
import { createAtlasFileIntegrityManifest } from "./file-integrity";
import type { AtlasOperationalIntegrationRecord } from "./operational-integrations";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export class AtlasRolloutExecutionWorkflowError extends Error {
  constructor(message: string, readonly code: "bad_request" | "forbidden") {
    super(message);
    this.name = "AtlasRolloutExecutionWorkflowError";
  }
}

export type AtlasOperationalProofArtifactRecord = {
  id: string;
  kind: "REPORT" | "MANIFEST" | "BACKUP" | "BUNDLE";
  label: string;
  filePath: string;
  sha256: string;
  sizeBytes: number;
  metadata: Prisma.JsonObject | null;
  createdAt: string;
};

export type AtlasOperationalExecutionRecord = {
  id: string;
  kind: "RESTORE_DRILL" | "SECRET_ROTATION" | "DEPLOYMENT_PROMOTION" | "UPSTREAM_IDENTITY";
  mode: "DRY_RUN" | "COMMAND";
  status: "SUCCEEDED" | "FAILED";
  targetEnvironment: "DEVELOPMENT" | "STAGING" | "PRODUCTION" | null;
  provider: string;
  actorUserEmail: string;
  summary: string;
  providerOperationId: string | null;
  targetReference: string | null;
  reportPath: string | null;
  metadata: Prisma.JsonObject | null;
  completedAt: string;
  createdAt: string;
  operationalIntegration: AtlasOperationalIntegrationSnapshot | null;
  proofArtifacts: AtlasOperationalProofArtifactRecord[];
};

export type AtlasOperationalExecutionSummary = {
  totalCount: number;
  commandCount: number;
  dryRunCount: number;
  failedCount: number;
  latestCompletedAt: string | null;
};

type AtlasOperationalExecutionProofArtifactInput = {
  kind: "REPORT" | "MANIFEST" | "BACKUP" | "BUNDLE";
  label: string;
  filePath: string;
  metadata?: Prisma.JsonObject | null;
};

type AtlasOperationalExecutionInput = {
  kind: "RESTORE_DRILL" | "SECRET_ROTATION" | "DEPLOYMENT_PROMOTION" | "UPSTREAM_IDENTITY";
  mode: AtlasCommandAdapterMode;
  status: "SUCCEEDED" | "FAILED";
  targetEnvironment?: AtlasAppEnvironment | "DEVELOPMENT" | "STAGING" | "PRODUCTION" | null;
  provider: string;
  actorUserEmail: string;
  summary: string;
  providerOperationId?: string | null;
  targetReference?: string | null;
  reportPath?: string | null;
  metadata?: Prisma.JsonObject | null;
  operationalIntegration?: AtlasOperationalIntegrationRecord | AtlasOperationalIntegrationSnapshot | null;
  completedAt?: string;
  proofArtifacts?: AtlasOperationalExecutionProofArtifactInput[];
};

function assertOperatorRolloutActor(actor: AtlasActorContext) {
  if (actor.workspace !== "OPERATOR" || actor.organization.kind !== "OPERATOR") {
    throw new AtlasRolloutExecutionWorkflowError(
      "Rollout execution records can only be viewed from the operator workspace.",
      "forbidden"
    );
  }

  if (!canAtlasActorMutate(actor) && actor.membership.role !== "OPERATOR") {
    throw new AtlasRolloutExecutionWorkflowError(
      "Rollout execution records require an operator session.",
      "forbidden"
    );
  }
}

function normalizeExecutionEnvironment(value: AtlasOperationalExecutionInput["targetEnvironment"]) {
  if (!value) {
    return null;
  }

  if (value === "DEVELOPMENT" || value === "STAGING" || value === "PRODUCTION") {
    return value;
  }

  if (value === "development") {
    return "DEVELOPMENT";
  }

  if (value === "staging") {
    return "STAGING";
  }

  if (value === "production") {
    return "PRODUCTION";
  }

  return null;
}

function mapOperationalIntegration(
  integration:
    | ({
        id: string;
        kind: string;
        targetEnvironment: string;
        provider: string;
        label: string;
        ownerEmail: string;
        endpointReference: string | null;
        secretReference: string | null;
        configReference: string | null;
        verificationStatus: string;
        lastVerifiedAt: Date | string | null;
      } & Record<string, unknown>)
    | null
): AtlasOperationalIntegrationSnapshot | null {
  if (!integration) {
    return null;
  }

  return {
    id: integration.id,
    kind: integration.kind as AtlasOperationalIntegrationSnapshot["kind"],
    targetEnvironment: integration.targetEnvironment as AtlasOperationalIntegrationSnapshot["targetEnvironment"],
    provider: integration.provider,
    label: integration.label,
    ownerEmail: integration.ownerEmail,
    endpointReference: integration.endpointReference,
    secretReference: integration.secretReference,
    configReference: integration.configReference,
    verificationStatus: integration.verificationStatus as AtlasOperationalIntegrationSnapshot["verificationStatus"],
    lastVerifiedAt:
      integration.lastVerifiedAt instanceof Date
        ? integration.lastVerifiedAt.toISOString()
        : typeof integration.lastVerifiedAt === "string"
          ? integration.lastVerifiedAt
          : null
  };
}

function mapExecutionRecord(
  record: {
    id: string;
    kind: "RESTORE_DRILL" | "SECRET_ROTATION" | "DEPLOYMENT_PROMOTION" | "UPSTREAM_IDENTITY";
    mode: "DRY_RUN" | "COMMAND";
    status: "SUCCEEDED" | "FAILED";
    targetEnvironment: "DEVELOPMENT" | "STAGING" | "PRODUCTION" | null;
    provider: string;
    actorUserEmail: string;
    summary: string;
    providerOperationId: string | null;
    targetReference: string | null;
    reportPath: string | null;
    metadata: Prisma.JsonValue | null;
    completedAt: Date;
    createdAt: Date;
    operationalIntegration: {
      id: string;
      kind: string;
      targetEnvironment: string;
      provider: string;
      label: string;
      ownerEmail: string;
      endpointReference: string | null;
      secretReference: string | null;
      configReference: string | null;
      verificationStatus: string;
      lastVerifiedAt: Date | null;
    } | null;
    proofArtifacts: Array<{
      id: string;
      kind: "REPORT" | "MANIFEST" | "BACKUP" | "BUNDLE";
      label: string;
      filePath: string;
      sha256: string;
      sizeBytes: number;
      metadata: Prisma.JsonValue | null;
      createdAt: Date;
    }>;
  }
) {
  return {
    id: record.id,
    kind: record.kind,
    mode: record.mode,
    status: record.status,
    targetEnvironment: record.targetEnvironment,
    provider: record.provider,
    actorUserEmail: record.actorUserEmail,
    summary: record.summary,
    providerOperationId: record.providerOperationId,
    targetReference: record.targetReference,
    reportPath: record.reportPath,
    metadata:
      record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
        ? (record.metadata as Prisma.JsonObject)
        : null,
    completedAt: record.completedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    operationalIntegration: mapOperationalIntegration(record.operationalIntegration),
    proofArtifacts: record.proofArtifacts.map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind,
      label: artifact.label,
      filePath: artifact.filePath,
      sha256: artifact.sha256,
      sizeBytes: artifact.sizeBytes,
      metadata:
        artifact.metadata && typeof artifact.metadata === "object" && !Array.isArray(artifact.metadata)
          ? (artifact.metadata as Prisma.JsonObject)
          : null,
      createdAt: artifact.createdAt.toISOString()
    }))
  } satisfies AtlasOperationalExecutionRecord;
}

export async function createOperationalExecutionRecord(
  input: AtlasOperationalExecutionInput,
  client: DatabaseClient = prisma
) {
  const actorUserEmail = input.actorUserEmail.trim().toLowerCase();

  if (actorUserEmail.length < 5 || !actorUserEmail.includes("@")) {
    throw new AtlasRolloutExecutionWorkflowError("Rollout execution actor email is required.", "bad_request");
  }

  const created = await client.operationalExecution.create({
    data: {
      kind: input.kind,
      mode: input.mode === "command" ? "COMMAND" : "DRY_RUN",
      status: input.status,
      targetEnvironment: normalizeExecutionEnvironment(input.targetEnvironment),
      provider: input.provider,
      actorUserEmail,
      summary: input.summary,
      providerOperationId: input.providerOperationId ?? null,
      targetReference: input.targetReference ?? null,
      reportPath: input.reportPath ?? null,
      metadata: input.metadata ?? Prisma.JsonNull,
      completedAt: input.completedAt ? new Date(input.completedAt) : new Date(),
      operationalIntegrationId: input.operationalIntegration?.id ?? null,
      proofArtifacts: {
        create: (input.proofArtifacts ?? []).map((artifact) => {
          const manifest = createAtlasFileIntegrityManifest(artifact.filePath);

          return {
            kind: artifact.kind,
            label: artifact.label,
            filePath: manifest.filePath,
            sha256: manifest.sha256,
            sizeBytes: manifest.sizeBytes,
            metadata: artifact.metadata ?? Prisma.JsonNull
          };
        })
      }
    },
    include: {
      operationalIntegration: {
        select: {
          id: true,
          kind: true,
          targetEnvironment: true,
          provider: true,
          label: true,
          ownerEmail: true,
          endpointReference: true,
          secretReference: true,
          configReference: true,
          verificationStatus: true,
          lastVerifiedAt: true
        }
      },
      proofArtifacts: {
        orderBy: [
          {
            kind: "asc"
          },
          {
            label: "asc"
          }
        ]
      }
    }
  });

  return mapExecutionRecord(created);
}

export async function listOperationalExecutions(
  actor: AtlasActorContext,
  input: {
    kind?: AtlasOperationalExecutionRecord["kind"] | null;
    limit?: number;
  } = {},
  client: DatabaseClient = prisma
) {
  assertOperatorRolloutActor(actor);

  const executions = await client.operationalExecution.findMany({
    where: {
      kind: input.kind ?? undefined
    },
    include: {
      operationalIntegration: {
        select: {
          id: true,
          kind: true,
          targetEnvironment: true,
          provider: true,
          label: true,
          ownerEmail: true,
          endpointReference: true,
          secretReference: true,
          configReference: true,
          verificationStatus: true,
          lastVerifiedAt: true
        }
      },
      proofArtifacts: {
        orderBy: [
          {
            kind: "asc"
          },
          {
            label: "asc"
          }
        ]
      }
    },
    orderBy: {
      completedAt: "desc"
    },
    take: Math.min(Math.max(input.limit ?? 20, 1), 50)
  });

  return executions.map(mapExecutionRecord);
}

export async function getOperationalExecutionSummary(
  actor: AtlasActorContext,
  client: DatabaseClient = prisma
) {
  assertOperatorRolloutActor(actor);

  const [totalCount, commandCount, dryRunCount, failedCount, latest] = await Promise.all([
    client.operationalExecution.count(),
    client.operationalExecution.count({
      where: {
        mode: "COMMAND"
      }
    }),
    client.operationalExecution.count({
      where: {
        mode: "DRY_RUN"
      }
    }),
    client.operationalExecution.count({
      where: {
        status: "FAILED"
      }
    }),
    client.operationalExecution.findFirst({
      orderBy: {
        completedAt: "desc"
      },
      select: {
        completedAt: true
      }
    })
  ]);

  return {
    totalCount,
    commandCount,
    dryRunCount,
    failedCount,
    latestCompletedAt: latest?.completedAt.toISOString() ?? null
  } satisfies AtlasOperationalExecutionSummary;
}
