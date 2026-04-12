import {
  atlasIdentityAssertionHeaderName,
  atlasLocalSessionCookieName,
  atlasLocalSessionProfileList,
  canAtlasActorAccessWorkspace,
  createAtlasLocalSessionSelection,
  formatAtlasRoleLabel,
  formatAtlasWorkspaceLabel,
  getDefaultAtlasLocalSessionProfileForWorkspace,
  type AtlasActorContext,
  type AtlasLocalSessionProfile,
  type AtlasLocalSessionSelection,
  type AtlasSupportAccessRecord
} from "@atlas/auth";
import { verifyAtlasIdentityAssertionToken, verifyAtlasSignedSessionToken } from "@atlas/auth/server";
import { appRuntime, authRuntime } from "@atlas/config";
import { prisma } from "@atlas/database";
import type { MembershipRole, OrganizationKind } from "@atlas/types";
import { cookies, headers } from "next/headers";

export type WorkspaceActorResolution =
  | {
      status: "ready";
      actor: AtlasActorContext;
      selection: AtlasLocalSessionSelection;
      profiles: AtlasLocalSessionProfile[];
    }
  | {
      status: "missing";
      profiles: AtlasLocalSessionProfile[];
      workspace: OrganizationKind;
    }
  | {
      status: "forbidden";
      actor: AtlasActorContext;
      profiles: AtlasLocalSessionProfile[];
      workspace: OrganizationKind;
    }
  | {
      status: "error";
      profiles: AtlasLocalSessionProfile[];
      workspace: OrganizationKind;
      message: string;
    };

type MembershipWithRelations = Awaited<ReturnType<typeof loadMembership>>;

async function readSignedSessionSelection(workspace: OrganizationKind) {
  const cookieStore = await cookies();
  const verification = verifyAtlasSignedSessionToken(
    authRuntime.sessionSigningSecret,
    cookieStore.get(atlasLocalSessionCookieName)?.value
  );

  if (verification.status === "ready") {
    return verification.payload;
  }

  if (
    authRuntime.providerMode !== "local-signed" ||
    (appRuntime.appEnv !== "local" && appRuntime.appEnv !== "development")
  ) {
    return null;
  }

  const defaultProfile = getDefaultAtlasLocalSessionProfileForWorkspace(workspace);
  if (!defaultProfile) {
    return null;
  }

  return {
    source: "local-development" as const,
    selection: createAtlasLocalSessionSelection(defaultProfile.key),
    supportAccess: null,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + authRuntime.localSessionTtlMinutes * 60 * 1000).toISOString()
  };
}

async function readIdentityAssertionSelection() {
  const requestHeaders = await headers();
  const verification = verifyAtlasIdentityAssertionToken(
    authRuntime.identityBridgeSecret,
    requestHeaders.get(atlasIdentityAssertionHeaderName)
  );

  return verification.status === "ready" ? verification.payload : null;
}

async function loadMembership(input: {
  role: MembershipRole;
  userEmail: string;
  organizationSlug: string;
  workspace: OrganizationKind;
}) {
  return prisma.membership.findFirst({
    where: {
      role: input.role,
      user: {
        email: input.userEmail
      },
      organization: {
        slug: input.organizationSlug,
        kind: input.workspace
      }
    },
    include: {
      user: true,
      organization: true
    }
  });
}

function createBaseActorContext(
  membership: NonNullable<MembershipWithRelations>,
  input: {
    workspace: OrganizationKind;
    agentId: string | null;
    source: AtlasActorContext["source"];
    providerMode: AtlasActorContext["providerMode"];
    sessionIssuedAt: string;
    sessionExpiresAt: string;
  }
) {
  return {
    user: {
      id: membership.user.id,
      email: membership.user.email,
      name: membership.user.name ?? null
    },
    organization: {
      id: membership.organization.id,
      slug: membership.organization.slug,
      name: membership.organization.name,
      kind: membership.organization.kind
    },
    membership: {
      id: membership.id,
      role: membership.role
    },
    workspace: input.workspace,
    agentId: input.agentId,
    source: input.source,
    providerMode: input.providerMode,
    sessionIssuedAt: input.sessionIssuedAt,
    sessionExpiresAt: input.sessionExpiresAt,
    principalOrganization: null,
    supportAccess: null
  } satisfies AtlasActorContext;
}

