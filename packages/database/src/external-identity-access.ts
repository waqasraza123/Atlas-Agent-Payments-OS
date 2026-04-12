import { canAtlasActorMutate, type AtlasActorContext } from "@atlas/auth";
import type { MembershipRole, OrganizationKind } from "@atlas/types";
import {
  Prisma,
  type ExternalIdentityAssignmentStatus,
  type PrismaClient
} from "./generated/client/index.js";
import { prisma } from "./client";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;
type AtlasExternalIdentityAssignmentAction = "SUSPEND" | "REACTIVATE" | "REVOKE";

export class AtlasExternalIdentityAccessWorkflowError extends Error {
  constructor(
    message: string,
    readonly code: "bad_request" | "not_found" | "forbidden" | "conflict"
  ) {
    super(message);
    this.name = "AtlasExternalIdentityAccessWorkflowError";
  }
}

export type AtlasExternalIdentityAssignmentRecord = {
  id: string;
  provider: string;
  externalEmail: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  workspace: OrganizationKind;
  membershipId: string;
  role: MembershipRole;
  status: ExternalIdentityAssignmentStatus;
  statusReason: string | null;
  provisionedAt: string;
  lastExchangedAt: string | null;
  statusChangedAt: string | null;
  provisionedByUserEmail: string;
  statusChangedByUserEmail: string | null;
  activeSessionCount: number;
};

function assertGovernanceActor(actor: AtlasActorContext) {
  if (actor.workspace !== "OPERATOR" || actor.organization.kind !== "OPERATOR") {
    throw new AtlasExternalIdentityAccessWorkflowError(
      "External identity access can only be managed from the operator workspace.",
      "forbidden"
    );
  }

  if (!canAtlasActorMutate(actor)) {
    throw new AtlasExternalIdentityAccessWorkflowError(
      "Support-access sessions cannot manage external identity access.",
      "forbidden"
    );
  }

  if (actor.membership.role !== "OWNER" && actor.membership.role !== "ADMIN") {
    throw new AtlasExternalIdentityAccessWorkflowError(
      "Only operator owners and admins can manage external identity access.",
      "forbidden"
    );
  }
}

function normalizeProvider(value: unknown) {
  if (typeof value !== "string" || value.trim().length < 2) {
    throw new AtlasExternalIdentityAccessWorkflowError(
      "External identity provider must be a non-empty provider label.",
      "bad_request"
    );
  }

  return value.trim();
}

function normalizeEmail(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length < 5 || !value.includes("@")) {
    throw new AtlasExternalIdentityAccessWorkflowError(`${label} must be a valid email address.`, "bad_request");
  }

  return value.trim().toLowerCase();
}

function normalizeName(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeReason(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length < 12) {
    throw new AtlasExternalIdentityAccessWorkflowError(
      `${label} must include enough detail for later audit review.`,
      "bad_request"
    );
  }

  return value.trim();
}

function normalizeRole(value: unknown): MembershipRole {
  if (value !== "OWNER" && value !== "ADMIN" && value !== "OPERATOR" && value !== "REVIEWER" && value !== "FINANCE") {
    throw new AtlasExternalIdentityAccessWorkflowError("Target role is not valid for Atlas memberships.", "bad_request");
  }

  return value;
}

function normalizeOrganizationSlug(value: unknown) {
  if (typeof value !== "string" || value.trim().length < 3) {
    throw new AtlasExternalIdentityAccessWorkflowError("Target organization slug is required.", "bad_request");
  }

  return value.trim();
}

