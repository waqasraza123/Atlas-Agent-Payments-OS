import { StatePanel } from "@atlas/ui";

type WorkspaceLoadingStateProps = Readonly<{
  workspaceLabel: string;
}>;

export function WorkspaceLoadingState({ workspaceLabel }: WorkspaceLoadingStateProps) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <StatePanel
        eyebrow={`${workspaceLabel} loading`}
        title="Resolving workspace context"
        description="Atlas is resolving the local actor session and loading the workspace shell."
      />
    </main>
  );
}
