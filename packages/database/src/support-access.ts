import { canAtlasActorMutate, type AtlasActorContext } from "@atlas/auth";
import { authRuntime } from "@atlas/config";
import type { OrganizationKind } from "@atlas/types";
import { Prisma, type PrismaClient, type SupportAccessGrantStatus } from "./generated/client/index.js";
import { prisma } from "./client";

type SupportAccessReadClient = PrismaClient | Prisma.TransactionClient;

export class AtlasSupportAccessWorkflowError extends Error {
  constructor(
    message: string,
    readonly code: "bad_request" | "not_found" | "forbidden" | "conflict"
  ) {
    super(message);
    this.name = "AtlasSupportAccessWorkflowError";
  }
}

export type AtlasSupportAccessGrantRecord = {
  id: string;
  targetOrganizationId: string;
  targetOrganizationSlug: string;
  targetOrganizationName: string;
  targetWorkspace: OrganizationKind;
  issuedByUserEmail: string;
  issuedByOrganizationName: string;
  reason: string;
  status: SupportAccessGrantStatus;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
};

function assertOperatorActor(actor: AtlasActorContext) {
  if (actor.workspace !== "OPERATOR" || actor.organization.kind !== "OPERATOR") {
    throw new AtlasSupportAccessWorkflowError(
      "Support-access grants can only be managed from the operator workspace.",
      "forbidden"
    );
  }

  if (!canAtlasActorMutate(actor)) {
    throw new AtlasSupportAccessWorkflowError(
      "Support-access sessions cannot issue or revoke support-access grants.",
      "forbidden"
    );
  }
}

function assertReason(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length < 12) {
    throw new AtlasSupportAccessWorkflowError(
      `${label} must include enough detail for later audit review.`,
      "bad_request"
    );
  }

  return value.trim();
}

function mapSupportAccessGrantRecord(grant: {
  id: string;
  targetWorkspace: OrganizationKind;
  reason: string;
  status: SupportAccessGrantStatus;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  issuedByUser: { email: string };
  issuedByOrganization: { name: string };
  targetOrganization: { id: string; slug: string; name: string };
}) {
  return {
    id: grant.id,
    targetOrganizationId: grant.targetOrganization.id,
    targetOrganizationSlug: grant.targetOrganization.slug,
    targetOrganizationName: grant.targetOrganization.name,
    targetWorkspace: grant.targetWorkspace,
    issuedByUserEmail: grant.issuedByUser.email,
    issuedByOrganizationName: grant.issuedByOrganization.name,
    reason: grant.reason,
    status: grant.status,
    createdAt: grant.createdAt.toISOString(),
    expiresAt: grant.expiresAt.toISOString(),
    revokedAt: grant.revokedAt?.toISOString() ?? null,
    revokedReason: grant.revokedReason
  } satisfies AtlasSupportAccessGrantRecord;
}

async function createAuditEvent(
  client: SupportAccessReadClient,
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
      targetType: "support_access_grant",
      targetId: input.targetId,
      payload: input.payload
    }
  });
}

async function markExpiredGrantIfNeeded(grantId: string, client: SupportAccessReadClient = prisma) {
  const grant = await client.supportAccessGrant.findUnique({
    where: { id: grantId },
    include: {
      issuedByUser: true,
      issuedByOrganization: true,
      targetOrganization: true
    }
  });

  if (!grant) {
    return null;
  }

  if (grant.status === "ACTIVE" && grant.expiresAt.getTime() <= Date.now()) {
    const expiredGrant = await client.supportAccessGrant.update({
      where: { id: grant.id },
      data: {
        status: "EXPIRED"
      },
      include: {
        issuedByUser: true,
        issuedByOrganization: true,
        targetOrganization: true
      }
    });

    return expiredGrant;
  }

  return grant;
}

