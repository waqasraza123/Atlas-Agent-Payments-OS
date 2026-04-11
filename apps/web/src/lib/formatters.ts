export function formatCurrencyMinor(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(amountMinor / 100);
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function formatDateTimeLabel(value: string | null) {
  if (!value) {
    return "No recent activity";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatHoursLabel(value: number | null) {
  if (value === null) {
    return "Not enough data";
  }

  return `${value.toFixed(1)} hrs`;
}

