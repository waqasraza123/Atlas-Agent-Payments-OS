import type { ReactNode } from "react";

type StatePanelTone = "default" | "warning" | "error";

type StatePanelProps = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  tone?: StatePanelTone;
  actions?: ReactNode;
}>;

const toneClassNames: Record<StatePanelTone, string> = {
  default: "border-[var(--atlas-line)] bg-[var(--atlas-panel)]",
  warning: "border-[rgba(203,230,122,0.35)] bg-[rgba(46,52,20,0.4)]",
  error: "border-[rgba(255,126,126,0.35)] bg-[rgba(58,19,19,0.42)]"
};

export function StatePanel({
  eyebrow,
  title,
  description,
  tone = "default",
  actions
}: StatePanelProps) {
  return (
    <section
      className={[
        "rounded-[28px] border p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur sm:p-8",
        toneClassNames[tone]
      ].join(" ")}
    >
      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--atlas-muted)]">{eyebrow}</p>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--atlas-ink)]">{title}</h2>
        <p className="max-w-3xl text-sm leading-7 text-[var(--atlas-muted)] sm:text-base">{description}</p>
      </div>
      {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}
    </section>
  );
}
