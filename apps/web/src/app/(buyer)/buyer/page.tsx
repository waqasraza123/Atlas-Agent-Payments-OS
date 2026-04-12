import {
  getBuyerAnalyticsForActor,
  listBuyerActivityAnalyticsForActor,
  listBuyerRequestAnalyticsForActor
} from "@atlas/database";
import { MetricCard, PageHeader, Panel, RecordListPanel } from "@atlas/ui";
import { ExportLinkGroup } from "@/components/export-link-group";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { getAtlasWorkspaceDetailHref } from "@/lib/detail-hrefs";
import { formatCurrencyMinor, formatHoursLabel, formatPercent } from "@/lib/formatters";

export default async function BuyerPage() {
  const resolution = await resolveWorkspaceActor("BUYER");

  if (resolution.status !== "ready") {
    return null;
  }

  const [analytics, requests, activity] = await Promise.all([
    getBuyerAnalyticsForActor(resolution.actor),
    listBuyerRequestAnalyticsForActor(resolution.actor, {
      riskLevel: "attention"
    }),
    listBuyerActivityAnalyticsForActor(resolution.actor, {})
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Buyer workspace"
        title="Buyer analytics command center"
        description="Track spend posture, approval drag, exception pressure, and the highest-signal lifecycle records from one buyer-facing control surface."
      />
      <div className="flex justify-end">
        <ExportLinkGroup
          links={[
            {
              label: "Export buyer requests CSV",
              href: "/buyer/requests/export.csv"
            }
          ]}
        />
      </div>
      <section className="grid gap-4 xl:grid-cols-6">
        <MetricCard label="Spend" value={formatCurrencyMinor(analytics.totalSpendMinor, "USD")} detail="Captured, authorized, and completed buyer-side payment posture." />
        <MetricCard label="Requests" value={String(analytics.requestCount)} detail="Buyer request volume across the current seeded and runtime ledger." />
        <MetricCard label="Completed" value={String(analytics.completedRequestCount)} detail="Requests that finished with full lifecycle continuity." />
        <MetricCard label="Pending approvals" value={String(analytics.pendingApprovalCount)} detail="Requests still waiting on human review or delegated approval action." />
        <MetricCard label="Exception rate" value={formatPercent(analytics.exceptionRate)} detail="Share of buyer requests that still require more than passive monitoring." />
        <MetricCard label="Approval turnaround" value={formatHoursLabel(analytics.averageApprovalTurnaroundHours)} detail="Average time from approval creation to human approval decision." />
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <RecordListPanel
          eyebrow="Spend timeline"
          title="Buyer spend over time"
          description="The buyer org now sees spend trend points that tie directly back to the request ledger instead of relying only on seeded headline metrics."
          items={analytics.spendTimeline.map((point) => ({
            id: point.label,
            title: point.label,
            description: `${point.count} requests`,
            detail: formatCurrencyMinor(point.amountMinor, "USD"),
            statusLabel: `${point.count} requests`,
            statusTone: point.amountMinor > 0 ? "success" : "default"
          }))}
          emptyTitle="No spend timeline yet"
          emptyDescription="Spend timeline points appear once buyer requests accumulate."
        />
        <Panel className="space-y-5 p-6 sm:p-8">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--atlas-accent)]">Control posture</p>
            <h2 className="text-2xl font-semibold tracking-tight">Approval and budget signals</h2>
            <p className="text-sm leading-7 text-[var(--atlas-muted)]">
              Buyer-side reporting is now grounded in persisted policy evaluation, approvals, and lifecycle outcomes instead of static overview cards.
            </p>
          </div>
          <div className="space-y-3">
            <article className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 px-5 py-4">
              <h3 className="text-base font-medium">Auto-approved</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--atlas-muted)]">{analytics.autoApprovedCount} requests cleared through policy without human delay.</p>
            </article>
            <article className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 px-5 py-4">
              <h3 className="text-base font-medium">Manually approved</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--atlas-muted)]">{analytics.manualApprovedCount} requests required explicit reviewer action before payment execution.</p>
            </article>
            <article className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 px-5 py-4">
              <h3 className="text-base font-medium">Budget utilization</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--atlas-muted)]">{formatPercent(analytics.budgetUtilizationRate)} against the currently active per-policy max budget posture.</p>
            </article>
          </div>
        </Panel>
      </section>
      <section className="grid gap-6 xl:grid-cols-3">
        <RecordListPanel
          eyebrow="Top agents"
          title="Agent spend concentration"
          description="Shows which accountable software actors are driving the most spend and request volume."
          items={analytics.topAgents.map((item) => ({
            id: item.key,
            title: item.label,
            description: `${item.count} requests`,
            detail: formatCurrencyMinor(item.amountMinor, "USD"),
            statusLabel: formatPercent(item.share),
            statusTone: item.share >= 0.4 ? "warning" : "success"
          }))}
          emptyTitle="No agent analytics yet"
          emptyDescription="Agent spend mix will appear once requests are active."
        />
        <RecordListPanel
          eyebrow="Top sellers"
          title="Seller exposure"
          description="Highlights which sellers are taking the largest share of buyer request volume and spend."
          items={analytics.topSellers.map((item) => ({
            id: item.key,
            title: item.label,
            description: `${item.count} requests`,
            detail: formatCurrencyMinor(item.amountMinor, "USD"),
            statusLabel: formatPercent(item.share),
            statusTone: item.share >= 0.4 ? "warning" : "success"
          }))}
          emptyTitle="No seller analytics yet"
          emptyDescription="Seller exposure will appear as requests route across real seller organizations."
        />
        <RecordListPanel
          eyebrow="Top services"
          title="Service concentration"
          description="Tracks where buyer demand is concentrating across service categories and keys."
          items={analytics.topServices.map((item) => ({
            id: item.key,
            title: item.label,
            description: `${item.count} requests`,
            detail: formatCurrencyMinor(item.amountMinor, "USD"),
            statusLabel: formatPercent(item.share),
            statusTone: item.share >= 0.4 ? "warning" : "success"
          }))}
          emptyTitle="No service analytics yet"
          emptyDescription="Service mix appears once requests carry real category and key data."
        />
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <RecordListPanel
          eyebrow="Requests needing attention"
          title="Attention queue"
          description="Analytics now help triage buyer requests that are still outside receipt-complete posture."
          items={requests.slice(0, 6).map((request) => ({
            id: request.id,
            title: request.title,
            description: `${formatCurrencyMinor(request.amountMinor, request.currency)} · ${request.agentName}`,
            detail: `${request.sellerOrganizationName ?? "No seller"} · ${request.reconciliationState}`,
            href: getAtlasWorkspaceDetailHref("BUYER", "requests", request.id) ?? undefined,
            statusLabel: request.requestStatus,
            statusTone:
              request.requestStatus === "COMPLETED"
                ? "success"
                : request.requestStatus === "FAILED" || request.requestStatus === "REJECTED"
                  ? "critical"
                  : "warning"
          }))}
          emptyTitle="No attention requests"
          emptyDescription="Buyer requests are currently in a healthy receipt-available posture."
        />
        <RecordListPanel
          eyebrow="Recent buyer activity"
          title="Audit-backed activity"
          description="Buyers can now scan a high-signal activity feed before diving into the full audit explorer."
          items={activity.slice(0, 6).map((event) => ({
            id: event.id,
            title: event.eventType,
            description: `${event.actorLabel} · ${event.targetType}`,
            detail: event.requestTitle ?? event.targetId,
            href: event.targetType === "request" ? getAtlasWorkspaceDetailHref("BUYER", "activity", event.id) ?? undefined : undefined,
            statusLabel: event.actorType
          }))}
          emptyTitle="No buyer activity yet"
          emptyDescription="Recorded buyer activity appears here once requests, approvals, and payments move."
        />
      </section>
    </div>
  );
}
