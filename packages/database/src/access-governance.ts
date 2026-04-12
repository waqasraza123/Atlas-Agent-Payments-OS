import { canAtlasActorMutate, type AtlasActorContext } from "@atlas/auth";
import { authRuntime } from "@atlas/config";
import type { OrganizationKind } from "@atlas/types";
import {
  Prisma,
  type IdentityProviderLinkStatus,
  type PrismaClient,
  type SupportAccessGrantStatus
} from "./generated/client/index.js";
import { prisma } from "./client";
import { AtlasAuthSessionWorkflowError, loadAuthSessionById, mapPersistedAuthSession } from "./auth-sessions";
import {
  AtlasSupportAccessWorkflowError,
  recertifySupportAccessGrant,
  revokeSupportAccessGrant
} from "./support-access";
import { createAtlasTenantAccessAuditEvent } from "./tenant-access-audit";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

type CampaignWithRelations = {
  id: string;
  title: string;
  reason: string;
  status: "OPEN" | "COMPLETED" | "CANCELED";
  dueAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  createdByUser: {
    email: string;
  };
  organization: {
    id: string;
  };
  items: Array<{
    id: string;
    status: "PENDING" | "RECERTIFIED" | "REVOKED";
    resolutionReason: string | null;
    resolvedAt: Date | null;
    supportAccessGrant: {
      id: string;
      targetWorkspace: OrganizationKind;
      status: SupportAccessGrantStatus;
      expiresAt: Date;
      reviewExpiresAt: Date | null;
      issuedByUser: {
        email: string;
      };
      targetOrganization: {
        name: string;
        slug: string;
      };
    };
  }>;
};

type AtlasSupportAccessCampaignResolutionAction = "RECERTIFY" | "REVOKE";

export type AtlasSupportAccessReviewCampaignCandidateRecord = {
  grantId: string;
  targetOrganizationId: string;
  targetOrganizationSlug: string;
  targetOrganizationName: string;
  targetWorkspace: OrganizationKind;
  issuedByUserEmail: string;
  reason: string;
  status: SupportAccessGrantStatus;
  expiresAt: string;
  reviewExpiresAt: string | null;
};

export type AtlasSupportAccessReviewCampaignItemRecord = {
  id: string;
  grantId: string;
  targetOrganizationName: string;
  targetOrganizationSlug: string;
  targetWorkspace: OrganizationKind;
  issuedByUserEmail: string;
  grantStatus: SupportAccessGrantStatus;
  expiresAt: string;
  reviewExpiresAt: string | null;
  status: "PENDING" | "RECERTIFIED" | "REVOKED";
  resolutionReason: string | null;
  resolvedAt: string | null;
};

export type AtlasSupportAccessReviewCampaignRecord = {
  id: string;
  title: string;
  reason: string;
  status: "OPEN" | "COMPLETED" | "CANCELED";
  dueAt: string;
  completedAt: string | null;
  createdAt: string;
  createdByUserEmail: string;
  pendingItemCount: number;
  resolvedItemCount: number;
  items: AtlasSupportAccessReviewCampaignItemRecord[];
};

export type AtlasIdentityProviderSessionRecord = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  organizationKind: OrganizationKind;
  membershipId: string;
  role: string;
  provider: string;
  authProviderMode: "IDENTITY_BRIDGE" | "EXTERNAL_OIDC";
  issuedAt: string;
  expiresAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
};

export type AtlasIdentityProviderLinkRecord = {
  id: string;
  provider: string;
  subject: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  status: IdentityProviderLinkStatus;
  statusReason: string | null;
  statusChangedAt: string | null;
  statusChangedByUserEmail: string | null;
  lastAuthenticatedAt: string;
  linkedAt: string;
  tenantOrganizations: Array<{
    id: string;
    slug: string;
    name: string;
    kind: OrganizationKind;
    role: string;
  }>;
  activeSessionCount: number;
};

type AtlasIdentityProviderLinkAction = "SUSPEND" | "REACTIVATE" | "REVOKE";

function assertGovernanceActor(actor: AtlasActorContext) {
  if (actor.workspace !== "OPERATOR" || actor.organization.kind !== "OPERATOR") {
    throw new AtlasSupportAccessWorkflowError(
      "Access governance can only be managed from the operator workspace.",
      "forbidden"
    );
  }

  if (!canAtlasActorMutate(actor)) {
    throw new AtlasSupportAccessWorkflowError(
      "Support-access sessions cannot manage access governance.",
      "forbidden"
    );
  }

  if (actor.membership.role !== "OWNER" && actor.membership.role !== "ADMIN") {
    throw new AtlasSupportAccessWorkflowError(
      "Only operator owners and admins can manage access governance.",
      "forbidden"
    );
  }
}

