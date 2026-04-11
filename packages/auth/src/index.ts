import {
  type MembershipRole,
  type OrganizationKind,
  isMembershipRole,
  isOrganizationKind,
  membershipRoleLabels,
  organizationKindLabels
} from "@atlas/types";

export const atlasLocalSessionCookieName = "atlas_local_session";
export const atlasLocalSessionHeaderName = "x-atlas-local-session";

export type AtlasActorUser = {
  id: string;
  email: string;
  name: string | null;
};

export type AtlasActorOrganization = {
  id: string;
  slug: string;
  name: string;
  kind: OrganizationKind;
};

export type AtlasActorMembership = {
  id: string;
  role: MembershipRole;
};

export type AtlasActorContext = {
  user: AtlasActorUser;
  organization: AtlasActorOrganization;
  membership: AtlasActorMembership;
  workspace: OrganizationKind;
  agentId: string | null;
  source: "local-development";
};

export type AtlasLocalSessionProfileKey =
  | "buyer-owner"
  | "buyer-finance"
  | "seller-admin"
  | "operator-operator";

export type AtlasLocalSessionProfile = {
  key: AtlasLocalSessionProfileKey;
  label: string;
  workspace: OrganizationKind;
  userEmail: string;
  organizationSlug: string;
  role: MembershipRole;
};

export type AtlasLocalSessionSelection = {
  profileKey: AtlasLocalSessionProfileKey;
  workspace: OrganizationKind;
  userEmail: string;
  organizationSlug: string;
  role: MembershipRole;
  agentId: string | null;
};

export type AtlasWorkspaceAccessDefinition = {
  workspace: OrganizationKind;
  allowedRoles: MembershipRole[];
};

export const atlasWorkspaceAccessDefinitions: Record<OrganizationKind, AtlasWorkspaceAccessDefinition> = {
  BUYER: {
    workspace: "BUYER",
    allowedRoles: ["OWNER", "ADMIN", "OPERATOR", "REVIEWER", "FINANCE"]
  },
  SELLER: {
    workspace: "SELLER",
    allowedRoles: ["OWNER", "ADMIN", "OPERATOR", "REVIEWER", "FINANCE"]
  },
  OPERATOR: {
    workspace: "OPERATOR",
    allowedRoles: ["OWNER", "ADMIN", "OPERATOR"]
  }
};

export const atlasLocalSessionProfiles: Record<AtlasLocalSessionProfileKey, AtlasLocalSessionProfile> = {
  "buyer-owner": {
    key: "buyer-owner",
    label: "Buyer Owner",
    workspace: "BUYER",
    userEmail: "owner@atlas.local",
    organizationSlug: "atlas-demo-buyer",
    role: "OWNER"
  },
  "buyer-finance": {
    key: "buyer-finance",
    label: "Buyer Finance",
    workspace: "BUYER",
    userEmail: "finance@atlas.local",
    organizationSlug: "atlas-demo-buyer",
    role: "FINANCE"
  },
  "seller-admin": {
    key: "seller-admin",
    label: "Seller Admin",
    workspace: "SELLER",
    userEmail: "seller@atlas.local",
    organizationSlug: "atlas-demo-seller",
    role: "ADMIN"
  },
  "operator-operator": {
    key: "operator-operator",
    label: "Operator",
    workspace: "OPERATOR",
    userEmail: "operator@atlas.local",
    organizationSlug: "atlas-demo-operator",
    role: "OPERATOR"
  }
};

export const atlasLocalSessionProfileList = Object.values(atlasLocalSessionProfiles);

export function isAtlasLocalSessionProfileKey(value: string): value is AtlasLocalSessionProfileKey {
  return value in atlasLocalSessionProfiles;
}

export function getAtlasLocalSessionProfile(profileKey: AtlasLocalSessionProfileKey) {
  return atlasLocalSessionProfiles[profileKey];
}

export function getDefaultAtlasLocalSessionProfileForWorkspace(workspace: OrganizationKind) {
  return atlasLocalSessionProfileList.find((profile) => profile.workspace === workspace) ?? null;
}

export function createAtlasLocalSessionSelection(
  profileKey: AtlasLocalSessionProfileKey,
  overrides?: Partial<Pick<AtlasLocalSessionSelection, "agentId">>
) {
  const profile = getAtlasLocalSessionProfile(profileKey);
  return {
    profileKey,
    workspace: profile.workspace,
    userEmail: profile.userEmail,
    organizationSlug: profile.organizationSlug,
    role: profile.role,
    agentId: overrides?.agentId ?? null
  } satisfies AtlasLocalSessionSelection;
}

export function serializeAtlasLocalSessionSelection(selection: AtlasLocalSessionSelection) {
  return encodeURIComponent(JSON.stringify(selection));
}

export function parseAtlasLocalSessionSelection(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<AtlasLocalSessionSelection>;
    if (
      typeof parsed.profileKey !== "string" ||
      !isAtlasLocalSessionProfileKey(parsed.profileKey) ||
      typeof parsed.workspace !== "string" ||
      !isOrganizationKind(parsed.workspace) ||
      typeof parsed.userEmail !== "string" ||
      typeof parsed.organizationSlug !== "string" ||
      typeof parsed.role !== "string" ||
      !isMembershipRole(parsed.role)
    ) {
      return null;
    }

    const agentId = typeof parsed.agentId === "string" ? parsed.agentId : null;

    return {
      profileKey: parsed.profileKey,
      workspace: parsed.workspace,
      userEmail: parsed.userEmail,
      organizationSlug: parsed.organizationSlug,
      role: parsed.role,
      agentId
    } satisfies AtlasLocalSessionSelection;
  } catch {
    return null;
  }
}

export function canAtlasActorAccessWorkspace(
  role: MembershipRole,
  workspace: OrganizationKind,
  organizationKind: OrganizationKind
) {
  if (workspace !== organizationKind) {
    return false;
  }

  return atlasWorkspaceAccessDefinitions[workspace].allowedRoles.includes(role);
}

export function hasAtlasActorRole(role: MembershipRole, expectedRole: MembershipRole) {
  return role === expectedRole;
}

export function hasAtlasActorAnyRole(role: MembershipRole, expectedRoles: MembershipRole[]) {
  return expectedRoles.includes(role);
}

export function formatAtlasWorkspaceLabel(workspace: OrganizationKind) {
  return organizationKindLabels[workspace];
}

export function formatAtlasRoleLabel(role: MembershipRole) {
  return membershipRoleLabels[role];
}
