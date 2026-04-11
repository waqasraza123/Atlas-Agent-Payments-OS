import type { ReactNode } from "react";

type TopBarProps = Readonly<{
  title: string;
  subtitle: string;
  children?: ReactNode;
}>;

export function TopBar({ title, subtitle, children }: TopBarProps) {
  return (
    <section className="flex flex-col gap-4 rounded-[28px] border border-[var(--atlas-line)] bg-[rgba(7,14,28,0.72)] px-5 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--atlas-muted)]">{subtitle}</p>
        <p className="text-lg font-medium text-[var(--atlas-ink)]">{title}</p>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </section>
  );
}
