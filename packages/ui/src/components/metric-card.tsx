type MetricCardProps = Readonly<{
  label: string;
  value: string;
  detail: string;
}>;

export function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <section className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 p-5">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--atlas-muted)]">{label}</p>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-[var(--atlas-ink)]">{value}</p>
      <p className="mt-3 text-sm leading-6 text-[var(--atlas-muted)]">{detail}</p>
    </section>
  );
}
