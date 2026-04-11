import { Panel } from "@atlas/ui";

type WorkspaceLoadingStateProps = Readonly<{
  workspaceLabel: string;
}>;

export function WorkspaceLoadingState({ workspaceLabel }: WorkspaceLoadingStateProps) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Panel className="space-y-6 p-6 sm:p-8">
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--atlas-accent)]">{workspaceLabel} loading</p>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--atlas-ink)]">Resolving workspace context</h2>
          <p className="max-w-3xl text-sm leading-7 text-[var(--atlas-muted)] sm:text-base">
            Atlas is resolving the local actor session, loading the workspace shell, and preparing the seeded control-plane view.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            "Actor session",
            "Workspace shell",
            "Seeded lifecycle"
          ].map((label) => (
            <div key={label} className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--atlas-muted)]">{label}</p>
              <div className="mt-4 h-3 w-24 rounded-full bg-white/12" />
              <div className="mt-3 h-3 w-full rounded-full bg-white/8" />
              <div className="mt-2 h-3 w-3/4 rounded-full bg-white/8" />
            </div>
          ))}
        </div>
      </Panel>
    </main>
  );
}
