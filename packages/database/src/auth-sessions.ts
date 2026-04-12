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

  const existingLink = await client.identityProviderLink.findUnique({
    where: {
      provider_subject: {
        provider,
        subject
      }
    }
  });

  if (existingLink && existingLink.userId !== membership.user.id) {
    throw new AtlasAuthSessionWorkflowError(
      "The supplied identity assertion is already linked to a different Atlas user.",
      "conflict"
    );
  }

  const session = await client.$transaction(async (transaction) => {
    await transaction.identityProviderLink.upsert({
      where: {
        provider_subject: {
          provider,
          subject
        }
      },
      update: {
        lastAuthenticatedAt: new Date(),
        metadata: {
          userEmail: membership.user.email,
          userName: input.userName
        }
      },
      create: {
        provider,
        subject,
        userId: membership.user.id,
        metadata: {
          userEmail: membership.user.email,
          userName: input.userName
        }
      }
    });

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
