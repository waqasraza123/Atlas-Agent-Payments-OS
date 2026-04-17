import {
  getWorkspaceOverviewForActor,
  type AtlasWorkspaceListItemRecord
} from "@atlas/database";
import type { AtlasActorContext } from "@atlas/auth";
import type { OrganizationKind } from "@atlas/types";
import { getAtlasWorkspaceDetailHref } from "@/lib/detail-hrefs";

export type WorkspaceMetric = {
  label: string;
  value: string;
  detail: string;
};

export type WorkspaceActivityItem = {
  id: string;
  title: string;
  description: string;
  detail: string;
  href?: string;
};

export type WorkspaceOverviewModel = {
  metrics: WorkspaceMetric[];
  activity: WorkspaceActivityItem[];
};

function mapWorkspaceActivityItem(actor: AtlasActorContext, item: AtlasWorkspaceListItemRecord): WorkspaceActivityItem {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    detail: item.detail,
    href: item.detailSurfaceKey ? getAtlasWorkspaceDetailHref(actor.workspace, item.detailSurfaceKey, item.id) ?? undefined : undefined
  };
}

export async function loadWorkspaceOverviewModel(
  actor: AtlasActorContext
): Promise<WorkspaceOverviewModel> {
  const overview = await getWorkspaceOverviewForActor(actor);

  return {
    metrics: overview.metrics,
    activity: overview.activity.map((item) => mapWorkspaceActivityItem(actor, item))
  };
}

export function getWorkspaceEmptyStateDescription(workspace: OrganizationKind) {
  if (workspace === "BUYER") {
    return "Seed buyer data will appear here once local seed data is available.";
  }

  if (workspace === "SELLER") {
    return "Seller-side inbound activity will appear here once seeded requests target this org.";
  }

  return "Operator-facing audit and exception signals will appear here once seeded lifecycle events exist.";
}
