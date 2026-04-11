import {
  formatAtlasOperatorCaseCategoryLabel,
  formatAtlasOperatorCaseSeverityLabel,
  formatAtlasOperatorCaseStatusLabel
} from "@atlas/domain";
import { PageHeader, Panel, RecordListPanel } from "@atlas/ui";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { createOperatorCaseListItems, loadOperatorCaseListData } from "@/lib/server/operator-data";

const inputClassName =
  "w-full rounded-2xl border border-[var(--atlas-line)] bg-black/20 px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition placeholder:text-[var(--atlas-muted)] focus:border-[var(--atlas-accent-strong)]";

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type OperatorExceptionsPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function OperatorExceptionsPage({ searchParams }: OperatorExceptionsPageProps) {
  const [resolution, resolvedSearchParams] = await Promise.all([resolveWorkspaceActor("OPERATOR"), searchParams]);

  if (resolution.status !== "ready") {
    return null;
  }

  const items = await loadOperatorCaseListData(resolution.actor, resolvedSearchParams);
  const recordItems = createOperatorCaseListItems(items);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operator exceptions"
        title="Exception queue"
        description="Filter active payment, receipt, and delivery drift into cases that operators can reason about and act on safely."
      />
      <Panel className="space-y-5 p-6 sm:p-8">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--atlas-accent)]">Search and filters</p>
          <h2 className="text-2xl font-semibold tracking-tight">Refine the investigation queue</h2>
          <p className="text-sm leading-7 text-[var(--atlas-muted)]">
            Use filters to narrow by severity, case state, category, or free-text query across case titles and organizations.
          </p>
        </div>
        <form className="grid gap-4 md:grid-cols-4">
          <input
            className={inputClassName}
            type="search"
            name="query"
            defaultValue={readSearchParam(resolvedSearchParams.query) ?? ""}
            placeholder="Search cases, requests, or organizations"
          />
          <select className={inputClassName} name="status" defaultValue={readSearchParam(resolvedSearchParams.status) ?? ""}>
            <option value="">All statuses</option>
            <option value="OPEN">{formatAtlasOperatorCaseStatusLabel("OPEN")}</option>
            <option value="INVESTIGATING">{formatAtlasOperatorCaseStatusLabel("INVESTIGATING")}</option>
            <option value="ACTION_REQUIRED">{formatAtlasOperatorCaseStatusLabel("ACTION_REQUIRED")}</option>
            <option value="RESOLVED">{formatAtlasOperatorCaseStatusLabel("RESOLVED")}</option>
            <option value="CLOSED">{formatAtlasOperatorCaseStatusLabel("CLOSED")}</option>
          </select>
          <select className={inputClassName} name="severity" defaultValue={readSearchParam(resolvedSearchParams.severity) ?? ""}>
            <option value="">All severities</option>
            <option value="LOW">{formatAtlasOperatorCaseSeverityLabel("LOW")}</option>
            <option value="MEDIUM">{formatAtlasOperatorCaseSeverityLabel("MEDIUM")}</option>
            <option value="HIGH">{formatAtlasOperatorCaseSeverityLabel("HIGH")}</option>
            <option value="CRITICAL">{formatAtlasOperatorCaseSeverityLabel("CRITICAL")}</option>
          </select>
          <select className={inputClassName} name="category" defaultValue={readSearchParam(resolvedSearchParams.category) ?? ""}>
            <option value="">All categories</option>
            <option value="PAYMENT_FAILURE">{formatAtlasOperatorCaseCategoryLabel("PAYMENT_FAILURE")}</option>
            <option value="PAYMENT_RETRY_EXHAUSTED">{formatAtlasOperatorCaseCategoryLabel("PAYMENT_RETRY_EXHAUSTED")}</option>
            <option value="SETTLEMENT_DELAY">{formatAtlasOperatorCaseCategoryLabel("SETTLEMENT_DELAY")}</option>
            <option value="SELLER_CONFIRMATION_DELAY">{formatAtlasOperatorCaseCategoryLabel("SELLER_CONFIRMATION_DELAY")}</option>
            <option value="RECEIPT_FAILURE">{formatAtlasOperatorCaseCategoryLabel("RECEIPT_FAILURE")}</option>
            <option value="RECEIPT_PENDING">{formatAtlasOperatorCaseCategoryLabel("RECEIPT_PENDING")}</option>
            <option value="REQUEST_PAUSED">{formatAtlasOperatorCaseCategoryLabel("REQUEST_PAUSED")}</option>
          </select>
          <div className="md:col-span-4 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center rounded-full border border-[var(--atlas-accent-strong)] bg-[var(--atlas-accent)] px-5 py-2.5 text-sm font-medium text-[var(--atlas-ink)] transition hover:border-[var(--atlas-ink)] hover:bg-[var(--atlas-accent-strong)]"
            >
              Apply filters
            </button>
          </div>
        </form>
      </Panel>
      <RecordListPanel
        eyebrow="Case backlog"
        title="Operator cases"
        description="Cases stay tied to the request lifecycle and open into detailed investigation views with safe actions."
        items={recordItems}
        emptyTitle="No exception cases match the current filters"
        emptyDescription="Try broadening the filters or wait for the next lifecycle exception."
      />
    </div>
  );
}
