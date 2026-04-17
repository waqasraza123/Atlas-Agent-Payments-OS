import {
  listWorkspaceSurfacePrimaryItemsForActor,
  type AtlasWorkspaceListItemRecord
} from "@atlas/database";
import {
  getAtlasWorkspaceSurfaceByKey,
  listAtlasApiDomainDefinitionsForWorkspace,
  type AtlasWorkspaceSurfaceKey
} from "@atlas/domain";
import type { AtlasActorContext } from "@atlas/auth";
import type { OrganizationKind } from "@atlas/types";
import type { RecordListPanelItem } from "@atlas/ui";
import { getWorkspaceEmptyStateDescription, loadWorkspaceOverviewModel, type WorkspaceOverviewModel } from "./workspace-data";
import { auditWorkspaceSurfaceInspection } from "./tenant-read-audit";
import { getAtlasWorkspaceDetailHref } from "@/lib/detail-hrefs";

export type WorkspaceSurfaceModel = {
  surfaceKey: AtlasWorkspaceSurfaceKey;
  overview: WorkspaceOverviewModel;
  primary: {
    eyebrow: string;
    title: string;
    description: string;
    items: RecordListPanelItem[];
    emptyTitle: string;
    emptyDescription: string;
  };
  moduleAlignment: {
    eyebrow: string;
    title: string;
    description: string;
    items: RecordListPanelItem[];
    emptyTitle: string;
    emptyDescription: string;
  };
  activity: {
    eyebrow: string;
    title: string;
    description: string;
    items: RecordListPanelItem[];
    emptyTitle: string;
    emptyDescription: string;
  };
};

function createModuleAlignmentItems(workspace: OrganizationKind): RecordListPanelItem[] {
  return listAtlasApiDomainDefinitionsForWorkspace(workspace).map((definition) => ({
    id: definition.key,
    title: definition.title,
    description: definition.description,
    detail: `${definition.routePrefix} · ${definition.nextPhase}`,
    statusLabel: definition.readiness,
    statusTone: definition.readiness === "skeleton" ? "success" : "warning"
  }));
}

function mapPrimaryItem(actor: AtlasActorContext, item: AtlasWorkspaceListItemRecord): RecordListPanelItem {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    detail: item.detail,
    href: item.detailSurfaceKey ? getAtlasWorkspaceDetailHref(actor.workspace, item.detailSurfaceKey, item.id) ?? undefined : undefined,
    statusLabel: item.statusLabel,
    statusTone: item.statusTone
  };
}

