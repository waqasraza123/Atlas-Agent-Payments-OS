import { listPlatformTransactions } from "@atlas/database";
import { PageHeader, RecordListPanel } from "@atlas/ui";
import { ExportLinkGroup } from "@/components/export-link-group";
import { FilterPanel } from "@/components/filter-panel";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { getAtlasWorkspaceDetailHref } from "@/lib/detail-hrefs";
import { formatCurrencyMinor } from "@/lib/formatters";

const inputClassName =
  "w-full rounded-2xl border border-[var(--atlas-line)] bg-black/20 px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition placeholder:text-[var(--atlas-muted)] focus:border-[var(--atlas-accent-strong)]";

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type OperatorTransactionsPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function OperatorTransactionsPage({ searchParams }: OperatorTransactionsPageProps) {
  const resolution = await resolveWorkspaceActor("OPERATOR");

  if (resolution.status !== "ready") {
    return null;
  }

  const params = await searchParams;
  const transactions = await listPlatformTransactions(params);
  const query = readSearchParam(params.query) ?? "";
  const requestStatus = readSearchParam(params.requestStatus) ?? "";
  const paymentStatus = readSearchParam(params.paymentStatus) ?? "";
  const receiptStatus = readSearchParam(params.receiptStatus) ?? "";
  const paymentRail = readSearchParam(params.paymentRail) ?? "";
  const riskLevel = readSearchParam(params.riskLevel) ?? "";
  const exportSearch = new URLSearchParams();

  for (const [key, value] of [
    ["query", query],
    ["requestStatus", requestStatus],
    ["paymentStatus", paymentStatus],
    ["receiptStatus", receiptStatus],
    ["paymentRail", paymentRail],
    ["riskLevel", riskLevel]
  ]) {
    if (value) {
      exportSearch.set(key, value);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operator transactions"
        title="Cross-entity transaction ledger"
        description="Search payment, request, and receipt continuity across the entire platform from one operator-facing ledger."
      />
      <div className="flex justify-end">
        <ExportLinkGroup
          links={[
            {
              label: "Export filtered platform transactions",
              href: `/operator/transactions/export.csv${exportSearch.size > 0 ? `?${exportSearch.toString()}` : ""}`
            }
          ]}
        />
      </div>
      <FilterPanel
        eyebrow="Transaction filters"
        title="Refine the platform ledger"
        description="Tighten the operator transaction view by request status, payment status, receipt posture, rail, and free-text query."
        submitLabel="Apply filters"
      >
        <input className={inputClassName} type="search" name="query" defaultValue={query} placeholder="Search buyer, seller, request, or service context" />
        <select className={inputClassName} name="requestStatus" defaultValue={requestStatus}>
          <option value="">All request statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="APPROVED">Approved</option>
          <option value="EXECUTING">Executing</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELED">Canceled</option>
        </select>
        <select className={inputClassName} name="paymentStatus" defaultValue={paymentStatus}>
          <option value="">All payment statuses</option>
          <option value="PENDING">Pending</option>
          <option value="AUTHORIZED">Authorized</option>
          <option value="CAPTURED">Captured</option>
          <option value="FAILED">Failed</option>
          <option value="VOIDED">Voided</option>
        </select>
        <select className={inputClassName} name="receiptStatus" defaultValue={receiptStatus}>
          <option value="">All receipt statuses</option>
          <option value="PENDING">Pending</option>
          <option value="AVAILABLE">Available</option>
          <option value="FAILED">Failed</option>
        </select>
        <select className={inputClassName} name="paymentRail" defaultValue={paymentRail}>
          <option value="">All payment rails</option>
          <option value="INTERNAL_SIMULATED">Internal simulated</option>
          <option value="STRIPE">Stripe</option>
        </select>
        <select className={inputClassName} name="riskLevel" defaultValue={riskLevel}>
          <option value="">All risk postures</option>
          <option value="attention">Needs attention</option>
          <option value="healthy">Receipt available</option>
        </select>
      </FilterPanel>
      <RecordListPanel
        eyebrow="Platform transactions"
        title="Request to receipt continuity"
        description="Every operator transaction row now reflects request, payment, attempt, and receipt posture in one exportable ledger."
        items={transactions.map((transaction) => ({
          id: transaction.id,
          title: transaction.requestTitle,
          description: `${transaction.buyerOrganizationName} · ${transaction.sellerOrganizationName ?? "No seller"} · ${formatCurrencyMinor(transaction.amountMinor, transaction.currency)}`,
          detail: `${transaction.reconciliationState} · ${transaction.paymentRail ?? "No rail"} · ${transaction.providerStatus ?? "No provider status"}`,
          href: getAtlasWorkspaceDetailHref("OPERATOR", "transactions", transaction.id) ?? undefined,
          statusLabel: transaction.paymentStatus ?? transaction.requestStatus,
          statusTone:
            transaction.receiptStatus === "AVAILABLE"
              ? "success"
              : transaction.paymentStatus === "FAILED" || transaction.receiptStatus === "FAILED"
                ? "critical"
                : "warning"
        }))}
        emptyTitle="No transactions match the current filters"
        emptyDescription="Broaden the filters to inspect a wider slice of the platform transaction ledger."
      />
    </div>
  );
}

