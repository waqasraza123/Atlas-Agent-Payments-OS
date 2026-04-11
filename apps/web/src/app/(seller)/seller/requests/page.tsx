import { listSellerRequests, listSellerServices } from "@atlas/database";
import { PageHeader, Panel, RecordListPanel } from "@atlas/ui";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { getAtlasWorkspaceDetailHref } from "@/lib/detail-hrefs";

function formatCurrencyMinor(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(amountMinor / 100);
}

export default async function SellerRequestsPage() {
  const resolution = await resolveWorkspaceActor("SELLER");

  if (resolution.status !== "ready") {
    return null;
  }

  const [requests, services] = await Promise.all([
    listSellerRequests(resolution.actor.organization.id),
    listSellerServices(resolution.actor.organization.id)
  ]);

  const unmatchedRequests = requests.filter((request) => !request.matchedServiceId);
  const publishedServices = services.filter((service) => service.status === "PUBLISHED");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Seller requests"
        title="Inbound request monitoring baseline"
        description="Monitor buyer demand, confirm which seller service a request targets, and spot request records that still need catalog cleanup."
      />
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <RecordListPanel
          eyebrow="Inbound request queue"
          title="Seller request ledger"
          description="Requests routed to this seller now retain buyer organization context, service matching, and the current lifecycle status."
          items={requests.map((request) => ({
            id: request.id,
            title: request.title,
            description: `${request.buyerOrganizationName} · ${formatCurrencyMinor(request.amountMinor, request.currency)} · ${request.serviceCategory}`,
            detail: request.matchedServiceName ?? request.serviceKey ?? "No matched service",
            href: getAtlasWorkspaceDetailHref("SELLER", "requests", request.id) ?? undefined,
            statusLabel: request.status,
            statusTone:
              request.status === "COMPLETED" || request.status === "APPROVED"
                ? "success"
                : request.status === "FAILED" || request.status === "REJECTED" || request.status === "CANCELED"
                  ? "critical"
                  : "warning"
          }))}
          emptyTitle="No seller requests yet"
          emptyDescription="Buyer requests routed to this seller will populate the inbound queue."
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
          statusLabel: request.status,
          statusTone: "warning"
        }))}
        emptyTitle="All requests are matched"
        emptyDescription="Current inbound requests all map cleanly to seller catalog records."
      />
    </div>
  );
}
