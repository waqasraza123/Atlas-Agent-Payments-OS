import type { ReactNode } from "react";

export type SidebarNavItem = {
  href: string;
  label: string;
  description: string;
  current?: boolean;
};

type SidebarNavProps = Readonly<{
  title: string;
  subtitle: string;
  items: SidebarNavItem[];
  footer?: ReactNode;
}>;

export function SidebarNav({ title, subtitle, items, footer }: SidebarNavProps) {
  return (
    <div className="flex h-full flex-col gap-4 rounded-[32px] border border-[var(--atlas-line)] bg-[var(--atlas-panel)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur">
      <div className="space-y-2 border-b border-[var(--atlas-line)] pb-4">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--atlas-accent)]">{subtitle}</p>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--atlas-ink)]">{title}</h2>
      </div>
      <nav className="space-y-2">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={[
              "block rounded-[24px] border px-4 py-4 transition",
              item.current
                ? "border-[var(--atlas-accent)] bg-white/10"
                : "border-transparent bg-white/3 hover:border-[var(--atlas-line)] hover:bg-white/6"
            ].join(" ")}
          >
            <p className="text-sm font-medium text-[var(--atlas-ink)]">{item.label}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--atlas-muted)]">{item.description}</p>
          </a>
        ))}
      </nav>
      {footer ? <div className="mt-auto">{footer}</div> : null}
    </div>
  );
}
