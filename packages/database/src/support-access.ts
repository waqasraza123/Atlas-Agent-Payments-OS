import {
  canAtlasActorMutate,
  type AtlasActorContext,
  type AtlasSupportAccessTargetWorkspace
} from "@atlas/auth";
import { authRuntime } from "@atlas/config";
import type { MembershipRole, OrganizationKind } from "@atlas/types";
import {
  Prisma,
  type PrismaClient,
  type SupportAccessGrantReviewDecision,
  type SupportAccessGrantStatus
} from "./generated/client/index.js";
import { prisma } from "./client";

type SupportAccessReadClient = PrismaClient | Prisma.TransactionClient;

type GrantWithRelations = Prisma.SupportAccessGrantGetPayload<{
  include: {
    issuedByUser: true;
    issuedByOrganization: true;
    targetOrganization: true;
    reviews: {
      include: {
        reviewerUser: true;
        reviewerOrganization: true;
      };
      orderBy: {
        createdAt: "desc";
      };
    };
  };
}>;

export class AtlasSupportAccessWorkflowError extends Error {
  constructor(
    message: string,
    readonly code: "bad_request" | "not_found" | "forbidden" | "conflict"
  ) {
    super(message);
    this.name = "AtlasSupportAccessWorkflowError";
  }
}

export type AtlasSupportAccessGrantReviewRecord = {
  id: string;
  decision: SupportAccessGrantReviewDecision;
  reason: string;
  reviewerUserEmail: string;
  reviewerOrganizationName: string;
  createdAt: string;
};

export type AtlasSupportAccessGrantRecord = {
  id: string;
  targetOrganizationId: string;
  targetOrganizationSlug: string;
  targetOrganizationName: string;
  targetWorkspace: AtlasSupportAccessTargetWorkspace;
  issuedByUserId: string;
  issuedByUserEmail: string;
  issuedByOrganizationId: string;
  issuedByOrganizationName: string;
  reason: string;
  status: SupportAccessGrantStatus;
  createdAt: string;
  expiresAt: string;
  lastActivatedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  latestReview: AtlasSupportAccessGrantReviewRecord | null;
  reviews: AtlasSupportAccessGrantReviewRecord[];
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
      "Support-access sessions cannot issue or review support-access grants.",
      "forbidden"
    );
  }
}