function assertGovernanceReason(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length < 12) {
    throw new AtlasSupportAccessWorkflowError(
      `${label} must include enough detail for later audit review.`,
      "bad_request"
    );
  }

  return value.trim();
}

function createCampaignDueAt() {
  return new Date(Date.now() + authRuntime.supportAccessReviewLookaheadHours * 60 * 60 * 1000);
}

function createCampaignCutoff() {
  return new Date(Date.now() + authRuntime.supportAccessReviewLookaheadHours * 60 * 60 * 1000);
}

function mapCampaignCandidate(grant: {
  id: string;
  targetWorkspace: OrganizationKind;
  reason: string;
  status: SupportAccessGrantStatus;
  expiresAt: Date;
  reviewExpiresAt: Date | null;
  issuedByUser: { email: string };
  targetOrganization: { id: string; slug: string; name: string };
}) {
  return {
    grantId: grant.id,
    targetOrganizationId: grant.targetOrganization.id,
    targetOrganizationSlug: grant.targetOrganization.slug,
    targetOrganizationName: grant.targetOrganization.name,
    targetWorkspace: grant.targetWorkspace,
    issuedByUserEmail: grant.issuedByUser.email,
    reason: grant.reason,
    status: grant.status,
    expiresAt: grant.expiresAt.toISOString(),
    reviewExpiresAt: grant.reviewExpiresAt?.toISOString() ?? null
  } satisfies AtlasSupportAccessReviewCampaignCandidateRecord;
}

function mapCampaignRecord(campaign: CampaignWithRelations) {
  const items = campaign.items.map((item: CampaignWithRelations["items"][number]) => ({
    id: item.id,
    grantId: item.supportAccessGrant.id,
    targetOrganizationName: item.supportAccessGrant.targetOrganization.name,
    targetOrganizationSlug: item.supportAccessGrant.targetOrganization.slug,
    targetWorkspace: item.supportAccessGrant.targetWorkspace,
    issuedByUserEmail: item.supportAccessGrant.issuedByUser.email,
    grantStatus: item.supportAccessGrant.status,
    expiresAt: item.supportAccessGrant.expiresAt.toISOString(),
    reviewExpiresAt: item.supportAccessGrant.reviewExpiresAt?.toISOString() ?? null,
    status: item.status,
    resolutionReason: item.resolutionReason,
    resolvedAt: item.resolvedAt?.toISOString() ?? null
  })) satisfies AtlasSupportAccessReviewCampaignItemRecord[];

  return {
    id: campaign.id,
    title: campaign.title,
    reason: campaign.reason,
    status: campaign.status,
    dueAt: campaign.dueAt.toISOString(),
    completedAt: campaign.completedAt?.toISOString() ?? null,
    createdAt: campaign.createdAt.toISOString(),
    createdByUserEmail: campaign.createdByUser.email,
    pendingItemCount: items.filter((item: AtlasSupportAccessReviewCampaignItemRecord) => item.status === "PENDING").length,
    resolvedItemCount: items.filter((item: AtlasSupportAccessReviewCampaignItemRecord) => item.status !== "PENDING").length,
    items
  } satisfies AtlasSupportAccessReviewCampaignRecord;
}

function mapIdentityProviderSession(session: NonNullable<Awaited<ReturnType<typeof loadAuthSessionById>>> & {
  organizationKind: OrganizationKind;
}) {
  return {
    id: session.id,
    userId: session.userId,
    userEmail: session.userEmail,
    userName: session.userName,
    organizationId: session.organizationId,
    organizationSlug: session.organizationSlug,
    organizationName: session.organizationName,
    organizationKind: session.organizationKind,
    membershipId: session.membershipId,
    role: session.role,
    provider: session.provider,
    authProviderMode: session.authProviderMode,
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
    lastSeenAt: session.lastSeenAt,
    revokedAt: session.revokedAt
  } satisfies AtlasIdentityProviderSessionRecord;
}

