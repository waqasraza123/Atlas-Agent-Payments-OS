type ContextDisplayProps = Readonly<{
  label: string;
  value: string;
}>;

export function ContextDisplay({ label, value }: ContextDisplayProps) {
  return (
    <div className="rounded-2xl border border-[var(--atlas-line)] bg-white/4 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--atlas-muted)]">{label}</p>
      <p className="mt-2 text-sm font-medium text-[var(--atlas-ink)]">{value}</p>
    </div>
  );
}