function assertReviewerRole(role: MembershipRole) {
  if (role !== "OWNER" && role !== "ADMIN") {
    throw new AtlasSupportAccessWorkflowError(
      "Only operator owners and admins can review support-access grants.",
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

function mapReviewRecord(review: {
  id: string;
  decision: SupportAccessGrantReviewDecision;
  reason: string;
  createdAt: Date;
  reviewerUser: { email: string };
  reviewerOrganization: { name: string };
}) {
  return {
    id: review.id,
    decision: review.decision,
    reason: review.reason,
    reviewerUserEmail: review.reviewerUser.email,
    reviewerOrganizationName: review.reviewerOrganization.name,
    createdAt: review.createdAt.toISOString()
  } satisfies AtlasSupportAccessGrantReviewRecord;
}

function mapSupportAccessGrantRecord(grant: GrantWithRelations) {
  const reviews = grant.reviews.map(mapReviewRecord);

  return {
    id: grant.id,
    targetOrganizationId: grant.targetOrganization.id,
    targetOrganizationSlug: grant.targetOrganization.slug,
    targetOrganizationName: grant.targetOrganization.name,
    targetWorkspace: grant.targetWorkspace as AtlasSupportAccessTargetWorkspace,
    issuedByUserId: grant.issuedByUser.id,
    issuedByUserEmail: grant.issuedByUser.email,
    issuedByOrganizationId: grant.issuedByOrganization.id,
    issuedByOrganizationName: grant.issuedByOrganization.name,
    reason: grant.reason,
    status: grant.status,
    createdAt: grant.createdAt.toISOString(),
    expiresAt: grant.expiresAt.toISOString(),
    lastActivatedAt: grant.lastActivatedAt?.toISOString() ?? null,
    revokedAt: grant.revokedAt?.toISOString() ?? null,
    revokedReason: grant.revokedReason,
    latestReview: reviews[0] ?? null,
    reviews
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

async function loadGrant(grantId: string, client: SupportAccessReadClient) {
  return client.supportAccessGrant.findUnique({
    where: {
      id: grantId
    },
    include: {
      issuedByUser: true,
      issuedByOrganization: true,
      targetOrganization: true,
      reviews: {
        include: {
          reviewerUser: true,
          reviewerOrganization: true
        },
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });
}

async function markExpiredGrantIfNeeded(grantId: string, client: SupportAccessReadClient = prisma) {
  const grant = await loadGrant(grantId, client);

  if (!grant) {
    return null;
  }

  if ((grant.status === "ACTIVE" || grant.status === "PENDING_REVIEW") && grant.expiresAt.getTime() <= Date.now()) {
    return client.supportAccessGrant.update({
      where: {
        id: grant.id
      },
      data: {
        status: "EXPIRED"
      },
      include: {
        issuedByUser: true,
        issuedByOrganization: true,
        targetOrganization: true,
        reviews: {
          include: {
            reviewerUser: true,
            reviewerOrganization: true
          },
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });
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
        expiresAt,
        status: "PENDING_REVIEW"
      },
      include: {
        issuedByUser: true,
        issuedByOrganization: true,
        targetOrganization: true,
        reviews: {
          include: {
            reviewerUser: true,
            reviewerOrganization: true
          },
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });

    await createAuditEvent(transaction, actor, {
      eventType: "support_access.requested",
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

export async function reviewSupportAccessGrant(
  actor: AtlasActorContext,
  grantId: string,
  input: {
    decision: SupportAccessGrantReviewDecision;
    reviewReason: string;
  },
  client: PrismaClient = prisma
) {
  assertOperatorActor(actor);
  assertReviewerRole(actor.membership.role);

  const reviewReason = assertReason(input.reviewReason, "Support-access review reason");
  if (input.decision !== "APPROVED" && input.decision !== "REJECTED") {
    throw new AtlasSupportAccessWorkflowError("Unsupported support-access review decision.", "bad_request");
  }

  const grant = await markExpiredGrantIfNeeded(grantId, client);
  if (!grant) {
    throw new AtlasSupportAccessWorkflowError("The selected support-access grant could not be found.", "not_found");
  }

  if (grant.issuedByOrganizationId !== actor.organization.id) {
    throw new AtlasSupportAccessWorkflowError(
      "Support-access grants can only be reviewed inside the issuing operator organization.",
      "forbidden"
    );
  }

  if (grant.issuedByUserId === actor.user.id) {
    throw new AtlasSupportAccessWorkflowError(
      "Operators cannot review support-access grants that they requested themselves.",
      "forbidden"
    );
  }

  if (grant.status !== "PENDING_REVIEW") {
    throw new AtlasSupportAccessWorkflowError("Only pending support-access grants can be reviewed.", "conflict");
  }

  const reviewedGrant = await client.$transaction(async (transaction) => {
    await transaction.supportAccessGrantReview.create({
      data: {
        supportAccessGrantId: grant.id,
        reviewerUserId: actor.user.id,
        reviewerOrganizationId: actor.organization.id,
        decision: input.decision,
        reason: reviewReason
      }
    });

    const updatedGrant = await transaction.supportAccessGrant.update({
      where: {
        id: grant.id
      },
      data: {
        status: input.decision === "APPROVED" ? "ACTIVE" : "REJECTED"
      },
      include: {
        issuedByUser: true,
        issuedByOrganization: true,
        targetOrganization: true,
        reviews: {
          include: {
            reviewerUser: true,
            reviewerOrganization: true
          },
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });

    await createAuditEvent(transaction, actor, {
      eventType: "support_access.reviewed",
      targetId: updatedGrant.id,
      payload: {
        decision: input.decision,
        reviewReason,
        targetOrganizationId: updatedGrant.targetOrganizationId,
        targetWorkspace: updatedGrant.targetWorkspace
      }
    });

    return updatedGrant;
  });

  return mapSupportAccessGrantRecord(reviewedGrant);
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
      targetOrganization: true,
      reviews: {
        include: {
          reviewerUser: true,
          reviewerOrganization: true
        },
        orderBy: {
          createdAt: "desc"
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 40
  });

  const normalizedGrants = await Promise.all(grants.map((grant) => markExpiredGrantIfNeeded(grant.id, client)));

  return normalizedGrants.filter((grant) => grant !== null).map(mapSupportAccessGrantRecord);
}

export async function activateSupportAccessGrant(
  actor: AtlasActorContext,
  grantId: string,
  client: PrismaClient = prisma
) {
  assertOperatorActor(actor);

  const grant = await markExpiredGrantIfNeeded(grantId, client);
  if (!grant) {
    throw new AtlasSupportAccessWorkflowError("The selected support-access grant could not be found.", "not_found");
  }

  if (grant.issuedByOrganizationId !== actor.organization.id || grant.issuedByUserId !== actor.user.id) {
    throw new AtlasSupportAccessWorkflowError(
      "Support-access sessions can only be activated by the operator who requested the approved grant.",
      "forbidden"
    );
  }

  if (grant.status !== "ACTIVE") {
    throw new AtlasSupportAccessWorkflowError(
      "Only approved support-access grants can be activated into support mode.",
      "conflict"
    );
  }

  const activatedGrant = await client.$transaction(async (transaction) => {
    const updatedGrant = await transaction.supportAccessGrant.update({
      where: {
        id: grant.id
      },
      data: {
        lastActivatedAt: new Date()
      },
      include: {
        issuedByUser: true,
        issuedByOrganization: true,
        targetOrganization: true,
        reviews: {
          include: {
            reviewerUser: true,
            reviewerOrganization: true
          },
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });

    await createAuditEvent(transaction, actor, {
      eventType: "support_access.session_started",
      targetId: updatedGrant.id,
      payload: {
        targetOrganizationId: updatedGrant.targetOrganizationId,
        targetWorkspace: updatedGrant.targetWorkspace
      }
    });

    return updatedGrant;
  });

  return mapSupportAccessGrantRecord(activatedGrant);
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

  if (grant.status !== "ACTIVE" && grant.status !== "PENDING_REVIEW") {
    throw new AtlasSupportAccessWorkflowError("Only active or pending support-access grants can be revoked.", "conflict");
  }

  const revokedGrant = await client.$transaction(async (transaction) => {
    const updatedGrant = await transaction.supportAccessGrant.update({
      where: {
        id: grant.id
      },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedReason: revokeReason,
        revokedByUserId: actor.user.id
      },
      include: {
        issuedByUser: true,
        issuedByOrganization: true,
        targetOrganization: true,
        reviews: {
          include: {
            reviewerUser: true,
            reviewerOrganization: true
          },
          orderBy: {
            createdAt: "desc"
          }
        }
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
