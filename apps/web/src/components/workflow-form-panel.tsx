import type { ReactNode } from "react";
import { Panel } from "@atlas/ui";

type WorkflowFormPanelProps = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  children: ReactNode;
}>;

export function WorkflowFormPanel({
  eyebrow,
  title,
  description,
  action,
  submitLabel,
  children
}: WorkflowFormPanelProps) {
  return (
    <Panel className="p-6 sm:p-8">
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--atlas-muted)]">{eyebrow}</p>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="max-w-3xl text-sm leading-7 text-[var(--atlas-muted)] sm:text-base">{description}</p>
      </div>
      <form action={action} className="mt-6 space-y-5">
        {children}
        <div className="flex justify-end">
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
