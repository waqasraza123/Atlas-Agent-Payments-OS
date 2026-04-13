import { canAtlasActorMutate, type AtlasActorContext } from "@atlas/auth";
import { Prisma, type OperationalIntegrationKind, type OperationalIntegrationStatus, type OperationalIntegrationVerificationStatus, type OperationalTargetEnvironment, type PrismaClient } from "./generated/client/index.js";
import { prisma } from "./client";
import { assertAtlasOperatorSessionGovernance } from "./operator-session-governance";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export class AtlasOperationalIntegrationWorkflowError extends Error {
  constructor(
    message: string,
    readonly code: "bad_request" | "not_found" | "forbidden" | "conflict"
  ) {
    super(message);
    this.name = "AtlasOperationalIntegrationWorkflowError";
  }
}

export type AtlasOperationalIntegrationRecord = {
  id: string;
  kind: OperationalIntegrationKind;
  targetEnvironment: OperationalTargetEnvironment;
  provider: string;
  label: string;
  ownerEmail: string;
  endpointReference: string | null;
  secretReference: string | null;
  configReference: string | null;
  status: OperationalIntegrationStatus;
  verificationStatus: OperationalIntegrationVerificationStatus;
  verificationReason: string | null;
  statusReason: string | null;
  metadata: Prisma.JsonObject | null;
  lastVerifiedAt: string | null;
  lastUsedAt: string | null;
  createdByUserEmail: string;
  updatedByUserEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

function assertOperatorGovernanceActor(actor: AtlasActorContext) {
  if (actor.workspace !== "OPERATOR" || actor.organization.kind !== "OPERATOR") {
    throw new AtlasOperationalIntegrationWorkflowError(
      "Operational integrations can only be managed from the operator workspace.",
      "forbidden"
    );
  }

  if (!canAtlasActorMutate(actor)) {
    throw new AtlasOperationalIntegrationWorkflowError(
      "Support-access sessions cannot manage operational integrations.",
      "forbidden"
    );
  }

  if (actor.membership.role !== "OWNER" && actor.membership.role !== "ADMIN") {
    throw new AtlasOperationalIntegrationWorkflowError(
      "Only operator owners and admins can manage operational integrations.",
      "forbidden"
    );
  }

  assertAtlasOperatorSessionGovernance(actor, {
    surface: "Operational integration governance actions",
    createError: (message) => new AtlasOperationalIntegrationWorkflowError(message, "forbidden")
  });
}

function normalizeRequiredText(value: unknown, label: string, minimumLength = 2) {
  if (typeof value !== "string" || value.trim().length < minimumLength) {
    throw new AtlasOperationalIntegrationWorkflowError(`${label} is required.`, "bad_request");
  }

  return value.trim();
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeEmail(value: unknown, label: string) {
  const email = normalizeRequiredText(value, label, 5).toLowerCase();

  if (!email.includes("@")) {
    throw new AtlasOperationalIntegrationWorkflowError(`${label} must be a valid email address.`, "bad_request");
  }

  return email;
}

function normalizeReason(value: unknown, label: string) {
  return normalizeRequiredText(value, label, 12);
}

function normalizeIntegrationKind(value: unknown): OperationalIntegrationKind {
  if (
    value === "UPSTREAM_IDENTITY" ||
    value === "RESTORE_DRILL" ||
    value === "SECRET_ROTATION" ||
    value === "DEPLOYMENT_AUTOMATION" ||
    value === "PROOF_STORAGE" ||
    value === "ALERT_DISPATCH"
  ) {
    return value;
  }

  throw new AtlasOperationalIntegrationWorkflowError("Operational integration kind is invalid.", "bad_request");
}

function normalizeTargetEnvironment(value: unknown): OperationalTargetEnvironment {
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

  throw new AtlasOperationalIntegrationWorkflowError("Operational integration environment is invalid.", "bad_request");
}

function normalizeVerificationStatus(value: unknown): OperationalIntegrationVerificationStatus {
  if (value === "PENDING" || value === "VERIFIED" || value === "STALE" || value === "FAILED") {
    return value;
  }

  throw new AtlasOperationalIntegrationWorkflowError("Operational integration verification status is invalid.", "bad_request");
}

function mapRecord(
  integration: {
    id: string;
    kind: OperationalIntegrationKind;
    targetEnvironment: OperationalTargetEnvironment;
    provider: string;
    label: string;
    ownerEmail: string;
    endpointReference: string | null;
    secretReference: string | null;
    configReference: string | null;
    status: OperationalIntegrationStatus;
    verificationStatus: OperationalIntegrationVerificationStatus;
    verificationReason: string | null;
    statusReason: string | null;
    metadata: Prisma.JsonValue | null;
    lastVerifiedAt: Date | null;
    lastUsedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    createdByUser?: {
      email: string;
    } | null;
    updatedByUser?: {
      email: string;
    } | null;
  }
) {
  return {
    id: integration.id,
    kind: integration.kind,
    targetEnvironment: integration.targetEnvironment,
    provider: integration.provider,
    label: integration.label,
    ownerEmail: integration.ownerEmail,
    endpointReference: integration.endpointReference,
    secretReference: integration.secretReference,
    configReference: integration.configReference,
    status: integration.status,
    verificationStatus: integration.verificationStatus,
    verificationReason: integration.verificationReason,
    statusReason: integration.statusReason,
    metadata:
      integration.metadata && typeof integration.metadata === "object" && !Array.isArray(integration.metadata)
        ? (integration.metadata as Prisma.JsonObject)
        : null,
    lastVerifiedAt: integration.lastVerifiedAt?.toISOString() ?? null,
    lastUsedAt: integration.lastUsedAt?.toISOString() ?? null,
    createdByUserEmail: integration.createdByUser?.email ?? "unknown@atlas.local",
    updatedByUserEmail: integration.updatedByUser?.email ?? null,
    createdAt: integration.createdAt.toISOString(),
    updatedAt: integration.updatedAt.toISOString()
  } satisfies AtlasOperationalIntegrationRecord;
}

async function createAuditEvent(
  client: DatabaseClient,
  actor: AtlasActorContext,
  input: {
    eventType: string;
    targetId: string;
    payload: Prisma.JsonObject;
  }
) {
  await client.auditEvent.create({
    data: {
      organizationId: actor.organization.id,
      userId: actor.user.id,
      actorType: "HUMAN",
      eventType: input.eventType,
      targetType: "operational_integration",
      targetId: input.targetId,
      payload: input.payload
    }
  });
}

async function loadIntegration(
  integrationId: string,
  client: DatabaseClient
) {
  return client.operationalIntegration.findUnique({
    where: {
      id: integrationId
    },
    include: {
      createdByUser: {
        select: {
          email: true
        }
      },
      updatedByUser: {
        select: {
          email: true
        }
      }
    }
  });
}

export async function listOperationalIntegrations(actor: AtlasActorContext, client: DatabaseClient = prisma) {
  assertOperatorGovernanceActor(actor);

  const integrations = await client.operationalIntegration.findMany({
    include: {
      createdByUser: {
        select: {
          email: true
        }
      },
      updatedByUser: {
        select: {
          email: true
        }
      }
    },
    orderBy: [
      {
        targetEnvironment: "asc"
      },
      {
        kind: "asc"
      },
      {
        provider: "asc"
      },
      {
        label: "asc"
      }
    ]
  });

  return integrations.map(mapRecord);
}

export async function registerOperationalIntegration(
  actor: AtlasActorContext,
  input: {
    kind: OperationalIntegrationKind | string;
    targetEnvironment: OperationalTargetEnvironment | string;
    provider: string;
    label: string;
    ownerEmail: string;
    endpointReference?: string | null;
    secretReference?: string | null;
    configReference?: string | null;
    metadata?: Prisma.JsonObject | null;
  },
  client: DatabaseClient = prisma
) {
  assertOperatorGovernanceActor(actor);

  const kind = normalizeIntegrationKind(input.kind);
  const targetEnvironment = normalizeTargetEnvironment(input.targetEnvironment);
  const provider = normalizeRequiredText(input.provider, "Operational integration provider");
  const label = normalizeRequiredText(input.label, "Operational integration label", 3);
  const ownerEmail = normalizeEmail(input.ownerEmail, "Operational integration owner email");
  const endpointReference = normalizeOptionalText(input.endpointReference);
  const secretReference = normalizeOptionalText(input.secretReference);
  const configReference = normalizeOptionalText(input.configReference);

  try {
    const integration = await client.operationalIntegration.create({
      data: {
        kind,
        targetEnvironment,
        provider,
        label,
        ownerEmail,
        endpointReference,
        secretReference,
        configReference,
        metadata: input.metadata ?? Prisma.JsonNull,
        createdByUserId: actor.user.id
      },
      include: {
        createdByUser: {
          select: {
            email: true
          }
        },
        updatedByUser: {
          select: {
            email: true
          }
        }
      }
    });

    await createAuditEvent(client, actor, {
      eventType: "operational_integration_registered",
      targetId: integration.id,
      payload: {
        kind,
        targetEnvironment,
        provider,
        label,
        ownerEmail
      }
    });

    return mapRecord(integration);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AtlasOperationalIntegrationWorkflowError(
        "An operational integration with the same kind, environment, provider, and label already exists.",
        "conflict"
      );
    }

    throw error;
  }
}

export async function updateOperationalIntegrationLifecycle(
  actor: AtlasActorContext,
  integrationId: string,
  input: {
    action: "SUSPEND" | "REACTIVATE" | "REVOKE";
    reason: string;
  },
  client: DatabaseClient = prisma
) {
  assertOperatorGovernanceActor(actor);

  const integration = await loadIntegration(integrationId, client);

  if (!integration) {
    throw new AtlasOperationalIntegrationWorkflowError("Operational integration was not found.", "not_found");
  }

  const reason = normalizeReason(input.reason, "Operational integration lifecycle reason");
  const status: OperationalIntegrationStatus =
    input.action === "SUSPEND" ? "SUSPENDED" : input.action === "REACTIVATE" ? "ACTIVE" : "REVOKED";

  const updated = await client.operationalIntegration.update({
    where: {
      id: integrationId
    },
    data: {
      status,
      statusReason: reason,
      updatedByUserId: actor.user.id
    },
    include: {
      createdByUser: {
        select: {
          email: true
        }
      },
      updatedByUser: {
        select: {
          email: true
        }
      }
    }
  });

  await createAuditEvent(client, actor, {
    eventType: "operational_integration_lifecycle_updated",
    targetId: integrationId,
    payload: {
      action: input.action,
      status,
      reason
    }
  });

  return mapRecord(updated);
}

export async function updateOperationalIntegrationVerification(
  actor: AtlasActorContext,
  integrationId: string,
  input: {
    verificationStatus: OperationalIntegrationVerificationStatus | string;
    verificationReason: string;
  },
  client: DatabaseClient = prisma
) {
  assertOperatorGovernanceActor(actor);

  const integration = await loadIntegration(integrationId, client);

  if (!integration) {
    throw new AtlasOperationalIntegrationWorkflowError("Operational integration was not found.", "not_found");
  }

  const verificationStatus = normalizeVerificationStatus(input.verificationStatus);
  const verificationReason = normalizeReason(input.verificationReason, "Operational integration verification reason");

  const updated = await client.operationalIntegration.update({
    where: {
      id: integrationId
    },
    data: {
      verificationStatus,
      verificationReason,
      lastVerifiedAt: verificationStatus === "VERIFIED" ? new Date() : integration.lastVerifiedAt,
      updatedByUserId: actor.user.id
    },
    include: {
      createdByUser: {
        select: {
          email: true
        }
      },
      updatedByUser: {
        select: {
          email: true
        }
      }
    }
  });

  await createAuditEvent(client, actor, {
    eventType: "operational_integration_verification_updated",
    targetId: integrationId,
    payload: {
      verificationStatus,
      verificationReason
    }
  });

  return mapRecord(updated);
}

export async function resolveOperationalIntegrationForExecution(
  input: {
    kind: OperationalIntegrationKind | string;
    targetEnvironment: OperationalTargetEnvironment | string;
    provider: string;
  },
  client: DatabaseClient = prisma
) {
  const kind = normalizeIntegrationKind(input.kind);
  const targetEnvironment = normalizeTargetEnvironment(input.targetEnvironment);
  const provider = normalizeRequiredText(input.provider, "Operational integration provider");
  const matches = await client.operationalIntegration.findMany({
    where: {
      kind,
      targetEnvironment,
      provider,
      status: "ACTIVE",
      verificationStatus: "VERIFIED"
    },
    include: {
      createdByUser: {
        select: {
          email: true
        }
      },
      updatedByUser: {
        select: {
          email: true
        }
      }
    }
  });

  if (matches.length === 0) {
    throw new AtlasOperationalIntegrationWorkflowError(
      `No active verified operational integration exists for ${kind.toLowerCase().replaceAll("_", " ")} in ${targetEnvironment.toLowerCase()}.`,
      "conflict"
    );
  }

  if (matches.length > 1) {
    throw new AtlasOperationalIntegrationWorkflowError(
      `Multiple active verified operational integrations exist for ${kind.toLowerCase().replaceAll("_", " ")} in ${targetEnvironment.toLowerCase()}.`,
      "conflict"
    );
  }

  return mapRecord(matches[0]);
}

export async function touchOperationalIntegrationUsage(integrationId: string, client: DatabaseClient = prisma) {
  await client.operationalIntegration.update({
    where: {
      id: integrationId
    },
    data: {
      lastUsedAt: new Date()
    }
  });
}
