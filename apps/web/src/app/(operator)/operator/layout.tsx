import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { atlasWorkspaceDefinitions } from "@/lib/workspace-config";
import { WorkspaceDeniedState, WorkspaceShell } from "@/components/workspace-shell";
import type { ReactNode } from "react";

type OperatorLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function OperatorLayout({ children }: OperatorLayoutProps) {
  const workspace = atlasWorkspaceDefinitions.OPERATOR;
  const resolution = await resolveWorkspaceActor("OPERATOR");

  if (resolution.status === "ready") {
    return (
      <WorkspaceShell
        actor={resolution.actor}
        title={workspace.title}
        subtitle={workspace.subtitle}
        description={workspace.description}
        path={workspace.path}
        items={workspace.sections}
        profiles={resolution.profiles}
      >
        {children}
      </WorkspaceShell>
    );
  }

  if (resolution.status === "error") {
    return (
      <WorkspaceDeniedState
        workspaceLabel="Operator"
        path={workspace.path}
        profiles={resolution.profiles}
        title="Operator context could not be resolved"
        description={`Atlas could not load the local operator session. ${resolution.message}`}
      />
    );
  }

  return (
    <WorkspaceDeniedState
      workspaceLabel="Operator"
      path={workspace.path}
      profiles={resolution.profiles}
      title={resolution.status === "forbidden" ? "Operator access is blocked for this session" : "Choose an operator session to continue"}
      description={
        resolution.status === "forbidden"
          ? "The active local session belongs to a different workspace or role boundary. Switch to an operator session to continue."
          : "Atlas uses a local-first development session. Pick a seeded operator profile to continue."
      }
    />
  );
}
