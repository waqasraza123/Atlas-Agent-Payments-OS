import type { ReactNode } from "react";

type WorkflowFormFieldProps = Readonly<{
  label: string;
  hint?: string;
  children: ReactNode;
}>;

export function WorkflowFormField({ label, hint, children }: WorkflowFormFieldProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-[var(--atlas-ink)]">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-[var(--atlas-muted)]">{hint}</span> : null}
    </label>
  );
}
