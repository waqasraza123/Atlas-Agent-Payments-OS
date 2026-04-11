import type { WorkspaceSurfacePageModel } from "./workspace-surface-page";
import { MetricCard, PageHeader, Panel, RecordListPanel, StatusChip } from "@atlas/ui";

type WorkspaceOverviewPageProps = Readonly<{
  model: WorkspaceSurfacePageModel;
}>;

export function WorkspaceOverviewPage({ model }: WorkspaceOverviewPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${model.surface.label} control plane`}
        title={model.surface.title}
        description={model.surface.description}
        actions={<StatusChip label={model.surface.status} tone={model.surface.status === "available" ? "success" : "warning"} />}
      />
      <section className="grid gap-4 xl:grid-cols-4">
        {model.overview.metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} />
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <RecordListPanel
          eyebrow={model.primary.eyebrow}
          title={model.primary.title}
          description={model.primary.description}
          items={model.primary.items}
          emptyTitle={model.primary.emptyTitle}
          emptyDescription={model.primary.emptyDescription}
        />
        <Panel className="space-y-5 p-6 sm:p-8">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--atlas-accent)]">Demo narrative</p>
            <h2 className="text-2xl font-semibold tracking-tight">{model.surface.detail}</h2>
            <p className="text-sm leading-7 text-[var(--atlas-muted)]">
              Atlas uses real seeded lifecycle state to make the overview legible now, while preserving the durable
              structure that later phases will turn into richer request, payment, and audit workflows.
            </p>
          </div>
          <div className="space-y-3">
            {model.overview.activity.slice(0, 3).map((activity) => (
              <article
                key={activity.id}
                className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 px-5 py-4"
              >
                <h3 className="text-base font-medium">{activity.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--atlas-muted)]">{activity.description}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--atlas-accent-strong)]">{activity.detail}</p>
              </article>
            ))}
          </div>
        </Panel>
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <RecordListPanel
          eyebrow={model.activity.eyebrow}
          title={model.activity.title}
          description={model.activity.description}
          items={model.activity.items}
          emptyTitle={model.activity.emptyTitle}
          emptyDescription={model.activity.emptyDescription}
        />
        <RecordListPanel
          eyebrow={model.moduleAlignment.eyebrow}
          title={model.moduleAlignment.title}
          description={model.moduleAlignment.description}
          items={model.moduleAlignment.items}
          emptyTitle={model.moduleAlignment.emptyTitle}
          emptyDescription={model.moduleAlignment.emptyDescription}
        />
      </section>
    </div>
  );
}
