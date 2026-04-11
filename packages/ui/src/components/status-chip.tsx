type StatusChipProps = Readonly<{
  label: string;
  tone?: "default" | "success" | "warning" | "critical";
}>;

const toneClasses: Record<NonNullable<StatusChipProps["tone"]>, string> = {
  default: "border-[var(--atlas-line)] bg-white/6 text-[var(--atlas-muted)]",
  success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  warning: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  critical: "border-rose-400/30 bg-rose-400/10 text-rose-200"
};

export function StatusChip({ label, tone = "default" }: StatusChipProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em]",
        toneClasses[tone]
      ].join(" ")}
    >
      {label}
    </span>
  );
}
