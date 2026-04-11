import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { getAtlasWorkspaceShellDefinition } from "@/lib/workspace-config";
import { formatAtlasWorkspaceLabel } from "@atlas/auth";
import type { OrganizationKind } from "@atlas/types";
import type { ReactNode } from "react";
import { WorkspaceDeniedState, WorkspaceShell } from "./workspace-shell";

type WorkspaceLayoutProps = Readonly<{
  workspace: OrganizationKind;
  currentPath: string;
  children: ReactNode;
}>;

export async function WorkspaceLayout({ workspace, currentPath, children }: WorkspaceLayoutProps) {
  const shell = getAtlasWorkspaceShellDefinition(workspace, currentPath);
  const resolution = await resolveWorkspaceActor(workspace);
  const workspaceLabel = formatAtlasWorkspaceLabel(workspace);

  if (resolution.status === "ready") {
    return (
      <WorkspaceShell
        actor={resolution.actor}
        title={shell.title}
        subtitle={shell.subtitle}
        description={shell.description}
        path={shell.path}
        items={shell.sections}
        profiles={resolution.profiles}
      >
        {children}
      </WorkspaceShell>
    );
  }

  if (resolution.status === "error") {
    return (
      <WorkspaceDeniedState
        workspaceLabel={workspaceLabel}
        path={shell.path}
        profiles={resolution.profiles}
        title={`${workspaceLabel} context could not be resolved`}
        description={`Atlas could not load the local ${workspaceLabel.toLowerCase()} session. ${resolution.message}`}
      />
    );
  }

  return (
    <WorkspaceDeniedState
      workspaceLabel={workspaceLabel}
      path={shell.path}
      profiles={resolution.profiles}
      title={
        resolution.status === "forbidden"
          ? `${workspaceLabel} access is blocked for this session`
          : `Choose a ${workspaceLabel.toLowerCase()} session to continue`
      }
      description={
        resolution.status === "forbidden"
          ? `The active local session belongs to a different workspace or role boundary. Switch to a ${workspaceLabel.toLowerCase()} session to continue.`
          : `Atlas uses a local-first development session. Pick a seeded ${workspaceLabel.toLowerCase()} profile to continue.`
      }
    />
  );
}
