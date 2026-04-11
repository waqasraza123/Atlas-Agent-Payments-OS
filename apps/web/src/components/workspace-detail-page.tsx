import type { WorkspaceDetailModel } from "@/lib/server/workspace-detail-data";
import { DetailGrid, MetricCard, PageHeader, RecordListPanel, StatusChip, TimelinePanel } from "@atlas/ui";

type WorkspaceDetailPageProps = Readonly<{
  model: WorkspaceDetailModel;
}>;

export function WorkspaceDetailPage({ model }: WorkspaceDetailPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={model.eyebrow}
        title={model.title}
        description={model.description}
        actions={<StatusChip label={model.statusLabel} tone={model.statusTone} />}
      />
      <section className="grid gap-4 xl:grid-cols-4">
        {model.metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} />
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <DetailGrid
          eyebrow="Record context"
          title="Structured detail"
          description="This record stays explainable because the important identifiers, actors, and organizations remain explicit."
          items={model.facts}
        />
        <DetailGrid
          eyebrow={model.preview.eyebrow}
          title={model.preview.title}
          description={model.preview.description}
          items={model.preview.items}
          emptyTitle={model.preview.emptyTitle}
          emptyDescription={model.preview.emptyDescription}
        />
      </section>
      <TimelinePanel
        eyebrow={model.timeline.eyebrow}
        title={model.timeline.title}
        description={model.timeline.description}
        items={model.timeline.items}
        emptyTitle={model.timeline.emptyTitle}
        emptyDescription={model.timeline.emptyDescription}
      />
      <RecordListPanel
        eyebrow={model.related.eyebrow}
        title={model.related.title}
        description={model.related.description}
        items={model.related.items}
        emptyTitle={model.related.emptyTitle}
        emptyDescription={model.related.emptyDescription}
      />
    </div>
  );
}
