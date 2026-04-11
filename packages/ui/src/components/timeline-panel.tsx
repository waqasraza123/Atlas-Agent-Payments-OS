import { Panel } from "./panel";
import { StatePanel } from "./state-panel";
import { StatusChip } from "./status-chip";

export type TimelinePanelItem = {
  id: string;
  label: string;
  title: string;
  description: string;
  detail: string;
  statusLabel?: string;
  tone?: "default" | "success" | "warning" | "critical";
};

type TimelinePanelProps = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  items: TimelinePanelItem[];
  emptyTitle?: string;
  emptyDescription?: string;
}>;

export function TimelinePanel({
  eyebrow,
  title,
  description,
  items,
  emptyTitle = "No lifecycle events available",
  emptyDescription = "Atlas will render the request lifecycle here once there are related records."
}: TimelinePanelProps) {
  if (items.length === 0) {
    return <StatePanel eyebrow={eyebrow} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <Panel className="space-y-5 p-6 sm:p-8">
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--atlas-muted)]">{eyebrow}</p>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="max-w-3xl text-sm leading-7 text-[var(--atlas-muted)] sm:text-base">{description}</p>
      </div>
      <div className="space-y-4">
        {items.map((item, index) => (
          <article key={item.id} className="grid grid-cols-[auto_1fr] gap-4">
            <div className="flex flex-col items-center">
              <span className="mt-1 h-3 w-3 rounded-full bg-[var(--atlas-accent-strong)]" />
              {index < items.length - 1 ? <span className="mt-2 min-h-[64px] w-px bg-[var(--atlas-line)]" /> : null}
            </div>
            <div className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--atlas-muted)]">{item.label}</p>
                    {item.statusLabel ? <StatusChip label={item.statusLabel} tone={item.tone} /> : null}
                  </div>
                  <h3 className="text-base font-medium text-[var(--atlas-ink)]">{item.title}</h3>
                  <p className="text-sm leading-6 text-[var(--atlas-muted)]">{item.description}</p>
                </div>
                <p className="text-sm leading-6 text-[var(--atlas-accent-strong)]">{item.detail}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}
