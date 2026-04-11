import type { ReactNode } from "react";
import { Panel } from "./panel";
import { StatePanel } from "./state-panel";
import { StatusChip } from "./status-chip";

export type RecordListPanelItem = {
  id: string;
  title: string;
  description: string;
  detail: string;
  href?: string;
  hrefLabel?: string;
  statusLabel?: string;
  statusTone?: "default" | "success" | "warning" | "critical";
};

type RecordListPanelProps = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  items: RecordListPanelItem[];
  emptyTitle: string;
  emptyDescription: string;
  actions?: ReactNode;
}>;

export function RecordListPanel({
  eyebrow,
  title,
  description,
  items,
  emptyTitle,
  emptyDescription,
  actions
}: RecordListPanelProps) {
  return (
    <Panel className="space-y-5 p-6 sm:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--atlas-muted)]">{eyebrow}</p>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            <p className="max-w-3xl text-sm leading-7 text-[var(--atlas-muted)] sm:text-base">{description}</p>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 px-5 py-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.href ? (
                      <a
                        href={item.href}
                        className="text-base font-medium text-[var(--atlas-ink)] transition hover:text-[var(--atlas-accent-strong)]"
                      >
                        {item.title}
                      </a>
                    ) : (
                      <h3 className="text-base font-medium text-[var(--atlas-ink)]">{item.title}</h3>
                    )}
                    {item.statusLabel ? (
                      <StatusChip label={item.statusLabel} tone={item.statusTone} />
                    ) : null}
                  </div>
                  <p className="text-sm leading-6 text-[var(--atlas-muted)]">{item.description}</p>
                </div>
                <div className="space-y-2 text-right">
                  <p className="text-sm leading-6 text-[var(--atlas-muted)]">{item.detail}</p>
                  {item.href ? (
                    <a
                      href={item.href}
                      className="inline-flex text-sm font-medium text-[var(--atlas-accent-strong)] transition hover:text-[var(--atlas-ink)]"
                    >
                      {item.hrefLabel ?? "Open detail"}
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <StatePanel eyebrow={eyebrow} title={emptyTitle} description={emptyDescription} />
      )}
    </Panel>
  );
}
