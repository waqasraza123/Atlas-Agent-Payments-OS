import { Panel, StatusChip } from "@atlas/ui";
import type { AtlasDemoScenarioCard } from "@/lib/demo-scenarios";

type DemoScenarioPanelProps = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  items: AtlasDemoScenarioCard[];
}>;

export function DemoScenarioPanel({ eyebrow, title, description, items }: DemoScenarioPanelProps) {
  return (
    <Panel className="space-y-5 p-6 sm:p-8">
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--atlas-accent)]">{eyebrow}</p>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="max-w-3xl text-sm leading-7 text-[var(--atlas-muted)] sm:text-base">{description}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => (
          <a
            key={item.key}
            href={item.href}
            className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 p-5 transition hover:border-[var(--atlas-accent)] hover:bg-white/8"
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-lg font-medium text-[var(--atlas-ink)]">{item.title}</p>
                <StatusChip label={item.statusLabel} tone={item.statusTone} />
              </div>
              <p className="text-sm leading-7 text-[var(--atlas-muted)]">{item.description}</p>
              <p className="text-sm leading-6 text-[var(--atlas-accent-strong)]">{item.detail}</p>
            </div>
          </a>
        ))}
      </div>
    </Panel>
  );
}
