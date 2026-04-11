import { listAtlasSeedScenarioSummaries, type AtlasSeedScenarioSummary } from "@atlas/database/seed-data";

export type AtlasDemoScenarioCard = {
  key: string;
  title: string;
  description: string;
  detail: string;
  href: string;
  statusLabel: string;
  statusTone: "default" | "success" | "warning" | "critical";
};

const atlasDemoScenarioOrder = [
  "awaiting-approval",
  "approved-awaiting-execution",
  "executing-with-seller-confirmation-pending",
  "completed-success",
  "payment-failed",
  "approval-expired",
  "manual-rejection",
  "secondary-buyer-success"
] as const;

function formatCurrencyMinor(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(value / 100);
}

function formatTokenLabel(value: string | null) {
  if (!value) {
    return "Not created";
  }

  return value
    .split(/[\W_]+/g)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

function resolveStatusTone(value: string | null): AtlasDemoScenarioCard["statusTone"] {
  const normalized = value?.toUpperCase() ?? "DEFAULT";

  if (["COMPLETED", "APPROVED", "CAPTURED", "AVAILABLE"].includes(normalized)) {
    return "success";
  }

  if (["FAILED", "REJECTED", "VOIDED", "CANCELED", "EXPIRED"].includes(normalized)) {
    return "critical";
  }

  if (["SUBMITTED", "PENDING", "AUTHORIZED", "EXECUTING"].includes(normalized)) {
    return "warning";
  }

  return "default";
}

function formatScenarioDetail(summary: AtlasSeedScenarioSummary) {
  return [
    formatCurrencyMinor(summary.amountMinor, summary.currency),
    summary.serviceCategory,
    summary.paymentStatus ? `Payment ${formatTokenLabel(summary.paymentStatus)}` : "Payment not created"
  ].join(" · ");
}

function sortScenarioSummaries(summaries: AtlasSeedScenarioSummary[]) {
  const order = new Map<string, number>(atlasDemoScenarioOrder.map((key, index) => [key, index]));

  return [...summaries].sort((left, right) => {
    const leftIndex = order.get(left.key) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = order.get(right.key) ?? Number.MAX_SAFE_INTEGER;

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return left.title.localeCompare(right.title);
  });
}

export function createAtlasDemoScenarioCards() {
  return sortScenarioSummaries(listAtlasSeedScenarioSummaries()).map((summary) => ({
    key: summary.key,
    title: summary.label,
    description: summary.title,
    detail: formatScenarioDetail(summary),
    href: `/buyer/requests/${summary.requestId}`,
    statusLabel: formatTokenLabel(summary.requestStatus),
    statusTone: resolveStatusTone(summary.requestStatus)
  }));
}

export function createAtlasFocusedDemoScenarioCards(currentRequestId: string | null, maxItems = 4) {
  const cards = createAtlasDemoScenarioCards();

  if (!currentRequestId) {
    return cards.slice(0, maxItems);
  }

  const currentIndex = cards.findIndex((card) => card.href.endsWith(`/${currentRequestId}`));

  if (currentIndex < 0) {
    return cards.slice(0, maxItems);
  }

  const startIndex = Math.max(0, currentIndex - 1);
  const selected = cards.slice(startIndex, startIndex + maxItems);

  return selected.length >= 2 ? selected : cards.slice(0, maxItems);
}
