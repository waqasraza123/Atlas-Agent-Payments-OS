import { listPlatformOrganizations, prisma } from "@atlas/database";
import { MetricCard, PageHeader, RecordListPanel } from "@atlas/ui";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { WorkflowFormField } from "@/components/workflow-form-field";
import { WorkflowFormPanel } from "@/components/workflow-form-panel";
import { createSupportAccessSessionAction } from "../actions";

export default async function OperatorSupportAccessPage() {
  const resolution = await resolveWorkspaceActor("OPERATOR");

  if (resolution.status !== "ready") {
    return null;
  }

  const [organizations, targetOrganizations] = await Promise.all([
    listPlatformOrganizations().then((items) =>
      items.filter((organization) => organization.organizationKind === "BUYER" || organization.organizationKind === "SELLER")
    ),
    prisma.organization.findMany({
      where: {
        kind: {
          in: ["BUYER", "SELLER"]
        }
      },
      orderBy: {
        name: "asc"
      },
      select: {
        id: true,
        slug: true,
        name: true,
        kind: true
      }
    })
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operator support access"
        title="Scoped tenant support sessions"
        description="Issue a short-lived read-only support session when operator investigation needs to inspect a buyer or seller workspace without silently bypassing tenant boundaries."
      />
      <section className="grid gap-4 xl:grid-cols-3">
        <MetricCard
          label="Available targets"
          value={String(organizations.length)}
          detail="Buyer and seller organizations that can be targeted for constrained support sessions."
        />
        <MetricCard
          label="Support mode"
          value="Read-only"
          detail="Support sessions are limited to inspection routes and cannot submit workflow mutations."
        />
        <MetricCard
          label="Session TTL"
          value="60 min"
          detail="Short-lived support sessions reduce accidental long-running tenant access."
        />
      </section>
      <WorkflowFormPanel
        eyebrow="Grant support scope"
        title="Create a constrained support session"
        description="The issued session keeps your operator identity but narrows the effective organization and workspace to one buyer or seller tenant."
        action={createSupportAccessSessionAction}
        submitLabel="Enter support mode"
      >
        <WorkflowFormField label="Target organization" hint="Choose the tenant that needs support investigation.">
          <select
            name="targetOrganizationSlug"
            className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
            defaultValue={targetOrganizations[0]?.slug ?? ""}
            required
          >
            {targetOrganizations.map((organization) => (
              <option key={organization.id} value={organization.slug}>
                {organization.name} ({organization.kind})
              </option>
            ))}
          </select>
        </WorkflowFormField>
        <WorkflowFormField label="Target workspace" hint="Support sessions are limited to buyer and seller workspaces.">
          <select
            name="targetWorkspace"
            className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
            defaultValue="BUYER"
            required
          >
            <option value="BUYER">Buyer</option>
            <option value="SELLER">Seller</option>
          </select>
        </WorkflowFormField>
        <WorkflowFormField label="Reason" hint="Reason is required for auditability and later review.">
          <textarea
            name="reason"
            rows={4}
            minLength={12}
            className="w-full rounded-3xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm leading-6 text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
            placeholder="Investigate a failed settlement and receipt mismatch for a design-partner buyer."
            required
          />
        </WorkflowFormField>
      </WorkflowFormPanel>
      <RecordListPanel
        eyebrow="Target inventory"
        title="Tenant support candidates"
        description="Organization activity remains visible before support scope is issued so operator review can choose the right tenant deliberately."
        items={organizations.map((organization) => ({
          id: organization.organizationId,
          title: organization.organizationName,
          description: `${organization.organizationKind} · ${organization.requestCount} requests · ${organization.paymentCount} payments`,
          detail: `${organization.receiptAvailableCount} available receipts · ${organization.openCaseCount} open cases`,
          statusLabel: organization.organizationKind,
          statusTone: organization.openCaseCount > 0 ? "warning" : "default"
        }))}
        emptyTitle="No support targets available"
        emptyDescription="Tenant targets will appear once buyer or seller organizations exist."
      />
    </div>
  );
}
