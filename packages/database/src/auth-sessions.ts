import type { AtlasLocalSessionSelection } from "@atlas/auth";
import { Prisma, type PrismaClient } from "./generated/client/index.js";
import { prisma } from "./client";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export class AtlasAuthSessionWorkflowError extends Error {
  constructor(
    message: string,
    readonly code: "bad_request" | "not_found" | "forbidden" | "conflict"
  ) {
    super(message);
    this.name = "AtlasAuthSessionWorkflowError";
  }
}

export type AtlasPersistedAuthSessionRecord = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  membershipId: string;
  role: string;
  provider: string;
  providerSubject: string;
  source: "IDENTITY_PROVIDER";
  authProviderMode: "IDENTITY_BRIDGE" | "EXTERNAL_OIDC";
  issuedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastSeenAt: string;
};

type ExternalIdentityAssignmentRecord = {
  id: string;
  status: "ACTIVE" | "SUSPENDED" | "REVOKED";
};

export function mapPersistedAuthSession(session: {
  id: string;
  source: string;
  authProviderMode: string;
  provider: string | null;
  providerSubject: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  lastSeenAt: Date;
  metadata: Prisma.JsonValue | null;
  user: { id: string; email: string; name: string | null };
  organization: { id: string; slug: string; name: string };
  membership: { id: string; role: string };
}) {
  const metadata =
    session.metadata && typeof session.metadata === "object" && !Array.isArray(session.metadata)
      ? (session.metadata as Record<string, unknown>)
      : null;

  if (session.source !== "IDENTITY_PROVIDER") {
    throw new AtlasAuthSessionWorkflowError("Only identity-provider sessions can be loaded through this exchange path.", "conflict");
  }

  return {
    id: session.id,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    organizationId: session.organization.id,
    organizationSlug: session.organization.slug,
    organizationName: session.organization.name,
    membershipId: session.membership.id,
    role: session.membership.role,
    provider: session.provider ?? "",
    providerSubject: session.providerSubject ?? "",
    source: session.source,
    authProviderMode: session.authProviderMode === "EXTERNAL_OIDC" ? "EXTERNAL_OIDC" : "IDENTITY_BRIDGE",
    issuedAt: typeof metadata?.issuedAt === "string" ? metadata.issuedAt : session.lastSeenAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    revokedAt: session.revokedAt?.toISOString() ?? null,
    lastSeenAt: session.lastSeenAt.toISOString()
  } satisfies AtlasPersistedAuthSessionRecord;
}

async function loadMembership(selection: AtlasLocalSessionSelection, client: DatabaseClient) {
  return client.membership.findFirst({
    where: {
      role: selection.role,
      user: {
        email: selection.userEmail
      },
      organization: {
        slug: selection.organizationSlug,
        kind: selection.workspace
      }
    },
    include: {
      user: true,
      organization: true
    }
  });
}

async function createAuditEvent(
  client: DatabaseClient,
  input: {
    organizationId: string;
    userId: string;
    eventType: string;
    targetId: string;
    payload: Prisma.JsonObject;
  }
) {
  await client.auditEvent.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      actorType: "HUMAN",
      eventType: input.eventType,
      targetType: "auth_session",
      targetId: input.targetId,
      payload: input.payload
    }
  });
}

async function loadIdentityProviderLink(
  client: DatabaseClient,
  input: {
    provider: string;
    subject: string;
  }
) {
  return client.identityProviderLink.findUnique({
    where: {
      provider_subject: {
        provider: input.provider,
        subject: input.subject
      }
    }
  });
}

async function loadExternalIdentityAssignment(
  client: DatabaseClient,
  input: {
    provider: string;
    externalEmail: string;
    membershipId: string;
  }
) {
  return client.externalIdentityAssignment.findUnique({
    where: {
      provider_externalEmail_membershipId: {
        provider: input.provider,
        externalEmail: input.externalEmail,
        membershipId: input.membershipId
      }
    },
    select: {
      id: true,
      status: true
    }
  }) as Promise<ExternalIdentityAssignmentRecord | null>;
}

export async function exchangeIdentityAssertionForSession(
  input: {
    selection: AtlasLocalSessionSelection;
    subject: string;
    provider: string;
    issuedAt: string;
    expiresAt: string;
    userName: string | null;
  },
  client: PrismaClient = prisma
) {
  return exchangeIdentitySession(
    {
      selection: input.selection,
      subject: input.subject,
      provider: input.provider,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
      userName: input.userName,
      authProviderMode: "IDENTITY_BRIDGE",
      metadata: {}
    },
    client
  );
}

export async function exchangeExternalIdentityForSession(
  input: {
    selection: AtlasLocalSessionSelection;
    externalEmail: string;
    subject: string;
    provider: string;
    issuer: string;
    audience: string;
    issuedAt: string;
    expiresAt: string;
    userName: string | null;
  },
  client: PrismaClient = prisma
) {
  return exchangeIdentitySession(
    {
      selection: input.selection,
      externalEmail: input.externalEmail,
      subject: input.subject,
      provider: input.provider,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
      userName: input.userName,
      authProviderMode: "EXTERNAL_OIDC",
      metadata: {
        issuer: input.issuer,
        audience: input.audience
      }
    },
    client
  );
}

