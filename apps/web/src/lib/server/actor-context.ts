import {
  atlasLocalSessionCookieName,
  atlasLocalSessionProfileList,
  canAtlasActorAccessWorkspace,
  createAtlasLocalSessionSelection,
  formatAtlasRoleLabel,
  formatAtlasWorkspaceLabel,
  getDefaultAtlasLocalSessionProfileForWorkspace,
  parseAtlasLocalSessionSelection,
  type AtlasActorContext,
  type AtlasLocalSessionProfile,
  type AtlasLocalSessionSelection
} from "@atlas/auth";
import { prisma } from "@atlas/database";
import type { OrganizationKind } from "@atlas/types";
import { cookies } from "next/headers";

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

async function readLocalSessionSelection(workspace: OrganizationKind) {
  const cookieStore = await cookies();
  const parsed = parseAtlasLocalSessionSelection(cookieStore.get(atlasLocalSessionCookieName)?.value);
  if (parsed) {
    return parsed;
  }

  const defaultProfile = getDefaultAtlasLocalSessionProfileForWorkspace(workspace);
  if (!defaultProfile) {
    return null;
  }

  return createAtlasLocalSessionSelection(defaultProfile.key);
}

async function loadActorContext(selection: AtlasLocalSessionSelection) {
  const membership = await prisma.membership.findFirst({
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

  if (!membership) {
    return null;
  }

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
    workspace: membership.organization.kind,
    agentId: selection.agentId,
    source: "local-development"
  } satisfies AtlasActorContext;
}

export async function resolveWorkspaceActor(workspace: OrganizationKind): Promise<WorkspaceActorResolution> {
  const profiles = atlasLocalSessionProfileList;
  const selection = await readLocalSessionSelection(workspace);

  if (!selection) {
    return {
      status: "missing",
      profiles,
      workspace
    };
  }

  try {
    const actor = await loadActorContext(selection);

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
      selection,
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
  return [
    actor.user.name ?? actor.user.email,
    actor.organization.name,
    formatAtlasWorkspaceLabel(actor.workspace),
    formatAtlasRoleLabel(actor.membership.role)
  ].join(" / ");
}
