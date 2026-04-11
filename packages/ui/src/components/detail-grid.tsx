import { Panel } from "./panel";
import { StatePanel } from "./state-panel";

export type DetailGridItem = {
  label: string;
  value: string;
  detail?: string;
};

type DetailGridProps = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  items: DetailGridItem[];
  emptyTitle?: string;
  emptyDescription?: string;
}>;

export function DetailGrid({
  eyebrow,
  title,
  description,
  items,
  emptyTitle = "No detail available",
  emptyDescription = "Atlas will show structured detail here once the underlying record is available."
}: DetailGridProps) {
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
      <dl className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={`${item.label}:${item.value}`}
            className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 px-5 py-4"
          >
            <dt className="text-[11px] uppercase tracking-[0.24em] text-[var(--atlas-muted)]">{item.label}</dt>
            <dd className="mt-3 text-lg font-medium text-[var(--atlas-ink)]">{item.value}</dd>
            {item.detail ? <p className="mt-2 text-sm leading-6 text-[var(--atlas-muted)]">{item.detail}</p> : null}
          </div>
        ))}
      </dl>
    </Panel>
  );
}
