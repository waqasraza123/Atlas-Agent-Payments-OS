import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { getWorkspaceEmptyStateDescription, loadWorkspaceOverviewModel } from "@/lib/server/workspace-data";
import { MetricCard, Panel, StatePanel } from "@atlas/ui";

export default async function OperatorPage() {
  const resolution = await resolveWorkspaceActor("OPERATOR");

  if (resolution.status !== "ready") {
    return null;
  }

  const overview = await loadWorkspaceOverviewModel(resolution.actor);

  return (
    <div className="space-y-6">
      <section id="overview" className="grid gap-4 xl:grid-cols-4">
        {overview.metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} />
        ))}
      </section>

      <section id="context">
        <Panel className="space-y-4 p-6 sm:p-8">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--atlas-muted)]">Context boundary</p>
          <h2 className="text-2xl font-semibold tracking-tight">Operator identity is now treated as a first-class boundary</h2>
          <p className="text-sm leading-7 text-[var(--atlas-muted)] sm:text-base">
            Atlas keeps operator access separate from buyer and seller workspaces, with an explicit
            role check before the oversight shell is rendered.
          </p>
        </Panel>
      </section>

      <section id="activity">
        <Panel className="space-y-4 p-6 sm:p-8">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--atlas-muted)]">Recent lifecycle</p>
            <h2 className="text-2xl font-semibold tracking-tight">Operator-facing activity</h2>
          </div>
          {overview.activity.length > 0 ? (
            <div className="space-y-3">
              {overview.activity.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 px-5 py-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-base font-medium text-[var(--atlas-ink)]">{item.title}</p>
                      <p className="text-sm leading-6 text-[var(--atlas-muted)]">{item.description}</p>
                    </div>
                    <p className="text-sm leading-6 text-[var(--atlas-muted)]">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <StatePanel
              eyebrow="Operator activity"
              title="No operator activity yet"
              description={getWorkspaceEmptyStateDescription("OPERATOR")}
            />
          )}
        </Panel>
      </section>
    </div>
  );
}
