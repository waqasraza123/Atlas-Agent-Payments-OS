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
export const atlasSupportAccessMode = "read-only";
export const atlasSignedSessionVersion = 1;
export const atlasSupportAllowedMethods = ["GET", "HEAD", "OPTIONS"] as const;

export type AtlasSessionSource = "local-development" | "internal-support";

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

export type AtlasSupportAccessTargetWorkspace = Exclude<OrganizationKind, "OPERATOR">;

export type AtlasSupportAccessRecord = {
  mode: typeof atlasSupportAccessMode;
  reason: string;
  grantedByUserEmail: string;
  targetOrganizationSlug: string;
  targetWorkspace: AtlasSupportAccessTargetWorkspace;
};

export type AtlasActorContext = {
  user: AtlasActorUser;
  organization: AtlasActorOrganization;
  membership: AtlasActorMembership;
  workspace: OrganizationKind;
  agentId: string | null;
  source: AtlasSessionSource;
  principalOrganization?: AtlasActorOrganization | null;
  supportAccess?: AtlasSupportAccessRecord | null;
  sessionIssuedAt?: string;
  sessionExpiresAt?: string;
};

export type AtlasLocalSessionProfileKey =
  | "buyer-owner"
  | "buyer-admin"
  | "buyer-finance"
  | "seller-admin"
  | "operator-admin"
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

export type AtlasSignedSessionPayload = {
  version: typeof atlasSignedSessionVersion;
  source: AtlasSessionSource;
  issuedAt: string;
  expiresAt: string;
  selection: AtlasLocalSessionSelection;
  supportAccess: AtlasSupportAccessRecord | null;
};

export type AtlasSupportAccessGrantInput = {
  targetOrganizationSlug: string;
  targetWorkspace: AtlasSupportAccessTargetWorkspace;
  reason: string;
  grantedByUserEmail: string;
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
  "buyer-admin": {
    key: "buyer-admin",
    label: "Buyer Admin",
    workspace: "BUYER",
    userEmail: "buyer-admin@atlas.local",
    organizationSlug: "atlas-demo-buyer",
    role: "ADMIN"
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
  "operator-admin": {
    key: "operator-admin",
    label: "Operator Admin",
    workspace: "OPERATOR",
    userEmail: "operator-admin@atlas.local",
    organizationSlug: "atlas-demo-operator",
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

function isAtlasSupportTargetWorkspace(value: string): value is AtlasSupportAccessTargetWorkspace {
  return value === "BUYER" || value === "SELLER";
}

export function isAtlasSupportAccessRecord(value: unknown): value is AtlasSupportAccessRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<AtlasSupportAccessRecord>;
  return (
    candidate.mode === atlasSupportAccessMode &&
    typeof candidate.reason === "string" &&
    candidate.reason.trim().length > 0 &&
    typeof candidate.grantedByUserEmail === "string" &&
    candidate.grantedByUserEmail.trim().length > 0 &&
    typeof candidate.targetOrganizationSlug === "string" &&
    candidate.targetOrganizationSlug.trim().length > 0 &&
    typeof candidate.targetWorkspace === "string" &&
    isAtlasSupportTargetWorkspace(candidate.targetWorkspace)
  );
}

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

    return {
      profileKey: parsed.profileKey,
      workspace: parsed.workspace,
      userEmail: parsed.userEmail,
      organizationSlug: parsed.organizationSlug,
      role: parsed.role,
      agentId: typeof parsed.agentId === "string" ? parsed.agentId : null
    } satisfies AtlasLocalSessionSelection;
  } catch {
    return null;
  }
}

export function createAtlasSupportAccessRecord(input: AtlasSupportAccessGrantInput): AtlasSupportAccessRecord {
  return {
    mode: atlasSupportAccessMode,
    reason: input.reason.trim(),
    grantedByUserEmail: input.grantedByUserEmail.trim().toLowerCase(),
    targetOrganizationSlug: input.targetOrganizationSlug.trim(),
    targetWorkspace: input.targetWorkspace
  };
}

export function createAtlasSignedSessionPayload(
  selection: AtlasLocalSessionSelection,
  options?: {
    source?: AtlasSessionSource;
    issuedAt?: string;
    expiresAt?: string;
    supportAccess?: AtlasSupportAccessRecord | null;
  }
) {
  const issuedAt = options?.issuedAt ?? new Date().toISOString();
  const expiresAt = options?.expiresAt ?? new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  const source = options?.source ?? "local-development";
  const supportAccess = source === "internal-support" ? options?.supportAccess ?? null : null;

  return {
    version: atlasSignedSessionVersion,
    source,
    issuedAt,
    expiresAt,
    selection,
    supportAccess
  } satisfies AtlasSignedSessionPayload;
}

export function isAtlasSupportAccessActor(actor: AtlasActorContext) {
  return actor.source === "internal-support" && actor.supportAccess?.mode === atlasSupportAccessMode;
}

export function canAtlasSupportAccessMethod(method: string) {
  return atlasSupportAllowedMethods.includes(method.toUpperCase() as (typeof atlasSupportAllowedMethods)[number]);
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
