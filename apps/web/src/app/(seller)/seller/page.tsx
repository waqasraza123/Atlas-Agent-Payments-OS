import {
  getSellerAnalytics,
  getSellerProfile,
  listSellerRequests,
  listSellerServices,
  listSellerTeamMembers
} from "@atlas/database";
import { MetricCard, PageHeader, Panel, RecordListPanel } from "@atlas/ui";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { getAtlasWorkspaceDetailHref } from "@/lib/detail-hrefs";

function formatCurrencyMinor(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(amountMinor / 100);
}

export default async function SellerPage() {
  const resolution = await resolveWorkspaceActor("SELLER");

  if (resolution.status !== "ready") {
    return null;
  }

  const [profile, analytics, teamMembers, services, requests] = await Promise.all([
    getSellerProfile(resolution.actor.organization.id),
    getSellerAnalytics(resolution.actor.organization.id),
    listSellerTeamMembers(resolution.actor.organization.id),
    listSellerServices(resolution.actor.organization.id),
    listSellerRequests(resolution.actor.organization.id)
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Seller workspace"
        title="Seller workflow baseline"
        description="Run a real seller catalog, keep pricing explicit, and monitor inbound buyer demand from the same workspace."
      />
      <section className="grid gap-4 xl:grid-cols-4">
        <MetricCard
          label="Services"
          value={String(profile.serviceCount)}
          detail="Seller services now exist as first-class records instead of placeholder catalog tiles."
        />
        <MetricCard
          label="Published"
          value={String(profile.publishedServiceCount)}
          detail="Published services are currently visible and ready for buyer-side request targeting."
        />
        <MetricCard
          label="Inbound requests"
          value={String(profile.requestCount)}
          detail="Buyer requests routed to this seller are now visible in a real seller request queue."
        />
        <MetricCard
          label="Buyer organizations"
          value={String(profile.activeBuyerCount)}
          detail="Distinct buyer organizations already interacting with this seller organization."
        />
        <MetricCard
          label="Pending fulfillment"
          value={String(analytics.pendingFulfillmentCount)}
          detail="Approved or executing requests still waiting on an explicit seller-side outcome."
        />
        <MetricCard
          label="Completed"
          value={String(analytics.completedRequestCount)}
          detail="Requests with a recorded seller delivery outcome and terminal success state."
        />
        <MetricCard
          label="Failed or canceled"
          value={String(analytics.failedRequestCount)}
          detail="Terminal requests that did not end in successful seller fulfillment."
        />
        <MetricCard
          label="Catalog gaps"
          value={String(analytics.unmatchedRequestCount)}
          detail="Inbound requests that still do not map cleanly to a seller service key."
        />
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <RecordListPanel
          eyebrow="Inbound demand"
          title="Recent seller requests"
          description="Seller-side monitoring now shows buyer organization context, request purpose, and matched service posture."
          items={requests.slice(0, 6).map((request) => ({
            id: request.id,
            title: request.title,
            description: `${request.buyerOrganizationName} · ${formatCurrencyMinor(request.amountMinor, request.currency)}`,
            detail:
              request.fulfillment?.note ??
              request.matchedServiceName ??
              request.serviceKey ??
              request.serviceCategory,
            href: getAtlasWorkspaceDetailHref("SELLER", "requests", request.id) ?? undefined,
            statusLabel: request.status,
            statusTone:
              request.status === "COMPLETED" || request.status === "APPROVED"
                ? "success"
                : request.status === "FAILED" || request.status === "REJECTED" || request.status === "CANCELED"
                  ? "critical"
                  : "warning"
          }))}
          emptyTitle="No inbound requests yet"
          emptyDescription="Buyer-side requests routed to this seller will appear here."
        />
        <Panel className="space-y-5 p-6 sm:p-8">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--atlas-accent)]">Seller profile</p>
            <h2 className="text-2xl font-semibold tracking-tight">{profile.organizationName}</h2>
            <p className="text-sm leading-7 text-[var(--atlas-muted)]">
              Seller team and catalog context now live in the product instead of only in seeded overview storytelling.
            </p>
          </div>
          <div className="space-y-3">
            <article className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 px-5 py-4">
              <h3 className="text-base font-medium">Organization slug</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--atlas-accent-strong)]">{profile.organizationSlug}</p>
            </article>
            <article className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 px-5 py-4">
              <h3 className="text-base font-medium">Team members</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--atlas-muted)]">
                {teamMembers.length} seller memberships are currently available in the local baseline.
              </p>
            </article>
            <article className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 px-5 py-4">
              <h3 className="text-base font-medium">Catalog coverage</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--atlas-muted)]">
                {services.filter((service) => service.status === "PUBLISHED").length} services are published and ready
                for buyer-side targeting.
              </p>
            </article>
          </div>
        </Panel>
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <RecordListPanel
          eyebrow="Seller team"
          title="Team baseline"
          description="Seller organization access remains explicit and organization-scoped before richer support tooling arrives."
          items={teamMembers.map((member) => ({
            id: member.membershipId,
            title: member.userName ?? member.userEmail,
            description: member.userEmail,
            detail: member.role,
            statusLabel: member.role
          }))}
          emptyTitle="No seller team members available"
          emptyDescription="Seller memberships will appear here once they exist."
        />
        <RecordListPanel
          eyebrow="Service catalog"
          title="Published and draft services"
          description="Seller services now have explicit status, visibility, and pricing posture."
          items={services.slice(0, 6).map((service) => ({
            id: service.id,
            title: service.name,
            description: `${formatCurrencyMinor(service.priceMinor, service.currency)} · ${service.category}`,
            detail: `${service.visibility} · ${service.linkedRequestCount} linked requests`,
            href: getAtlasWorkspaceDetailHref("SELLER", "services", service.id) ?? undefined,
            statusLabel: service.status,
            statusTone: service.status === "PUBLISHED" ? "success" : service.status === "ARCHIVED" ? "critical" : "warning"
          }))}
          emptyTitle="No seller services available"
          emptyDescription="Create the first seller service to establish a real catalog baseline."
        />
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <RecordListPanel
          eyebrow="Top services"
          title="Seller performance mix"
          description="Seller-side analytics now summarize which services are absorbing the most request volume and how that volume is finishing."
          items={analytics.topServices.map((service) => ({
            id: service.serviceId,
            title: service.serviceName,
            description: `${service.requestCount} requests · ${service.completedRequestCount} completed`,
            detail: `${service.serviceKey} · ${service.failedRequestCount} failed or canceled`,
            href: getAtlasWorkspaceDetailHref("SELLER", "services", service.serviceId) ?? undefined,
            statusLabel: `${service.requestCount} requests`,
            statusTone: service.failedRequestCount > 0 ? "warning" : "success"
          }))}
          emptyTitle="No service analytics yet"
          emptyDescription="Service mix appears once seller requests and catalog matching are active."
        />
        <RecordListPanel
          eyebrow="Top buyers"
          title="Buyer organization mix"
          description="Seller-side demand stays legible because buyer organizations remain explicit across request monitoring and analytics."
          items={analytics.topBuyers.map((buyer) => ({
            id: buyer.buyerOrganizationId,
            title: buyer.buyerOrganizationName,
            description: `${buyer.requestCount} requests · ${buyer.completedRequestCount} completed`,
            detail: `${buyer.failedRequestCount} failed or canceled`,
            statusLabel: `${buyer.requestCount} requests`,
            statusTone: buyer.failedRequestCount > 0 ? "warning" : "success"
          }))}
          emptyTitle="No buyer analytics yet"
          emptyDescription="Buyer mix will appear as inbound seller requests accumulate."
        />
      </section>
    </div>
  );
}