function mapIdentityProviderLink(input: {
  id: string;
  provider: string;
  subject: string;
  status: IdentityProviderLinkStatus;
  statusReason: string | null;
  statusChangedAt: Date | null;
  linkedAt: Date;
  lastAuthenticatedAt: Date;
  user: {
    id: string;
    email: string;
    name: string | null;
    memberships: Array<{
      id: string;
      role: string;
      organization: {
        id: string;
        slug: string;
        name: string;
        kind: OrganizationKind;
      };
    }>;
  };
  statusChangedByUser: {
    email: string;
  } | null;
  activeSessionCount: number;
}) {
  return {
    id: input.id,
    provider: input.provider,
    subject: input.subject,
    userId: input.user.id,
    userEmail: input.user.email,
    userName: input.user.name,
    status: input.status,
    statusReason: input.statusReason,
    statusChangedAt: input.statusChangedAt?.toISOString() ?? null,
    statusChangedByUserEmail: input.statusChangedByUser?.email ?? null,
    lastAuthenticatedAt: input.lastAuthenticatedAt.toISOString(),
    linkedAt: input.linkedAt.toISOString(),
    tenantOrganizations: input.user.memberships
      .filter((membership) => membership.organization.kind === "BUYER" || membership.organization.kind === "SELLER")
      .map((membership) => ({
        id: membership.organization.id,
        slug: membership.organization.slug,
        name: membership.organization.name,
        kind: membership.organization.kind,
        role: membership.role
      })),
    activeSessionCount: input.activeSessionCount
  } satisfies AtlasIdentityProviderLinkRecord;
}

async function createAuditEvent(
  client: DatabaseClient,
  actor: AtlasActorContext,
  input: {
    targetId: string;
    eventType: string;
    payload: Prisma.JsonObject;
  }
) {
  await client.auditEvent.create({
    data: {
      organizationId: actor.organization.id,
      userId: actor.user.id,
      actorType: "HUMAN",
      eventType: input.eventType,
      targetType: "access_governance",
      targetId: input.targetId,
      payload: input.payload
    }
  });
}

export async function listSupportAccessReviewCampaignCandidates(
  actor: AtlasActorContext,
  client: DatabaseClient = prisma
) {
  assertGovernanceActor(actor);
  const cutoff = createCampaignCutoff();
  const grants = await client.supportAccessGrant.findMany({
    where: {
      issuedByOrganizationId: actor.organization.id,
      targetOrganization: {
        kind: {
          in: ["BUYER", "SELLER"]
        }
      },
      expiresAt: {
        gt: new Date()
      },
      OR: [
        {
          status: "RECERTIFICATION_REQUIRED"
        },
        {
          status: "ACTIVE",
          reviewExpiresAt: {
            lte: cutoff
          }
        }
      ]
    },
    include: {
      issuedByUser: true,
      targetOrganization: true
    },
    orderBy: [
      {
        reviewExpiresAt: "asc"
      },
      {
        createdAt: "desc"
      }
    ]
  });

  const items = grants.map(mapCampaignCandidate);
  await createAtlasTenantAccessAuditEvent(client, actor, {
    eventType: "support_access.review_campaign_candidates_inspected",
    targetType: "support_access_scope",
    targetId: actor.organization.id,
    payload: {
      surface: "support_access_review_candidates",
      resultCount: items.length
    }
  });
  return items;
}

export async function createSupportAccessReviewCampaign(
  actor: AtlasActorContext,
  input: {
    title: string;
    reason: string;
  },
  client: PrismaClient = prisma
) {
  assertGovernanceActor(actor);
  const title = assertGovernanceReason(input.title, "Campaign title");
  const reason = assertGovernanceReason(input.reason, "Campaign reason");
  const candidates = await listSupportAccessReviewCampaignCandidates(actor, client);

  if (candidates.length === 0) {
    throw new AtlasSupportAccessWorkflowError(
      "No support-access grants currently require access-review follow-up.",
      "conflict"
    );
  }

  const campaign = await client.$transaction(async (transaction) => {
    const createdCampaign = await transaction.supportAccessReviewCampaign.create({
      data: {
        organizationId: actor.organization.id,
        createdByUserId: actor.user.id,
        title,
        reason,
        dueAt: createCampaignDueAt(),
        items: {
          createMany: {
            data: candidates.map((candidate) => ({
              supportAccessGrantId: candidate.grantId
            }))
          }
        }
      },
      include: {
        items: {
          include: {
            supportAccessGrant: {
              include: {
                issuedByUser: true,
                targetOrganization: true
              }
            }
          },
          orderBy: {
            createdAt: "asc"
          }
        },
        createdByUser: true,
        organization: true
      }
    });

    await createAuditEvent(transaction, actor, {
      targetId: createdCampaign.id,
      eventType: "support_access.review_campaign_created",
      payload: {
        candidateCount: candidates.length,
        title,
        reason
      }
    });

    return createdCampaign;
  });

  return mapCampaignRecord(campaign);
}

