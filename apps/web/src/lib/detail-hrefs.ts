import type { AtlasWorkspaceSurfaceKey } from "@atlas/domain";
import type { OrganizationKind } from "@atlas/types";

export function getAtlasWorkspaceDetailHref(
  workspace: OrganizationKind,
  surfaceKey: AtlasWorkspaceSurfaceKey,
  recordId: string
) {
  if (workspace === "BUYER" && surfaceKey === "requests") {
    return `/buyer/requests/${recordId}`;
  }

  if (workspace === "BUYER" && surfaceKey === "approvals") {
    return `/buyer/approvals/${recordId}`;
  }

  if (workspace === "BUYER" && surfaceKey === "activity") {
    return `/buyer/activity/${recordId}`;
  }

  if (workspace === "SELLER" && surfaceKey === "requests") {
    return `/seller/requests/${recordId}`;
  }

  if (workspace === "SELLER" && surfaceKey === "payments") {
    return `/seller/payments/${recordId}`;
  }

  if (workspace === "OPERATOR" && surfaceKey === "transactions") {
    return `/operator/transactions/${recordId}`;
  }

  if (workspace === "OPERATOR" && surfaceKey === "audit") {
    return `/operator/audit/${recordId}`;
  }

  return null;
}
