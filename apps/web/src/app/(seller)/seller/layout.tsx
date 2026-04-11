import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { atlasWorkspaceDefinitions } from "@/lib/workspace-config";
import { WorkspaceDeniedState, WorkspaceShell } from "@/components/workspace-shell";
import type { ReactNode } from "react";

type SellerLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function SellerLayout({ children }: SellerLayoutProps) {
  const workspace = atlasWorkspaceDefinitions.SELLER;
  const resolution = await resolveWorkspaceActor("SELLER");

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
        workspaceLabel="Seller"
        path={workspace.path}
        profiles={resolution.profiles}
        title="Seller context could not be resolved"
        description={`Atlas could not load the local seller session. ${resolution.message}`}
      />
    );
  }

  return (
    <WorkspaceDeniedState
      workspaceLabel="Seller"
      path={workspace.path}
      profiles={resolution.profiles}
      title={resolution.status === "forbidden" ? "Seller access is blocked for this session" : "Choose a seller session to continue"}
      description={
        resolution.status === "forbidden"
          ? "The active local session belongs to a different workspace or role boundary. Switch to a seller session to continue."
          : "Atlas uses a local-first development session. Pick a seeded seller profile to continue."
      }
    />
  );
}