export async function listSupportAccessReviewCampaigns(
  actor: AtlasActorContext,
  client: DatabaseClient = prisma
) {
  assertGovernanceActor(actor);
  const campaigns = await client.supportAccessReviewCampaign.findMany({
    where: {
      organizationId: actor.organization.id
    },
    include: {
      items: {
        include: {
          supportAccessGrant: {
            include: {
              issuedByUser: true,
              targetOrganization: true
            }
          }
        },
        orderBy: {
          createdAt: "asc"
        }
      },
      createdByUser: true,
      organization: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  const items = campaigns.map(mapCampaignRecord);
  await createAtlasTenantAccessAuditEvent(client, actor, {
    eventType: "support_access.review_campaigns_inspected",
    targetType: "support_access_scope",
    targetId: actor.organization.id,
    payload: {
      surface: "support_access_review_campaigns",
      resultCount: items.length
    }
  });
  return items;
}

export async function resolveSupportAccessReviewCampaignItem(
  actor: AtlasActorContext,
  campaignId: string,
  itemId: string,
  input: {
    action: AtlasSupportAccessCampaignResolutionAction;
    reason: string;
  },
  client: PrismaClient = prisma
) {
  assertGovernanceActor(actor);
  const reason = assertGovernanceReason(input.reason, "Campaign resolution reason");

  return client.$transaction(async (transaction) => {
    const item = await transaction.supportAccessReviewCampaignItem.findUnique({
      where: {
        id: itemId
      },
      include: {
        campaign: true,
        supportAccessGrant: {
          include: {
            issuedByUser: true,
            targetOrganization: true
          }
        }
      }
    });

    if (!item || item.campaignId !== campaignId) {
      throw new AtlasSupportAccessWorkflowError("Support-access review campaign item was not found.", "not_found");
    }

    if (item.campaign.organizationId !== actor.organization.id) {
      throw new AtlasSupportAccessWorkflowError(
        "Support-access review campaigns can only be resolved inside the issuing operator organization.",
        "forbidden"
      );
    }

    if (item.campaign.status !== "OPEN") {
      throw new AtlasSupportAccessWorkflowError("Only open support-access review campaigns can be resolved.", "conflict");
    }

    if (item.status !== "PENDING") {
      throw new AtlasSupportAccessWorkflowError("Only pending campaign items can be resolved.", "conflict");
    }

    if (input.action === "RECERTIFY") {
      await recertifySupportAccessGrant(
        actor,
        item.supportAccessGrantId,
        {
          reviewReason: reason
        },
        transaction as never
      );
    } else {
      await revokeSupportAccessGrant(
        actor,
        item.supportAccessGrantId,
        {
          revokeReason: reason
        },
        transaction as never
      );
    }

    const updatedItem = await transaction.supportAccessReviewCampaignItem.update({
      where: {
        id: item.id
      },
      data: {
        status: input.action === "RECERTIFY" ? "RECERTIFIED" : "REVOKED",
        resolutionReason: reason,
        resolvedAt: new Date(),
        metadata: {
          resolvedByUserId: actor.user.id,
          action: input.action
        }
      },
      include: {
        campaign: true,
        supportAccessGrant: {
          include: {
            issuedByUser: true,
            targetOrganization: true
          }
        }
      }
    });

    const pendingItemCount = await transaction.supportAccessReviewCampaignItem.count({
      where: {
        campaignId: campaignId,
        status: "PENDING"
      }
    });

    if (pendingItemCount === 0) {
      await transaction.supportAccessReviewCampaign.update({
        where: {
          id: campaignId
        },
        data: {
          status: "COMPLETED",
          completedAt: new Date()
        }
      });
    }

    await createAuditEvent(transaction, actor, {
      targetId: updatedItem.id,
      eventType: "support_access.review_campaign_item_resolved",
      payload: {
        campaignId,
        supportAccessGrantId: item.supportAccessGrantId,
        action: input.action,
        reason
      }
    });

    return {
      campaignId,
      itemId: updatedItem.id,
      targetOrganizationName: updatedItem.supportAccessGrant.targetOrganization.name,
      itemStatus: updatedItem.status
    } as const;
  });
}

export async function listIdentityProviderSessions(
  actor: AtlasActorContext,
  client: DatabaseClient = prisma
) {
  assertGovernanceActor(actor);
  const sessions = await client.authSession.findMany({
    where: {
      source: "IDENTITY_PROVIDER",
      revokedAt: null,
      expiresAt: {
        gt: new Date()
      },
      organization: {
        kind: {
          in: ["BUYER", "SELLER"]
        }
      }
    },
    include: {
      user: true,
      organization: true,
      membership: true
    },
    orderBy: {
      lastSeenAt: "desc"
    }
  });

  const items = sessions.map((session) =>
    mapIdentityProviderSession({
      ...mapPersistedAuthSession(session),
      organizationKind: session.organization.kind
    })
  );
  await createAtlasTenantAccessAuditEvent(client, actor, {
    eventType: "identity_provider.sessions_inspected",
    targetType: "identity_access_scope",
    targetId: actor.organization.id,
    payload: {
      surface: "identity_provider_sessions",
      resultCount: items.length
    }
  });
  return items;
}

export async function listIdentityProviderLinks(
  actor: AtlasActorContext,
  client: DatabaseClient = prisma
) {
  assertGovernanceActor(actor);
  const links = await client.identityProviderLink.findMany({
    where: {
      user: {
        memberships: {
          some: {
            organization: {
              kind: {
                in: ["BUYER", "SELLER"]
              }
            }
          }
        }
      }
    },
    include: {
      user: {
        include: {
          memberships: {
            include: {
              organization: true
            }
          }
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
        lastAuthenticatedAt: "desc"
      }
    ]
  });

  const activeSessions = await client.authSession.findMany({
    where: {
      source: "IDENTITY_PROVIDER",
      revokedAt: null,
      expiresAt: {
        gt: new Date()
      }
    },
    select: {
      provider: true,
      providerSubject: true
    }
  });

  const activeSessionCounts = new Map<string, number>();
  for (const session of activeSessions) {
    const key = `${session.provider ?? ""}:${session.providerSubject ?? ""}`;
    activeSessionCounts.set(key, (activeSessionCounts.get(key) ?? 0) + 1);
  }

  const items = links.map((link) =>
    mapIdentityProviderLink({
      ...link,
      activeSessionCount: activeSessionCounts.get(`${link.provider}:${link.subject}`) ?? 0
    })
  );
  await createAtlasTenantAccessAuditEvent(client, actor, {
    eventType: "identity_provider.links_inspected",
    targetType: "identity_access_scope",
    targetId: actor.organization.id,
    payload: {
      surface: "identity_provider_links",
      resultCount: items.length
    }
  });
  return items;
}

export async function updateIdentityProviderLinkLifecycle(
  actor: AtlasActorContext,
  linkId: string,
  input: {
    action: AtlasIdentityProviderLinkAction;
    reason: string;
  },
  client: PrismaClient = prisma
) {
  assertGovernanceActor(actor);
  const reason = assertGovernanceReason(input.reason, "Identity-provider action reason");

  return client.$transaction(async (transaction) => {
    const link = await transaction.identityProviderLink.findUnique({
      where: {
        id: linkId
      },
      include: {
        user: {
          include: {
            memberships: {
              include: {
                organization: true
              }
            }
          }
        },
        statusChangedByUser: {
          select: {
            email: true
          }
        }
      }
    });

    if (!link) {
      throw new AtlasAuthSessionWorkflowError("Identity-provider link was not found.", "not_found");
    }

    const tenantMemberships = link.user.memberships.filter(
      (membership) => membership.organization.kind === "BUYER" || membership.organization.kind === "SELLER"
    );

    if (tenantMemberships.length === 0) {
      throw new AtlasAuthSessionWorkflowError("Only buyer and seller identity links can be governed here.", "forbidden");
    }

    if (input.action === "SUSPEND" && link.status !== "ACTIVE") {
      throw new AtlasAuthSessionWorkflowError("Only active identity-provider links can be suspended.", "conflict");
    }

    if (input.action === "REACTIVATE" && link.status !== "SUSPENDED") {
      throw new AtlasAuthSessionWorkflowError("Only suspended identity-provider links can be reactivated.", "conflict");
    }

    if (input.action === "REVOKE" && link.status === "REVOKED") {
      throw new AtlasAuthSessionWorkflowError("Identity-provider link is already revoked.", "conflict");
    }

    const nextStatus =
      input.action === "SUSPEND"
        ? "SUSPENDED"
        : input.action === "REACTIVATE"
          ? "ACTIVE"
          : "REVOKED";

    const updatedLink = await transaction.identityProviderLink.update({
      where: {
        id: link.id
      },
      data: {
        status: nextStatus,
        statusReason: reason,
        statusChangedAt: new Date(),
        statusChangedByUserId: actor.user.id
      },
      include: {
        user: {
          include: {
            memberships: {
              include: {
                organization: true
              }
            }
          }
        },
        statusChangedByUser: {
          select: {
            email: true
          }
        }
      }
    });

    let revokedSessionCount = 0;

    if (input.action !== "REACTIVATE") {
      const activeSessions = await transaction.authSession.findMany({
        where: {
          source: "IDENTITY_PROVIDER",
          provider: link.provider,
          providerSubject: link.subject,
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

      revokedSessionCount = activeSessions.length;

      for (const session of activeSessions) {
        const metadata =
          session.metadata && typeof session.metadata === "object" && !Array.isArray(session.metadata)
            ? (session.metadata as Prisma.JsonObject)
            : {};

        await transaction.authSession.update({
          where: {
            id: session.id
          },
          data: {
            revokedAt: new Date(),
            metadata: {
              ...metadata,
              revokedByUserId: actor.user.id,
              revokeReason: reason,
              identityProviderAction: input.action,
              identityProviderLinkId: link.id
            }
          }
        });
      }
    }

    await createAuditEvent(transaction, actor, {
      targetId: updatedLink.id,
      eventType: `identity_provider_link.${input.action.toLowerCase()}`,
      payload: {
        provider: updatedLink.provider,
        subject: updatedLink.subject,
        status: updatedLink.status,
        reason,
        revokedSessionCount
      }
    });

    return {
      link: mapIdentityProviderLink({
        ...updatedLink,
        activeSessionCount: 0
      }),
      revokedSessionCount
    } as const;
  });
}

export async function revokeIdentityProviderSession(
  actor: AtlasActorContext,
  sessionId: string,
  input: {
    reason: string;
  },
  client: PrismaClient = prisma
) {
  assertGovernanceActor(actor);
  const reason = assertGovernanceReason(input.reason, "Session revoke reason");
  const session = await loadAuthSessionById(sessionId, client);

  if (!session) {
    throw new AtlasAuthSessionWorkflowError("Identity-provider session was not found.", "not_found");
  }

  const updatedSession = await client.$transaction(async (transaction) => {
    const currentRecord = await transaction.authSession.findUnique({
      where: {
        id: sessionId
      },
      include: {
        user: true,
        organization: true,
        membership: true
      }
    });

    if (!currentRecord || currentRecord.source !== "IDENTITY_PROVIDER") {
      throw new AtlasAuthSessionWorkflowError("Identity-provider session was not found.", "not_found");
    }

    if (currentRecord.organization.kind !== "BUYER" && currentRecord.organization.kind !== "SELLER") {
      throw new AtlasAuthSessionWorkflowError("Only buyer and seller identity sessions can be governed here.", "forbidden");
    }

    if (currentRecord.revokedAt || currentRecord.expiresAt.getTime() <= Date.now()) {
      throw new AtlasAuthSessionWorkflowError("Identity-provider session is already inactive.", "conflict");
    }

    const metadata =
      currentRecord.metadata && typeof currentRecord.metadata === "object" && !Array.isArray(currentRecord.metadata)
        ? (currentRecord.metadata as Prisma.JsonObject)
        : {};

    const revokedRecord = await transaction.authSession.update({
      where: {
        id: sessionId
      },
      data: {
        revokedAt: new Date(),
        metadata: {
          ...metadata,
          revokedByUserId: actor.user.id,
          revokeReason: reason
        }
      },
      include: {
        user: true,
        organization: true,
        membership: true
      }
    });

    await transaction.auditEvent.create({
      data: {
        organizationId: revokedRecord.organization.id,
        userId: actor.user.id,
        actorType: "HUMAN",
        eventType: "auth_session.revoked",
        targetType: "auth_session",
        targetId: revokedRecord.id,
        payload: {
          provider: revokedRecord.provider,
          authProviderMode: revokedRecord.authProviderMode,
          revokedUserEmail: revokedRecord.user.email,
          revokeReason: reason
        }
      }
    });

    return revokedRecord;
  });

  return mapIdentityProviderSession({
    ...mapPersistedAuthSession(updatedSession),
    organizationKind: updatedSession.organization.kind,
    revokedAt: updatedSession.revokedAt?.toISOString() ?? new Date().toISOString()
  });
}