function mapAssignmentRecord(
  assignment: {
    id: string;
    provider: string;
    externalEmail: string;
    status: ExternalIdentityAssignmentStatus;
    statusReason: string | null;
    provisionedAt: Date;
    lastExchangedAt: Date | null;
    statusChangedAt: Date | null;
    user: {
      id: string;
      email: string;
      name: string | null;
    };
    organization: {
      id: string;
      slug: string;
      name: string;
      kind: OrganizationKind;
    };
    membership: {
      id: string;
      role: MembershipRole;
    };
    provisionedByUser: {
      email: string;
    };
    statusChangedByUser: {
      email: string;
    } | null;
    activeSessionCount: number;
  }
) {
  return {
    id: assignment.id,
    provider: assignment.provider,
    externalEmail: assignment.externalEmail,
    userId: assignment.user.id,
    userEmail: assignment.user.email,
    userName: assignment.user.name,
    organizationId: assignment.organization.id,
    organizationSlug: assignment.organization.slug,
    organizationName: assignment.organization.name,
    workspace: assignment.organization.kind,
    membershipId: assignment.membership.id,
    role: assignment.membership.role,
    status: assignment.status,
    statusReason: assignment.statusReason,
    provisionedAt: assignment.provisionedAt.toISOString(),
    lastExchangedAt: assignment.lastExchangedAt?.toISOString() ?? null,
    statusChangedAt: assignment.statusChangedAt?.toISOString() ?? null,
    provisionedByUserEmail: assignment.provisionedByUser.email,
    statusChangedByUserEmail: assignment.statusChangedByUser?.email ?? null,
    activeSessionCount: assignment.activeSessionCount
  } satisfies AtlasExternalIdentityAssignmentRecord;
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
      targetType: "external_identity_assignment",
      targetId: input.targetId,
      payload: input.payload
    }
  });
}

async function loadAssignmentWithRelations(assignmentId: string, client: DatabaseClient) {
  return client.externalIdentityAssignment.findUnique({
    where: {
      id: assignmentId
    },
    include: {
      user: true,
      organization: true,
      membership: true,
      provisionedByUser: {
        select: {
          email: true
        }
      },
      statusChangedByUser: {
        select: {
          email: true
        }
      }
    }
  });
}