function createSurfaceDescriptions(workspace: OrganizationKind, surfaceKey: AtlasWorkspaceSurfaceKey) {
  if (workspace === "BUYER") {
    return {
      primary: {
        eyebrow: "Buyer surface",
        title: surfaceKey === "overview" ? "Buyer command view" : "Buyer workspace data",
        description:
          surfaceKey === "overview"
            ? "The buyer overview now reads like a real control center: active agents, sellers, pending decisions, and seeded lifecycle pressure in one place."
            : surfaceKey === "receipts"
              ? "The buyer receipt surface now keeps durable evidence, payment posture, and receipt availability legible without collapsing the underlying lifecycle."
              : "This shell uses current seeded buyer data and the durable route structure that later buyer workflows will inherit.",
        emptyTitle: "No buyer records available",
        emptyDescription: getWorkspaceEmptyStateDescription("BUYER")
      },
      moduleAlignment: {
        eyebrow: "API module alignment",
        title: "Buyer-facing API boundaries",
        description: "The buyer workspace now maps directly to explicit API module skeletons instead of a single placeholder surface.",
        emptyTitle: "No buyer modules are registered",
        emptyDescription: "Buyer domain modules will appear here once the API registry changes."
      },
      activity: {
        eyebrow: surfaceKey === "activity" ? "Audit posture" : "Recent lifecycle",
        title: surfaceKey === "activity" ? "Buyer audit flow" : "Recent buyer activity",
        description:
          surfaceKey === "overview"
            ? "Recent activity shows the buyer-side narrative that Phase 2 will turn into deeper request, approval, and policy detail surfaces."
            : "Recent lifecycle data remains grounded in the schema and will later feed request and approval detail views.",
        emptyTitle: "No buyer activity yet",
        emptyDescription: getWorkspaceEmptyStateDescription("BUYER")
      }
    };
  }

  if (workspace === "SELLER") {
    return {
      primary: {
        eyebrow: "Seller surface",
        title: surfaceKey === "overview" ? "Seller operating view" : "Seller workspace data",
        description:
          surfaceKey === "overview"
            ? "The seller overview now highlights inbound demand, customer concentration, payment posture, and the delivery boundary Atlas is preparing."
            : "This shell keeps the seller-side route map durable while staying grounded in current seeded request and payment state.",
        emptyTitle: "No seller records available",
        emptyDescription: getWorkspaceEmptyStateDescription("SELLER")
      },
      moduleAlignment: {
        eyebrow: "API module alignment",
        title: "Seller-facing API boundaries",
        description: "The seller workspace now points at explicit service, request, payment, and receipt module boundaries.",
        emptyTitle: "No seller modules are registered",
        emptyDescription: "Seller domain modules will appear here once the API registry changes."
      },
      activity: {
        eyebrow: surfaceKey === "payments" ? "Settlement posture" : "Recent lifecycle",
        title: surfaceKey === "payments" ? "Seller-side lifecycle evidence" : "Recent seller activity",
        description:
          surfaceKey === "overview"
            ? "Seller activity keeps the demo grounded in buyer demand, payment state, and the future webhook-driven delivery model."
            : "The seller shell now exposes durable surfaces for future fulfillment, payout, and webhook behavior.",
        emptyTitle: "No seller activity yet",
        emptyDescription: getWorkspaceEmptyStateDescription("SELLER")
      }
    };
  }

  return {
    primary: {
      eyebrow: "Operator surface",
      title: surfaceKey === "overview" ? "Operator trust center" : "Operator workspace data",
      description:
        surfaceKey === "overview"
          ? "The operator overview now reads like a true trust surface: organizations, pending decisions, failures, and queue-backed system posture."
          : "This shell keeps oversight routes durable while using current organization, request, approval, and audit records.",
      emptyTitle: "No operator records available",
      emptyDescription: getWorkspaceEmptyStateDescription("OPERATOR")
    },
    moduleAlignment: {
      eyebrow: "API module alignment",
      title: "Operator-facing API boundaries",
      description: "The operator workspace now maps directly to organizations, approvals, audit, and operator-control modules.",
      emptyTitle: "No operator modules are registered",
      emptyDescription: "Operator module registrations will appear here once the API registry changes."
    },
    activity: {
      eyebrow: surfaceKey === "exceptions" ? "Exception posture" : "Recent lifecycle",
      title: surfaceKey === "audit" ? "Audit-heavy activity" : "Recent operator activity",
      description:
        surfaceKey === "overview"
          ? "Operator activity keeps the demo grounded in real failures, pending decisions, and cross-entity oversight."
          : surfaceKey === "receipts"
            ? "The operator receipt surface keeps payment evidence and receipt availability visible across organizations for later investigation flows."
            : "The operator shell is now anchored to real route boundaries for later exception handling and audit exploration.",
      emptyTitle: "No operator activity yet",
      emptyDescription: getWorkspaceEmptyStateDescription("OPERATOR")
    }
  };
}

export async function loadWorkspaceSurfaceModel(
  actor: AtlasActorContext,
  surfaceKey: AtlasWorkspaceSurfaceKey
): Promise<WorkspaceSurfaceModel> {
  const surface = getAtlasWorkspaceSurfaceByKey(actor.workspace, surfaceKey);

  if (!surface) {
    throw new Error(`Unknown workspace surface ${surfaceKey} for ${actor.workspace}`);
  }

  const [overview, moduleAlignmentItems, primaryItems] = await Promise.all([
    loadWorkspaceOverviewModel(actor),
    Promise.resolve(createModuleAlignmentItems(actor.workspace)),
    listWorkspaceSurfacePrimaryItemsForActor(actor, surfaceKey).then((items) => items.map((item) => mapPrimaryItem(actor, item)))
  ]);

  const descriptions = createSurfaceDescriptions(actor.workspace, surfaceKey);
  const activityItems = surfaceKey === "overview" ? overview.activity : primaryItems;

  await auditWorkspaceSurfaceInspection(actor, {
    surfaceKey,
    primaryItemCount: primaryItems.length,
    activityItemCount: activityItems.length
  });

  return {
    surfaceKey,
    overview,
    primary: {
      ...descriptions.primary,
      items: primaryItems
    },
    moduleAlignment: {
      ...descriptions.moduleAlignment,
      items: moduleAlignmentItems
    },
    activity: {
      ...descriptions.activity,
      items: activityItems
    }
  };
}