async function loadSupportAccessGrant(supportAccess: AtlasSupportAccessRecord) {
  const grant = await prisma.supportAccessGrant.findUnique({
    where: {
      id: supportAccess.grantId
    },
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
    return prisma.supportAccessGrant.update({
      where: {
        id: grant.id
      },
      data: {
        status: "EXPIRED"
      },
      include: {
        issuedByUser: true,
        issuedByOrganization: true,
        targetOrganization: true
      }
    });
  }

  return grant;
}

function isSupportAccessAllowedEmail(userEmail: string) {
  return (
    authRuntime.supportAccessAllowedEmails.length === 0 ||
    authRuntime.supportAccessAllowedEmails.includes(userEmail.trim().toLowerCase())
  );
}

async function loadActorContext(input: {
  selection: AtlasLocalSessionSelection;
  source: AtlasActorContext["source"];
  supportAccess: AtlasSupportAccessRecord | null;
  issuedAt: string;
  expiresAt: string;
}) {
  const membership = await loadMembership({
    role: input.selection.role,
    userEmail: input.selection.userEmail,
    organizationSlug: input.selection.organizationSlug,
    workspace: input.selection.workspace
  });

  if (!membership) {
    return null;
  }

  const actor = createBaseActorContext(membership, {
    workspace: membership.organization.kind,
    agentId: input.selection.agentId,
    source: input.source,
    providerMode: input.source === "identity-bridge" ? "identity-bridge" : authRuntime.providerMode,
    sessionIssuedAt: input.issuedAt,
    sessionExpiresAt: input.expiresAt
  });

  if (!input.supportAccess) {
    return actor;
  }

  if (
    input.supportAccess.grantedByUserEmail !== input.selection.userEmail.toLowerCase() ||
    !isSupportAccessAllowedEmail(input.selection.userEmail)
  ) {
    return null;
  }

  const supportGrant = await loadSupportAccessGrant(input.supportAccess);
  if (
    !supportGrant ||
    supportGrant.status !== "ACTIVE" ||
    supportGrant.issuedByUser.email.toLowerCase() !== input.selection.userEmail.toLowerCase() ||
    supportGrant.issuedByOrganization.slug !== input.selection.organizationSlug ||
    supportGrant.targetOrganization.slug !== input.supportAccess.targetOrganizationSlug ||
    supportGrant.targetWorkspace !== input.supportAccess.targetWorkspace
  ) {
    return null;
  }

  return {
    ...actor,
    organization: {
      id: supportGrant.targetOrganization.id,
      slug: supportGrant.targetOrganization.slug,
      name: supportGrant.targetOrganization.name,
      kind: supportGrant.targetOrganization.kind
    },
    workspace: supportGrant.targetOrganization.kind,
    agentId: null,
    source: "internal-support",
    principalOrganization: actor.organization,
    supportAccess: input.supportAccess
  } satisfies AtlasActorContext;
}

export async function resolveWorkspaceActor(workspace: OrganizationKind): Promise<WorkspaceActorResolution> {
  const profiles =
    authRuntime.providerMode === "local-signed" && (appRuntime.appEnv === "local" || appRuntime.appEnv === "development")
      ? atlasLocalSessionProfileList.filter((profile) => profile.workspace === workspace)
      : [];
  const session = (await readSignedSessionSelection(workspace)) ?? (await readIdentityAssertionSelection());

  if (!session) {
    return {
      status: "missing",
      profiles,
      workspace
    };
  }

  try {
    const actor = await loadActorContext({
      selection: session.selection,
      source: session.source,
      supportAccess: "supportAccess" in session ? session.supportAccess : null,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt
    });

    if (!actor) {
      return {
        status: "missing",
        profiles,
        workspace
      };
    }

    if (!canAtlasActorAccessWorkspace(actor.membership.role, workspace, actor.organization.kind)) {
      return {
        status: "forbidden",
        actor,
        profiles,
        workspace
      };
    }

    return {
      status: "ready",
      actor,
      selection: session.selection,
      profiles
    };
  } catch (error) {
    return {
      status: "error",
      profiles,
      workspace,
      message: error instanceof Error ? error.message : "Unknown actor resolution failure"
    };
  }
}

export function formatActorContextLine(actor: AtlasActorContext) {
  const fragments = [
    actor.user.name ?? actor.user.email,
    actor.organization.name,
    formatAtlasWorkspaceLabel(actor.workspace),
    formatAtlasRoleLabel(actor.membership.role)
  ];

  if (actor.source === "internal-support" && actor.supportAccess) {
    fragments.push(`Support: ${actor.supportAccess.reason}`);
  }

  return fragments.join(" / ");
}
