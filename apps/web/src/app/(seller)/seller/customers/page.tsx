import { getSellerRevenueAnalytics } from "@atlas/database";
import { MetricCard, PageHeader, RecordListPanel } from "@atlas/ui";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { formatCurrencyMinor } from "@/lib/formatters";

export default async function SellerCustomersPage() {
  const resolution = await resolveWorkspaceActor("SELLER");

  if (resolution.status !== "ready") {
    return null;
  }

  const analytics = await getSellerRevenueAnalytics(resolution.actor.organization.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Seller customers"
        title="Buyer demand analytics"
        description="Track repeat buyers, revenue concentration, and the customers driving the seller-side request mix."
      />
      <section className="grid gap-4 xl:grid-cols-4">
        <MetricCard label="Revenue" value={formatCurrencyMinor(analytics.totalRevenueMinor, "USD")} detail="Completed seller-side request value tied to recorded fulfillment and payment state." />
        <MetricCard label="Requests" value={String(analytics.requestCount)} detail="Total buyer-side requests routed to this seller organization." />
        <MetricCard label="Completed" value={String(analytics.completedRequestCount)} detail="Seller requests that finished with full lifecycle completion." />
        <MetricCard label="Repeat buyers" value={String(analytics.repeatBuyerCount)} detail="Buyer organizations with more than one request against this seller." />
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <RecordListPanel
          eyebrow="Top buyers"
          title="Buyer organization concentration"
          description="Identify which buyers are driving the largest share of seller-side demand and revenue."
          items={analytics.topBuyers.map((item) => ({
            id: item.key,
            title: item.label,
            description: `${item.count} requests`,
            detail: formatCurrencyMinor(item.amountMinor, "USD"),
            statusLabel: `${Math.round(item.share * 100)}%`,
            statusTone: item.share >= 0.4 ? "warning" : "success"
          }))}
          emptyTitle="No buyer demand yet"
          emptyDescription="Buyer concentration will appear once inbound seller requests accumulate."
        />
        <RecordListPanel
          eyebrow="Top services"
          title="Service revenue mix"
          description="Shows which service keys are absorbing the most request volume and seller-side revenue."
          items={analytics.topServices.map((item) => ({
            id: item.key,
            title: item.label,
            description: `${item.count} requests`,
            detail: formatCurrencyMinor(item.amountMinor, "USD"),
            statusLabel: `${Math.round(item.share * 100)}%`,
            statusTone: item.share >= 0.4 ? "warning" : "success"
          }))}
          emptyTitle="No service mix yet"
          emptyDescription="Service revenue mix appears once sellers receive routed buyer requests."
        />
      </section>
      <RecordListPanel
        eyebrow="Revenue timeline"
        title="Revenue over time"
        description="Completed seller revenue is now visible as an enterprise-facing trend instead of only a request list."
        items={analytics.revenueTimeline.map((point) => ({
          id: point.label,
          title: point.label,
          description: `${point.count} completed requests`,
          detail: formatCurrencyMinor(point.amountMinor, "USD"),
          statusLabel: `${point.count} completed`,
          statusTone: point.amountMinor > 0 ? "success" : "default"
        }))}
        emptyTitle="No completed revenue yet"
        emptyDescription="Revenue points appear once seller requests complete successfully."
      />
    </div>
  );
}

