import { listSellerRequestAnalyticsForActor, listSellerServicesForActor } from "@atlas/database";
import { PageHeader, Panel, RecordListPanel } from "@atlas/ui";
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

type SellerRequestsPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function SellerRequestsPage({ searchParams }: SellerRequestsPageProps) {
  const resolution = await resolveWorkspaceActor("SELLER");

  if (resolution.status !== "ready") {
    return null;
  }

  const params = await searchParams;
  const [requests, services] = await Promise.all([
    listSellerRequestAnalyticsForActor(resolution.actor, params),
    listSellerServicesForActor(resolution.actor)
  ]);

  const unmatchedRequests = requests.filter((request) => !request.serviceKey);
  const publishedServices = services.filter((service) => service.status === "PUBLISHED");
  const query = readSearchParam(params.query) ?? "";
  const requestStatus = readSearchParam(params.requestStatus) ?? "";
  const paymentStatus = readSearchParam(params.paymentStatus) ?? "";
  const serviceCategory = readSearchParam(params.serviceCategory) ?? "";
  const riskLevel = readSearchParam(params.riskLevel) ?? "";
  const exportSearch = new URLSearchParams();

  if (query) {
    exportSearch.set("query", query);
  }
  if (requestStatus) {
    exportSearch.set("requestStatus", requestStatus);
  }
  if (paymentStatus) {
    exportSearch.set("paymentStatus", paymentStatus);
  }
  if (serviceCategory) {
    exportSearch.set("serviceCategory", serviceCategory);
  }
  if (riskLevel) {
    exportSearch.set("riskLevel", riskLevel);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Seller requests"
        title="Inbound request monitoring baseline"
        description="Monitor buyer demand, confirm which seller service a request targets, and spot request records that still need catalog cleanup."
      />
      <div className="flex justify-end">
        <ExportLinkGroup
          links={[
            {
              label: "Export filtered seller requests",
              href: `/seller/requests/export.csv${exportSearch.size > 0 ? `?${exportSearch.toString()}` : ""}`
            }
          ]}
        />
      </div>
      <FilterPanel
        eyebrow="Seller filters"
        title="Refine inbound seller demand"
        description="Search by buyer, request, or service context and tighten the ledger by lifecycle and risk posture."
        submitLabel="Apply filters"
      >
        <input className={inputClassName} type="search" name="query" defaultValue={query} placeholder="Search buyer, request, or service" />
        <select className={inputClassName} name="requestStatus" defaultValue={requestStatus}>
          <option value="">All request statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="APPROVED">Approved</option>
          <option value="EXECUTING">Executing</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
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
        <input className={inputClassName} type="text" name="serviceCategory" defaultValue={serviceCategory} placeholder="Filter service category" />
        <select className={inputClassName} name="riskLevel" defaultValue={riskLevel}>
          <option value="">All risk postures</option>
          <option value="attention">Needs attention</option>
          <option value="healthy">Receipt available</option>
        </select>
      </FilterPanel>
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <RecordListPanel
          eyebrow="Inbound request queue"
          title="Seller request ledger"
          description="Requests routed to this seller now retain buyer organization context, service matching, and the current lifecycle status."
          items={requests.map((request) => ({
            id: request.id,
            title: request.title,
            description: `${request.buyerOrganizationName} · ${formatCurrencyMinor(request.amountMinor, request.currency)} · ${request.serviceCategory}`,
            detail: `${request.matchedServiceName ?? request.serviceKey ?? "No matched service"} · ${request.reconciliationState}`,
            href: getAtlasWorkspaceDetailHref("SELLER", "requests", request.id) ?? undefined,
            statusLabel: request.requestStatus,
            statusTone:
              request.requestStatus === "COMPLETED" || request.requestStatus === "APPROVED"
                ? "success"
                : request.requestStatus === "FAILED" || request.requestStatus === "REJECTED" || request.requestStatus === "CANCELED"
                  ? "critical"
                  : "warning"
          }))}
          emptyTitle="No seller requests match the current filters"
          emptyDescription="Broaden the filters or wait for additional buyer demand."
        />
        <Panel className="space-y-5 p-6 sm:p-8">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--atlas-accent)]">Matching posture</p>
            <h2 className="text-2xl font-semibold tracking-tight">Catalog alignment</h2>
            <p className="text-sm leading-7 text-[var(--atlas-muted)]">
              Seller request monitoring is only useful if incoming requests can be matched back to a real seller service
              record and pricing baseline.
            </p>
          </div>
          <div className="space-y-3">
            <article className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 px-5 py-4">
              <h3 className="text-base font-medium">Published services</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--atlas-muted)]">
                {publishedServices.length} services are currently published for buyer-side targeting.
              </p>
            </article>
            <article className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 px-5 py-4">
              <h3 className="text-base font-medium">Unmatched requests</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--atlas-muted)]">
                {unmatchedRequests.length} inbound requests do not currently map to a seller service record.
              </p>
            </article>
            <article className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 px-5 py-4">
              <h3 className="text-base font-medium">Latest buyer</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--atlas-muted)]">
                {requests[0]?.buyerOrganizationName ?? "No buyer requests have reached this seller yet."}
              </p>
            </article>
          </div>
        </Panel>
      </section>
      <RecordListPanel
        eyebrow="Catalog gaps"
        title="Requests needing seller review"
        description="Requests without a matched seller service should trigger catalog cleanup before fulfillment logic deepens."
        items={unmatchedRequests.map((request) => ({
          id: request.id,
          title: request.title,
          description: request.buyerOrganizationName,
          detail: request.serviceKey ?? request.serviceCategory,
          href: getAtlasWorkspaceDetailHref("SELLER", "requests", request.id) ?? undefined,
          statusLabel: request.requestStatus,
          statusTone: "warning"
        }))}
        emptyTitle="All requests are matched"
        emptyDescription="Current inbound requests all map cleanly to seller catalog records."
      />
    </div>
  );
}