async function countActiveSessionsForAssignments(
  assignments: Array<{
    provider: string;
    membershipId: string;
  }>,
  client: DatabaseClient
) {
  const counts = new Map<string, number>();
  if (assignments.length === 0) {
    return counts;
  }

  const activeSessions = await client.authSession.findMany({
    where: {
      source: "IDENTITY_PROVIDER",
      revokedAt: null,
      expiresAt: {
        gt: new Date()
      },
      OR: assignments.map((assignment) => ({
        provider: assignment.provider,
        membershipId: assignment.membershipId
      }))
    },
    select: {
      provider: true,
      membershipId: true
    }
  });

  for (const session of activeSessions) {
    const key = `${session.provider ?? ""}:${session.membershipId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

async function revokeActiveIdentitySessions(
  client: DatabaseClient,
  actor: AtlasActorContext,
  assignment: {
    id: string;
    provider: string;
    membershipId: string;
  },
  reason: string,
  action: AtlasExternalIdentityAssignmentAction
) {
  const sessions = await client.authSession.findMany({
    where: {
      source: "IDENTITY_PROVIDER",
      provider: assignment.provider,
      membershipId: assignment.membershipId,
      revokedAt: null,
      expiresAt: {
        gt: new Date()
      }
    },
    select: {
      id: true,
      metadata: true
    }
  });

  for (const session of sessions) {
    const metadata =
      session.metadata && typeof session.metadata === "object" && !Array.isArray(session.metadata)
        ? (session.metadata as Prisma.JsonObject)
        : {};

    await client.authSession.update({
      where: {
        id: session.id
      },
      data: {
        revokedAt: new Date(),
        metadata: {
          ...metadata,
          revokedByUserId: actor.user.id,
          revokeReason: reason,
          externalIdentityAssignmentId: assignment.id,
          externalIdentityAction: action
        }
      }
    });
  }

  return sessions.length;
}

export async function listExternalIdentityAssignments(
  actor: AtlasActorContext,
  client: DatabaseClient = prisma
) {
  assertGovernanceActor(actor);
  const assignments = await client.externalIdentityAssignment.findMany({
    where: {
      organization: {
        kind: {
          in: ["BUYER", "SELLER"]
        }
      }
    },
    include: {
      user: true,
      organization: true,
      membership: true,
      provisionedByUser: {
        select: {
          email: true
        }
      },
      statusChangedByUser: {
        select: {
          email: true
        }
      }
    },
    orderBy: [
      {
        status: "asc"
      },
      {
        updatedAt: "desc"
      }
    ]
  });

  const activeSessionCounts = await countActiveSessionsForAssignments(
    assignments.map((assignment) => ({
      provider: assignment.provider,
      membershipId: assignment.membershipId
    })),
    client
  );

  return assignments.map((assignment) =>
    mapAssignmentRecord({
      ...assignment,
      activeSessionCount: activeSessionCounts.get(`${assignment.provider}:${assignment.membershipId}`) ?? 0
    })
  );
}

export async function provisionExternalIdentityAssignment(
  actor: AtlasActorContext,
  input: {
    provider: string;
    externalEmail: string;
    targetOrganizationSlug: string;
    targetRole: MembershipRole;
    userName?: string | null;
    reason: string;
  },
  client: PrismaClient = prisma
) {
  assertGovernanceActor(actor);
  const provider = normalizeProvider(input.provider);
  const externalEmail = normalizeEmail(input.externalEmail, "External identity email");
  const targetOrganizationSlug = normalizeOrganizationSlug(input.targetOrganizationSlug);
  const targetRole = normalizeRole(input.targetRole);
  const userName = normalizeName(input.userName);
  const reason = normalizeReason(input.reason, "Provision reason");

  return client.$transaction(async (transaction) => {
    const organization = await transaction.organization.findUnique({
      where: {
        slug: targetOrganizationSlug
      }
    });

    if (!organization || (organization.kind !== "BUYER" && organization.kind !== "SELLER")) {
      throw new AtlasExternalIdentityAccessWorkflowError(
        "External identity assignments can only target buyer or seller organizations.",
        "not_found"
      );
    }

    const user =
      (await transaction.user.findUnique({
        where: {
          email: externalEmail
        }
      })) ??
      (await transaction.user.create({
        data: {
          email: externalEmail,
          name: userName
        }
      }));

    if (userName && user.name !== userName) {
      await transaction.user.update({
        where: {
          id: user.id
        },
        data: {
          name: userName
        }
      });
    }

    const membership =
      (await transaction.membership.findFirst({
        where: {
          userId: user.id,
          organizationId: organization.id,
          role: targetRole
        }
      })) ??
      (await transaction.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: targetRole
        }
      }));

    const existingAssignment = await transaction.externalIdentityAssignment.findUnique({
      where: {
        provider_externalEmail_membershipId: {
          provider,
          externalEmail,
          membershipId: membership.id
        }
      },
      include: {
        user: true,
        organization: true,
        membership: true,
        provisionedByUser: {
          select: {
            email: true
          }
        },
        statusChangedByUser: {
          select: {
            email: true
          }
        }
      }
    });

    if (existingAssignment?.status === "ACTIVE") {
      throw new AtlasExternalIdentityAccessWorkflowError(
        "An active external identity assignment already exists for this provider, email, and membership.",
        "conflict"
      );
    }

    const assignment =
      existingAssignment
        ? await transaction.externalIdentityAssignment.update({
            where: {
              id: existingAssignment.id
            },
            data: {
              userId: user.id,
              organizationId: organization.id,
              membershipId: membership.id,
              status: "ACTIVE",
              statusReason: reason,
              statusChangedAt: new Date(),
              statusChangedByUserId: actor.user.id,
              metadata: {
                userName
              }
            },
            include: {
              user: true,
              organization: true,
              membership: true,
              provisionedByUser: {
                select: {
                  email: true
                }
              },
              statusChangedByUser: {
                select: {
                  email: true
                }
              }
            }
          })
        : await transaction.externalIdentityAssignment.create({
            data: {
              provider,
              externalEmail,
              userId: user.id,
              organizationId: organization.id,
              membershipId: membership.id,
              status: "ACTIVE",
              statusReason: reason,
              metadata: {
                userName
              },
              provisionedByUserId: actor.user.id,
              statusChangedByUserId: actor.user.id,
              statusChangedAt: new Date()
            },
            include: {
              user: true,
              organization: true,
              membership: true,
              provisionedByUser: {
                select: {
                  email: true
                }
              },
              statusChangedByUser: {
                select: {
                  email: true
                }
              }
            }
          });

    await createAuditEvent(transaction, actor, {
      eventType: existingAssignment ? "external_identity_assignment.reactivated" : "external_identity_assignment.provisioned",
      targetId: assignment.id,
      payload: {
        provider,
        externalEmail,
        organizationSlug: organization.slug,
        organizationKind: organization.kind,
        membershipId: membership.id,
        role: membership.role,
        reason
      }
    });

    return mapAssignmentRecord({
      ...assignment,
      activeSessionCount: 0
    });
  });
}

export async function updateExternalIdentityAssignmentLifecycle(
  actor: AtlasActorContext,
  assignmentId: string,
  input: {
    action: AtlasExternalIdentityAssignmentAction;
    reason: string;
  },
  client: PrismaClient = prisma
) {
  assertGovernanceActor(actor);
  const reason = normalizeReason(input.reason, "Lifecycle reason");

  return client.$transaction(async (transaction) => {
    const assignment = await loadAssignmentWithRelations(assignmentId, transaction);

    if (!assignment) {
      throw new AtlasExternalIdentityAccessWorkflowError("External identity assignment was not found.", "not_found");
    }

    if (assignment.organization.kind !== "BUYER" && assignment.organization.kind !== "SELLER") {
      throw new AtlasExternalIdentityAccessWorkflowError(
        "External identity assignments can only target buyer or seller organizations.",
        "forbidden"
      );
    }

    if (input.action === "SUSPEND" && assignment.status !== "ACTIVE") {
      throw new AtlasExternalIdentityAccessWorkflowError("Only active assignments can be suspended.", "conflict");
    }

    if (input.action === "REACTIVATE" && assignment.status !== "SUSPENDED") {
      throw new AtlasExternalIdentityAccessWorkflowError("Only suspended assignments can be reactivated.", "conflict");
    }

    if (input.action === "REVOKE" && assignment.status === "REVOKED") {
      throw new AtlasExternalIdentityAccessWorkflowError("External identity assignment is already revoked.", "conflict");
    }

    const nextStatus =
      input.action === "SUSPEND"
        ? "SUSPENDED"
        : input.action === "REACTIVATE"
          ? "ACTIVE"
          : "REVOKED";

    const updatedAssignment = await transaction.externalIdentityAssignment.update({
      where: {
        id: assignment.id
      },
      data: {
        status: nextStatus,
        statusReason: reason,
        statusChangedAt: new Date(),
        statusChangedByUserId: actor.user.id
      },
      include: {
        user: true,
        organization: true,
        membership: true,
        provisionedByUser: {
          select: {
            email: true
          }
        },
        statusChangedByUser: {
          select: {
            email: true
          }
        }
      }
    });

    const revokedSessionCount =
      input.action === "REACTIVATE"
        ? 0
        : await revokeActiveIdentitySessions(
            transaction,
            actor,
            {
              id: assignment.id,
              provider: assignment.provider,
              membershipId: assignment.membershipId
            },
            reason,
            input.action
          );

    await createAuditEvent(transaction, actor, {
      eventType: `external_identity_assignment.${input.action.toLowerCase()}`,
      targetId: updatedAssignment.id,
      payload: {
        provider: updatedAssignment.provider,
        externalEmail: updatedAssignment.externalEmail,
        organizationSlug: updatedAssignment.organization.slug,
        role: updatedAssignment.membership.role,
        status: updatedAssignment.status,
        reason,
        revokedSessionCount
      }
    });

    return {
      assignment: mapAssignmentRecord({
        ...updatedAssignment,
        activeSessionCount: input.action === "REACTIVATE" ? 0 : 0
      }),
      revokedSessionCount
    } as const;
  });
}
