import { getAtlasWorkspaceSurfaceByKey, type AtlasWorkspaceSurfaceKey } from "@atlas/domain";
import { StatePanel } from "@atlas/ui";
import type { OrganizationKind } from "@atlas/types";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { loadWorkspaceDetailModel } from "@/lib/server/workspace-detail-data";
import { WorkspaceDetailPage } from "./workspace-detail-page";

type WorkspaceDetailRouteProps = Readonly<{
  workspace: OrganizationKind;
  surfaceKey: AtlasWorkspaceSurfaceKey;
  recordId: string;
}>;

export async function WorkspaceDetailRoute({ workspace, surfaceKey, recordId }: WorkspaceDetailRouteProps) {
  const resolution = await resolveWorkspaceActor(workspace);

  if (resolution.status !== "ready") {
    return null;
  }

  const surface = getAtlasWorkspaceSurfaceByKey(workspace, surfaceKey);

  if (!surface) {
    throw new Error(`Unknown surface ${surfaceKey} for ${workspace}`);
  }

  try {
    const model = await loadWorkspaceDetailModel(resolution.actor, surfaceKey, recordId);

    if (!model) {
      return (
        <StatePanel
          eyebrow={`${surface.label} detail`}
          title="Record not available in this workspace"
          description={`Atlas could not find a ${surface.label.toLowerCase()} record with access from the current ${workspace.toLowerCase()} context.`}
          tone="warning"
        />
      );
    }

    return <WorkspaceDetailPage model={model} />;
  } catch (error) {
    return (
      <StatePanel
        eyebrow={`${surface.label} detail`}
        title="Detail view failed to load"
        description={error instanceof Error ? error.message : "Unknown detail loading failure"}
        tone="error"
      />
    );
  }
}
