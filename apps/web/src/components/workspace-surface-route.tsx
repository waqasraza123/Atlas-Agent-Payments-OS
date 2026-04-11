import { getAtlasWorkspaceSurfaceByKey, type AtlasWorkspaceSurfaceKey } from "@atlas/domain";
import type { OrganizationKind } from "@atlas/types";
import { StatePanel } from "@atlas/ui";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { loadWorkspaceSurfaceModel } from "@/lib/server/workspace-surface-data";
import { WorkspaceSurfacePage } from "./workspace-surface-page";

type WorkspaceSurfaceRouteProps = Readonly<{
  workspace: OrganizationKind;
  surfaceKey: AtlasWorkspaceSurfaceKey;
}>;

export async function WorkspaceSurfaceRoute({ workspace, surfaceKey }: WorkspaceSurfaceRouteProps) {
  const resolution = await resolveWorkspaceActor(workspace);

  if (resolution.status !== "ready") {
    return null;
  }

  const surface = getAtlasWorkspaceSurfaceByKey(workspace, surfaceKey);

  if (!surface) {
    throw new Error(`Unknown surface ${surfaceKey} for ${workspace}`);
  }

  try {
    const model = await loadWorkspaceSurfaceModel(resolution.actor, surfaceKey);

    return <WorkspaceSurfacePage model={{ ...model, surface }} />;
  } catch (error) {
    return (
      <StatePanel
        eyebrow={surface.label}
        title="Workspace surface failed to load"
        description={error instanceof Error ? error.message : "Unknown workspace loading failure"}
        tone="error"
      />
    );
  }
}
