import { getPlatformAnalytics, listPlatformOrganizations, listProgrammableSettlementOrganizations } from "@atlas/database";
import { MetricCard, PageHeader, RecordListPanel } from "@atlas/ui";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { formatDateTimeLabel, formatHoursLabel } from "@/lib/formatters";

export default async function OperatorOrganizationsPage() {
  const resolution = await resolveWorkspaceActor("OPERATOR");

  if (resolution.status !== "ready") {
    return null;
  }

  const [analytics, organizations, programmableOrganizations] = await Promise.all([
    getPlatformAnalytics(),
    listPlatformOrganizations(),
    listProgrammableSettlementOrganizations()
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operator organizations"
        title="Platform organization health"
        description="Track which organizations are active, where request and payment volume is concentrating, and which tenants still carry unresolved operational risk."
      />
      <section className="grid gap-4 xl:grid-cols-5">
        <MetricCard label="Organizations" value={String(analytics.activeOrganizationCount)} detail="Active organizations with current platform presence." />
        <MetricCard label="Active agents" value={String(analytics.activeAgentCount)} detail="Agents with at least one recorded request." />
        <MetricCard label="Requests" value={String(analytics.totalRequestCount)} detail="Total request volume visible across buyers and sellers." />
        <MetricCard label="Open exceptions" value={String(analytics.openExceptionCount)} detail="Operator cases still open or needing action." />
        <MetricCard label="Completion time" value={formatHoursLabel(analytics.averageRequestCompletionHours)} detail="Average time from request creation to terminal lifecycle state." />
      </section>
      <RecordListPanel
        eyebrow="Tenant health"
        title="Organization activity and exposure"
        description="Operator-side tenant review now includes request volume, payment volume, receipt availability, exception load, and last recorded activity."
        items={organizations.map((organization) => ({
          id: organization.organizationId,
          title: organization.organizationName,
          description: `${organization.organizationKind} · ${organization.requestCount} requests · ${organization.paymentCount} payments`,
          detail: `${organization.receiptAvailableCount} available receipts · ${organization.openCaseCount} open cases · ${formatDateTimeLabel(organization.lastActivityAt)}`,
          statusLabel: organization.organizationKind,
          statusTone: organization.openCaseCount > 0 ? "warning" : "success"
        }))}
        emptyTitle="No organizations available"
        emptyDescription="Organization health will appear once the platform has seeded or runtime tenants."
      />
      <RecordListPanel
        eyebrow="Programmable settlement"
        title="Wallet and rail readiness"
        description="Operator review now includes wallet verification posture and programmable-rail governance for buyer and seller organizations."
        items={programmableOrganizations.map((organization) => ({
          id: `${organization.organizationId}-programmable`,
          title: organization.organizationName,
          description: `${organization.organizationKind} · ${organization.wallets.length} wallets · ${organization.supportedChain.label}`,
          detail:
            organization.readiness.reasons[0] ??
            `${organization.settings.allowedRails.join(", ")} · ${organization.wallets.filter((wallet) => wallet.verificationStatus === "VERIFIED").length} verified`,
          statusLabel: organization.readiness.ready ? "Ready" : "Blocked",
          statusTone: organization.readiness.ready ? "success" : "warning"
        }))}
        emptyTitle="No programmable-settlement organizations"
        emptyDescription="Programmable settlement posture will appear once buyer and seller organizations exist."
      />
    </div>
  );
}
