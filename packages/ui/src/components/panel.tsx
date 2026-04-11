import type { ReactNode } from "react";

type PanelProps = Readonly<{
  children: ReactNode;
  className?: string;
}>;

export function Panel({ children, className }: PanelProps) {
  return (
    <section
      className={[
        "rounded-[28px] border border-[var(--atlas-line)] bg-[var(--atlas-panel)] shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}