export async function issueSupportAccessGrant(
  actor: AtlasActorContext,
  input: {
    targetOrganizationSlug: string;
    targetWorkspace: OrganizationKind;
    reason: string;
    expiresAt: string;
  },
  client: PrismaClient = prisma
) {
  assertOperatorActor(actor);

  if (input.targetWorkspace !== "BUYER" && input.targetWorkspace !== "SELLER") {
    throw new AtlasSupportAccessWorkflowError(
      "Support-access grants can only target buyer or seller workspaces.",
      "bad_request"
    );
  }

  const reason = assertReason(input.reason, "Support-access reason");
  const expiresAt = new Date(input.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new AtlasSupportAccessWorkflowError("Support-access expiry must be in the future.", "bad_request");
  }

  const targetOrganization = await client.organization.findFirst({
    where: {
      slug: input.targetOrganizationSlug,
      kind: input.targetWorkspace
    }
  });

  if (!targetOrganization) {
    throw new AtlasSupportAccessWorkflowError("The selected support-access target could not be resolved.", "not_found");
  }

  const grant = await client.$transaction(async (transaction) => {
    const createdGrant = await transaction.supportAccessGrant.create({
      data: {
        issuedByUserId: actor.user.id,
        issuedByOrganizationId: actor.organization.id,
        targetOrganizationId: targetOrganization.id,
        targetWorkspace: input.targetWorkspace,
        authProviderMode: authRuntime.providerMode === "identity-bridge" ? "IDENTITY_BRIDGE" : "LOCAL_SIGNED",
        reason,
        expiresAt
      },
      include: {
        issuedByUser: true,
        issuedByOrganization: true,
        targetOrganization: true
      }
    });

    await createAuditEvent(transaction, actor, {
      eventType: "support_access.issued",
      targetId: createdGrant.id,
      payload: {
        targetOrganizationId: targetOrganization.id,
        targetOrganizationSlug: targetOrganization.slug,
        targetWorkspace: input.targetWorkspace,
        reason,
        expiresAt: createdGrant.expiresAt.toISOString()
      }
    });

    return createdGrant;
  });

  return mapSupportAccessGrantRecord(grant);
}

export async function listSupportAccessGrants(actor: AtlasActorContext, client: SupportAccessReadClient = prisma) {
  assertOperatorActor(actor);

  const grants = await client.supportAccessGrant.findMany({
    where: {
      issuedByOrganizationId: actor.organization.id
    },
    include: {
      issuedByUser: true,
      issuedByOrganization: true,
      targetOrganization: true
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 20
  });

  const normalizedGrants = await Promise.all(grants.map((grant) => markExpiredGrantIfNeeded(grant.id, client)));

  return normalizedGrants.filter((grant) => grant !== null).map(mapSupportAccessGrantRecord);
}

export async function revokeSupportAccessGrant(
  actor: AtlasActorContext,
  grantId: string,
  input: {
    revokeReason: string;
  },
  client: PrismaClient = prisma
) {
  assertOperatorActor(actor);
  const revokeReason = assertReason(input.revokeReason, "Revoke reason");

  const grant = await markExpiredGrantIfNeeded(grantId, client);
  if (!grant) {
    throw new AtlasSupportAccessWorkflowError("The selected support-access grant could not be found.", "not_found");
  }

  if (grant.issuedByOrganizationId !== actor.organization.id) {
    throw new AtlasSupportAccessWorkflowError(
      "Support-access grants can only be revoked by the issuing operator organization.",
      "forbidden"
    );
  }

  if (grant.status !== "ACTIVE") {
    throw new AtlasSupportAccessWorkflowError("Only active support-access grants can be revoked.", "conflict");
  }

  const revokedGrant = await client.$transaction(async (transaction) => {
    const updatedGrant = await transaction.supportAccessGrant.update({
      where: { id: grant.id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedReason: revokeReason,
        revokedByUserId: actor.user.id
      },
      include: {
        issuedByUser: true,
        issuedByOrganization: true,
        targetOrganization: true
      }
    });

    await createAuditEvent(transaction, actor, {
      eventType: "support_access.revoked",
      targetId: updatedGrant.id,
      payload: {
        targetOrganizationId: updatedGrant.targetOrganizationId,
        targetWorkspace: updatedGrant.targetWorkspace,
        revokeReason
      }
    });

    return updatedGrant;
  });

  return mapSupportAccessGrantRecord(revokedGrant);
}

export async function getSupportAccessGrantById(grantId: string, client: SupportAccessReadClient = prisma) {
  const grant = await markExpiredGrantIfNeeded(grantId, client);
  return grant ? mapSupportAccessGrantRecord(grant) : null;
}
