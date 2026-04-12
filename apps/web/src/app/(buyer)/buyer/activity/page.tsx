import { listBuyerActivityAnalyticsForActor } from "@atlas/database";
import { PageHeader, RecordListPanel } from "@atlas/ui";
import { FilterPanel } from "@/components/filter-panel";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";

const inputClassName =
  "w-full rounded-2xl border border-[var(--atlas-line)] bg-black/20 px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition placeholder:text-[var(--atlas-muted)] focus:border-[var(--atlas-accent-strong)]";

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type BuyerActivityPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function BuyerActivityPage({ searchParams }: BuyerActivityPageProps) {
  const resolution = await resolveWorkspaceActor("BUYER");

  if (resolution.status !== "ready") {
    return null;
  }

  const params = await searchParams;
  const items = await listBuyerActivityAnalyticsForActor(resolution.actor, params);
  const query = readSearchParam(params.query) ?? "";
  const eventType = readSearchParam(params.eventType) ?? "";
  const targetType = readSearchParam(params.targetType) ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Buyer activity"
        title="Buyer audit activity"
        description="Search the buyer-side event stream across request creation, policy evaluation, approvals, payments, receipts, and operator-visible actions."
      />
      <FilterPanel
        eyebrow="Activity filters"
        title="Refine the buyer event stream"
        description="Search event, target, actor, or request context without leaving the buyer workspace."
        submitLabel="Apply filters"
      >
        <input className={inputClassName} type="search" name="query" defaultValue={query} placeholder="Search event type, target, actor, or request" />
        <input className={inputClassName} type="text" name="eventType" defaultValue={eventType} placeholder="Exact event type" />
        <input className={inputClassName} type="text" name="targetType" defaultValue={targetType} placeholder="Exact target type" />
      </FilterPanel>
      <RecordListPanel
        eyebrow="Activity stream"
        title="Recorded buyer events"
        description="Buyer-side audit search keeps policy, approval, payment, and receipt transitions visible in one stream."
        items={items.map((event) => ({
          id: event.id,
          title: event.eventType,
          description: `${event.actorLabel} · ${event.targetType}`,
          detail: event.requestTitle ?? event.targetId,
          statusLabel: event.actorType
        }))}
        emptyTitle="No buyer activity matches the current filters"
        emptyDescription="Broaden the filters to inspect a wider slice of the buyer event stream."
      />
    </div>
  );
}
