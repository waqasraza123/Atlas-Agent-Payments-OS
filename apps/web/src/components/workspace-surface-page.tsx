import type { AtlasWorkspaceSurfaceDefinition } from "@atlas/domain";
import type { WorkspaceOverviewModel } from "@/lib/server/workspace-data";
import { MetricCard, PageHeader, RecordListPanel, StatusChip } from "@atlas/ui";
import type { RecordListPanelItem } from "@atlas/ui";
import { WorkspaceOverviewPage } from "./workspace-overview-page";

export type WorkspaceSurfacePageModel = {
  surface: AtlasWorkspaceSurfaceDefinition;
  overview: WorkspaceOverviewModel;
  primary: {
    eyebrow: string;
    title: string;
    description: string;
    items: RecordListPanelItem[];
    emptyTitle: string;
    emptyDescription: string;
  };
  moduleAlignment: {
    eyebrow: string;
    title: string;
    description: string;
    items: RecordListPanelItem[];
    emptyTitle: string;
    emptyDescription: string;
  };
  activity: {
    eyebrow: string;
    title: string;
    description: string;
    items: RecordListPanelItem[];
    emptyTitle: string;
    emptyDescription: string;
  };
};

type WorkspaceSurfacePageProps = Readonly<{
  model: WorkspaceSurfacePageModel;
}>;

export function WorkspaceSurfacePage({ model }: WorkspaceSurfacePageProps) {
  if (model.surface.key === "overview") {
    return <WorkspaceOverviewPage model={model} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={model.surface.label}
        title={model.surface.title}
        description={model.surface.description}
        actions={<StatusChip label={model.surface.status} tone={model.surface.status === "available" ? "success" : "warning"} />}
      />
      <section className="grid gap-4 xl:grid-cols-4">
        {model.overview.metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} />
        ))}
      </section>
      <RecordListPanel
        eyebrow={model.primary.eyebrow}
        title={model.primary.title}
        description={model.primary.description}
        items={model.primary.items}
        emptyTitle={model.primary.emptyTitle}
        emptyDescription={model.primary.emptyDescription}
      />
      <RecordListPanel
        eyebrow={model.moduleAlignment.eyebrow}
        title={model.moduleAlignment.title}
        description={model.moduleAlignment.description}
        items={model.moduleAlignment.items}
        emptyTitle={model.moduleAlignment.emptyTitle}
        emptyDescription={model.moduleAlignment.emptyDescription}
      />
      <RecordListPanel
        eyebrow={model.activity.eyebrow}
        title={model.activity.title}
        description={model.activity.description}
        items={model.activity.items}
        emptyTitle={model.activity.emptyTitle}
        emptyDescription={model.activity.emptyDescription}
      />
    </div>
  );
}
