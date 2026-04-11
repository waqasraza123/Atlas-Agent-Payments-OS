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

  if (workspace === "BUYER" && surfaceKey === "receipts") {
    return `/buyer/receipts/${recordId}`;
  }

  if (workspace === "BUYER" && surfaceKey === "activity") {
    return `/buyer/activity/${recordId}`;
  }

  if (workspace === "SELLER" && surfaceKey === "requests") {
    return `/seller/requests/${recordId}`;
  }

  if (workspace === "SELLER" && surfaceKey === "services") {
    return `/seller/services/${recordId}`;
  }

  if (workspace === "SELLER" && surfaceKey === "payments") {
    return `/seller/payments/${recordId}`;
  }

  if (workspace === "OPERATOR" && surfaceKey === "transactions") {
    return `/operator/transactions/${recordId}`;
  }

  if (workspace === "OPERATOR" && surfaceKey === "exceptions") {
    return `/operator/exceptions/${recordId}`;
  }

  if (workspace === "OPERATOR" && surfaceKey === "receipts") {
    return `/operator/receipts/${recordId}`;
  }

  if (workspace === "OPERATOR" && surfaceKey === "audit") {
    return `/operator/audit/${recordId}`;
  }

  return null;
}
