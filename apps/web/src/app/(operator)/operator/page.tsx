import { getPlatformAnalyticsForActor } from "@atlas/database";
import { MetricCard, PageHeader, Panel, RecordListPanel } from "@atlas/ui";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import {
  createOperatorAuditItems,
  createOperatorCaseListItems,
  createOperatorNotificationItems,
  loadOperatorOverviewData
} from "@/lib/server/operator-data";
import { formatHoursLabel } from "@/lib/formatters";

export default async function OperatorPage() {
  const resolution = await resolveWorkspaceActor("OPERATOR");

  if (resolution.status !== "ready") {
    return null;
  }

  const [overview, analytics] = await Promise.all([
    loadOperatorOverviewData(resolution.actor),
    getPlatformAnalyticsForActor(resolution.actor)
  ]);
  const recentCaseItems = createOperatorCaseListItems(overview.recentCases);
  const recentNotificationItems = createOperatorNotificationItems(overview.recentNotifications);
  const recentAuditItems = createOperatorAuditItems(overview.recentAuditEvents);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operator workspace"
        title="Operator trust center"
        description="Investigate payment failures, receipt gaps, settlement delays, and seller confirmation drift from one auditable workspace."
      />
      <section className="grid gap-4 xl:grid-cols-6">
        <MetricCard label="Open cases" value={String(overview.openCaseCount)} detail="Active investigation workload across requests, payments, receipts, and delays." />
        <MetricCard label="Critical" value={String(overview.criticalCaseCount)} detail="Cases with payment exhaustion, receipt failure, or equivalent operational severity." />
        <MetricCard label="Action required" value={String(overview.actionRequiredCount)} detail="Cases that currently need explicit operator intervention instead of passive observation." />
        <MetricCard label="Unread alerts" value={String(overview.unreadNotificationCount)} detail="Operator attention items that remain unread in the current notification queue." />
        <MetricCard label="Delayed" value={String(overview.delayedCaseCount)} detail="Settlement, seller confirmation, and receipt delay posture across active lifecycle records." />
        <MetricCard label="Failed" value={String(overview.failedCaseCount)} detail="Requests where payment or receipt evidence already failed and needs direct triage." />
      </section>
      <section className="grid gap-4 xl:grid-cols-5">
        <MetricCard label="Organizations" value={String(analytics.activeOrganizationCount)} detail="Organizations with active platform presence." />
        <MetricCard label="Active agents" value={String(analytics.activeAgentCount)} detail="Agents with real request volume in the platform ledger." />
        <MetricCard label="Requests" value={String(analytics.totalRequestCount)} detail="Cross-platform request volume visible to operator review." />
        <MetricCard label="Successful payments" value={String(analytics.successfulPaymentCount)} detail="Payments that have reached captured state across the platform." />
        <MetricCard label="Completion time" value={formatHoursLabel(analytics.averageRequestCompletionHours)} detail="Average request duration until a terminal lifecycle state is reached." />
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <RecordListPanel
          eyebrow="Exception queue"
          title="Recent operator cases"
          description="Every case is derived from a real request, payment, or receipt posture and stays auditable through operator actions."
          items={recentCaseItems}
          emptyTitle="No operator cases open"
          emptyDescription="Atlas will surface active exceptions here once lifecycle posture requires intervention."
        />
        <Panel className="space-y-5 p-6 sm:p-8">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--atlas-accent)]">Operational posture</p>
            <h2 className="text-2xl font-semibold tracking-tight">Failure handling is now a first-class surface</h2>
            <p className="text-sm leading-7 text-[var(--atlas-muted)]">
              Atlas now turns payment, receipt, and fulfillment drift into explicit operator cases with reason-captured
              actions instead of leaving support work buried inside raw timelines.
            </p>
          </div>
          <div className="space-y-3">
            {overview.recentCases.slice(0, 3).map((item) => (
              <article key={item.id} className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 px-5 py-4">
                <a href={`/operator/exceptions/${item.id}`} className="text-base font-medium transition hover:text-[var(--atlas-accent-strong)]">
                  {item.title}
                </a>
                <p className="mt-2 text-sm leading-6 text-[var(--atlas-muted)]">{item.summary}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--atlas-accent-strong)]">
                  {item.buyerOrganizationName ?? "No buyer"} · {item.requestStatus ?? "No request status"}
                </p>
              </article>
            ))}
          </div>
        </Panel>
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <RecordListPanel
          eyebrow="Attention queue"
          title="Notifications"
          description="Operator alerts stay compact, deduplicated, and directly linked to the case that needs action."
          items={recentNotificationItems}
          emptyTitle="No operator alerts"
          emptyDescription="Atlas will show notification traffic here once exception conditions are active."
        />
        <RecordListPanel
          eyebrow="Audit explorer"
          title="Recent operator-facing audit events"
          description="System and human actions remain visible together so every intervention stays legible."
          items={recentAuditItems}
          emptyTitle="No recent audit events"
          emptyDescription="Audit activity appears here as Atlas records request, payment, receipt, and operator actions."
        />
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <RecordListPanel
          eyebrow="Rail mix"
          title="Payment rail distribution"
          description="Operators can now see which rails are carrying the most platform payment volume before programmable settlement expands."
          items={analytics.railMix.map((item) => ({
            id: item.key,
            title: item.label,
            description: `${item.count} payments`,
            detail: `${Math.round(item.share * 100)}% of platform payment volume`,
            statusLabel: `${item.count} payments`,
            statusTone: item.share >= 0.4 ? "warning" : "success"
          }))}
          emptyTitle="No rail analytics yet"
          emptyDescription="Rail mix appears once payments have been executed."
        />
        <RecordListPanel
          eyebrow="Category mix"
          title="Service category demand"
          description="Shows where request demand is concentrating across the platform by service category."
          items={analytics.categoryMix.map((item) => ({
            id: item.key,
            title: item.label,
            description: `${item.count} requests`,
            detail: `${Math.round(item.share * 100)}% of platform request volume`,
            statusLabel: `${item.count} requests`,
            statusTone: item.share >= 0.4 ? "warning" : "success"
          }))}
          emptyTitle="No category analytics yet"
          emptyDescription="Category mix appears once requests are active across the platform."
        />
      </section>
    </div>
  );
}
