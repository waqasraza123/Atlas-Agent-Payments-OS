import { PageHeader, Panel, RecordListPanel } from "@atlas/ui";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { createOperatorAuditItems, loadOperatorAuditData } from "@/lib/server/operator-data";

const inputClassName =
  "w-full rounded-2xl border border-[var(--atlas-line)] bg-black/20 px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition placeholder:text-[var(--atlas-muted)] focus:border-[var(--atlas-accent-strong)]";

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type OperatorAuditPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function OperatorAuditPage({ searchParams }: OperatorAuditPageProps) {
  const [resolution, resolvedSearchParams] = await Promise.all([resolveWorkspaceActor("OPERATOR"), searchParams]);

  if (resolution.status !== "ready") {
    return null;
  }

  const items = await loadOperatorAuditData(resolution.actor, resolvedSearchParams);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operator audit explorer"
        title="Audit explorer"
        description="Search human and system events across request, payment, receipt, and operator-control boundaries."
      />
      <Panel className="space-y-5 p-6 sm:p-8">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--atlas-accent)]">Filter events</p>
          <h2 className="text-2xl font-semibold tracking-tight">Search the investigation trail</h2>
          <p className="text-sm leading-7 text-[var(--atlas-muted)]">
            Audit search stays grounded in the recorded event stream and supports operator-side triage without leaving the product.
          </p>
        </div>
        <form className="grid gap-4 md:grid-cols-3">
          <input
            className={inputClassName}
            type="search"
            name="query"
            defaultValue={readSearchParam(resolvedSearchParams.query) ?? ""}
            placeholder="Search event type, target, actor, or organization"
          />
          <input
            className={inputClassName}
            type="text"
            name="eventType"
            defaultValue={readSearchParam(resolvedSearchParams.eventType) ?? ""}
            placeholder="Filter by exact event type"
          />
          <input
            className={inputClassName}
            type="text"
            name="targetType"
            defaultValue={readSearchParam(resolvedSearchParams.targetType) ?? ""}
            placeholder="Filter by exact target type"
          />
          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center rounded-full border border-[var(--atlas-accent-strong)] bg-[var(--atlas-accent)] px-5 py-2.5 text-sm font-medium text-[var(--atlas-ink)] transition hover:border-[var(--atlas-ink)] hover:bg-[var(--atlas-accent-strong)]"
            >
              Search audit
            </button>
          </div>
        </form>
      </Panel>
      <RecordListPanel
        eyebrow="Audit stream"
        title="Recorded events"
        description="Operator audit search keeps causality visible across human actions, system transitions, and lifecycle evidence."
        items={createOperatorAuditItems(items)}
        emptyTitle="No audit events match the current filters"
        emptyDescription="Broaden the filters to inspect a wider slice of the audit stream."
      />
    </div>
  );
}