async function exchangeIdentitySession(
  input: {
    selection: AtlasLocalSessionSelection;
    externalEmail?: string;
    subject: string;
    provider: string;
    issuedAt: string;
    expiresAt: string;
    userName: string | null;
    authProviderMode: "IDENTITY_BRIDGE" | "EXTERNAL_OIDC";
    metadata: Prisma.JsonObject;
  },
  client: PrismaClient = prisma
) {
  const subject = input.subject.trim();
  const provider = input.provider.trim();
  const issuedAt = new Date(input.issuedAt);
  const expiresAt = new Date(input.expiresAt);

  if (subject.length === 0 || provider.length === 0) {
    throw new AtlasAuthSessionWorkflowError("Identity exchange requires a provider and subject.", "bad_request");
  }

  if (
    Number.isNaN(issuedAt.getTime()) ||
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= issuedAt.getTime() ||
    expiresAt.getTime() <= Date.now()
  ) {
    throw new AtlasAuthSessionWorkflowError("Identity exchange requires a valid unexpired assertion window.", "bad_request");
  }

  const membership = await loadMembership(input.selection, client);
  if (!membership) {
    throw new AtlasAuthSessionWorkflowError("Identity exchange could not resolve an Atlas membership.", "not_found");
  }

  const externalIdentityAssignment =
    input.authProviderMode === "EXTERNAL_OIDC"
      ? await loadExternalIdentityAssignment(client, {
          provider,
          externalEmail: (input.externalEmail ?? input.selection.userEmail).trim().toLowerCase(),
          membershipId: membership.id
        })
      : null;

  if (input.authProviderMode === "EXTERNAL_OIDC") {
    if (!externalIdentityAssignment) {
      throw new AtlasAuthSessionWorkflowError(
        "This external identity has not been provisioned for the requested Atlas membership.",
        "forbidden"
      );
    }

    if (externalIdentityAssignment.status !== "ACTIVE") {
      throw new AtlasAuthSessionWorkflowError(
        "The supplied external identity is not currently allowed to exchange into an Atlas session.",
        "forbidden"
      );
    }
  }

  const existingLink = await loadIdentityProviderLink(client, {
    provider,
    subject
  });

  if (existingLink && existingLink.userId !== membership.user.id) {
    throw new AtlasAuthSessionWorkflowError(
      "The supplied identity assertion is already linked to a different Atlas user.",
      "conflict"
    );
  }

  if (existingLink && existingLink.status !== "ACTIVE") {
    throw new AtlasAuthSessionWorkflowError(
      "The supplied identity is not currently allowed to exchange into an Atlas session.",
      "forbidden"
    );
  }

  const session = await client.$transaction(async (transaction) => {
    if (existingLink) {
      await transaction.identityProviderLink.update({
        where: {
          id: existingLink.id
        },
        data: {
          lastAuthenticatedAt: new Date(),
          metadata: {
            userEmail: membership.user.email,
            userName: input.userName
          }
        }
      });
    } else {
      await transaction.identityProviderLink.create({
        data: {
          provider,
          subject,
          userId: membership.user.id,
          status: "ACTIVE",
          metadata: {
            userEmail: membership.user.email,
            userName: input.userName
          }
        }
      });
    }

    const createdSession = await transaction.authSession.create({
      data: {
        userId: membership.user.id,
        organizationId: membership.organization.id,
        membershipId: membership.id,
        source: "IDENTITY_PROVIDER",
        authProviderMode: input.authProviderMode,
        provider,
        providerSubject: subject,
        expiresAt,
        metadata: {
          issuedAt: issuedAt.toISOString(),
          userName: input.userName,
          ...input.metadata
        }
      },
      include: {
        user: true,
        organization: true,
        membership: true
      }
    });

    if (externalIdentityAssignment) {
      await transaction.externalIdentityAssignment.update({
        where: {
          id: externalIdentityAssignment.id
        },
        data: {
          lastExchangedAt: new Date()
        }
      });
    }

    await createAuditEvent(transaction, {
      organizationId: membership.organization.id,
      userId: membership.user.id,
      eventType: "auth_session.exchanged",
      targetId: createdSession.id,
      payload: {
        provider,
        subject,
        membershipId: membership.id,
        authProviderMode: input.authProviderMode,
        expiresAt: expiresAt.toISOString()
      }
    });

    return createdSession;
  });

  return mapPersistedAuthSession(session);
}

export async function loadAuthSessionById(sessionId: string, client: DatabaseClient = prisma) {
  if (sessionId.trim().length === 0) {
    return null;
  }

  const session = await client.authSession.findUnique({
    where: {
      id: sessionId
    },
    include: {
      user: true,
      organization: true,
      membership: true
    }
  });

  if (!session) {
    return null;
  }

  if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  if (session.source === "IDENTITY_PROVIDER") {
    if (!session.provider || !session.providerSubject) {
      return null;
    }

    const identityProviderLink = await loadIdentityProviderLink(client, {
      provider: session.provider,
      subject: session.providerSubject
    });

    if (!identityProviderLink || identityProviderLink.status !== "ACTIVE") {
      return null;
    }

    if (session.authProviderMode === "EXTERNAL_OIDC") {
      const externalIdentityAssignment = await loadExternalIdentityAssignment(client, {
        provider: session.provider,
        externalEmail: session.user.email.toLowerCase(),
        membershipId: session.membership.id
      });

      if (!externalIdentityAssignment || externalIdentityAssignment.status !== "ACTIVE") {
        return null;
      }
    }
  }

  return mapPersistedAuthSession(session);
}

export async function touchAuthSession(sessionId: string, client: PrismaClient = prisma) {
  if (sessionId.trim().length === 0) {
    return null;
  }

  return client.authSession.update({
    where: {
      id: sessionId
    },
    data: {
      lastSeenAt: new Date()
    }
  });
}
