import type { ReactNode } from "react";
import { Panel } from "@atlas/ui";

type FilterPanelProps = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  submitLabel: string;
  children: ReactNode;
}>;

export function FilterPanel({ eyebrow, title, description, submitLabel, children }: FilterPanelProps) {
  return (
    <Panel className="space-y-5 p-6 sm:p-8">
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--atlas-accent)]">{eyebrow}</p>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm leading-7 text-[var(--atlas-muted)]">{description}</p>
      </div>
      <form className="grid gap-4 md:grid-cols-4">
        {children}
        <div className="md:col-span-4 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center rounded-full border border-[var(--atlas-accent-strong)] bg-[var(--atlas-accent)] px-5 py-2.5 text-sm font-medium text-[var(--atlas-ink)] transition hover:border-[var(--atlas-ink)] hover:bg-[var(--atlas-accent-strong)]"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </Panel>
  );
}

