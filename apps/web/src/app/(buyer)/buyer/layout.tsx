import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { atlasWorkspaceDefinitions } from "@/lib/workspace-config";
import { WorkspaceDeniedState, WorkspaceShell } from "@/components/workspace-shell";
import type { ReactNode } from "react";

type BuyerLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function BuyerLayout({ children }: BuyerLayoutProps) {
  const workspace = atlasWorkspaceDefinitions.BUYER;
  const resolution = await resolveWorkspaceActor("BUYER");

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
        workspaceLabel="Buyer"
        path={workspace.path}
        profiles={resolution.profiles}
        title="Buyer context could not be resolved"
        description={`Atlas could not load the local buyer session. ${resolution.message}`}
      />
    );
  }

  return (
    <WorkspaceDeniedState
      workspaceLabel="Buyer"
      path={workspace.path}
      profiles={resolution.profiles}
      title={resolution.status === "forbidden" ? "Buyer access is blocked for this session" : "Choose a buyer session to continue"}
      description={
        resolution.status === "forbidden"
          ? "The active local session belongs to a different workspace or role boundary. Switch to a buyer session to continue."
          : "Atlas uses a local-first development session. Pick a seeded buyer profile to continue."
      }
    />
  );
}
