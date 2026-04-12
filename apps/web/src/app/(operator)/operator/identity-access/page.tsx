import { listExternalIdentityAssignments, prisma } from "@atlas/database";
import { authRuntime } from "@atlas/config";
import { MetricCard, PageHeader, Panel, RecordListPanel } from "@atlas/ui";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { WorkflowFormField } from "@/components/workflow-form-field";
import { WorkflowFormPanel } from "@/components/workflow-form-panel";
import {
  provisionExternalIdentityAssignmentAction,
  updateExternalIdentityAssignmentLifecycleAction
} from "../actions";

export default async function OperatorIdentityAccessPage() {
  const resolution = await resolveWorkspaceActor("OPERATOR");

  if (resolution.status !== "ready") {
    return null;
  }

  const [organizations, assignments] = await Promise.all([
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
    }),
    listExternalIdentityAssignments(resolution.actor)
  ]);

  const activeAssignments = assignments.filter((assignment) => assignment.status === "ACTIVE");
  const suspendedAssignments = assignments.filter((assignment) => assignment.status === "SUSPENDED");
  const revokedAssignments = assignments.filter((assignment) => assignment.status === "REVOKED");
  const liveAssignments = assignments.filter((assignment) => assignment.activeSessionCount > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operator identity access"
        title="Provision external tenant identities"
        description="Atlas now requires an explicit external identity assignment before an external provider token can exchange into a tenant-scoped Atlas session."
      />
      <section className="grid gap-4 xl:grid-cols-4">
        <MetricCard
          label="Available targets"
          value={String(organizations.length)}
          detail="Buyer and seller organizations that can receive external identity assignments."
        />
        <MetricCard
          label="Active assignments"
          value={String(activeAssignments.length)}
          detail="Assignments that can currently exchange provider tokens into Atlas sessions."
        />
        <MetricCard
          label="Suspended assignments"
          value={String(suspendedAssignments.length)}
          detail="Assignments that remain recorded but cannot exchange into Atlas until they are reactivated."
        />
        <MetricCard
          label="Live provider sessions"
          value={String(liveAssignments.length)}
          detail="Assignments with at least one currently active provider-backed Atlas session."
        />
      </section>
      <WorkflowFormPanel
        eyebrow="Provision assignment"
        title="Grant provider-backed tenant access"
        description="Provisioning creates or reactivates a tenant-scoped external identity assignment and, if needed, creates the matching Atlas user membership."
        action={provisionExternalIdentityAssignmentAction}
        submitLabel="Provision external identity"
      >
        <WorkflowFormField label="Provider" hint="Use the external provider label that Atlas expects during session exchange.">
          <input
            type="text"
            name="provider"
            defaultValue={authRuntime.externalOidcProvider}
            className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
            required
          />
        </WorkflowFormField>
        <WorkflowFormField label="External email" hint="This email must match the external identity token email claim.">
          <input
            type="email"
            name="externalEmail"
            className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
            placeholder="buyer-admin@example.com"
            required
          />
        </WorkflowFormField>
        <WorkflowFormField label="Display name" hint="Atlas uses this when creating the local user record if it does not exist yet.">
          <input
            type="text"
            name="userName"
            className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
            placeholder="Buyer Admin"
          />
        </WorkflowFormField>
        <WorkflowFormField label="Target organization" hint="Assignments remain tenant-scoped and can only target buyer or seller organizations.">
          <select
            name="targetOrganizationSlug"
            className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
            defaultValue={organizations[0]?.slug ?? ""}
            required
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.slug}>
                {organization.name} ({organization.kind})
              </option>
            ))}
          </select>
        </WorkflowFormField>
        <WorkflowFormField label="Target role" hint="The external identity is provisioned against one explicit Atlas membership.">
          <select
            name="targetRole"
            defaultValue="ADMIN"
            className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
            required
          >
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="OPERATOR">Operator</option>
            <option value="REVIEWER">Reviewer</option>
            <option value="FINANCE">Finance</option>
          </select>
        </WorkflowFormField>
        <WorkflowFormField label="Reason" hint="Provisioning reason is required for later access review and investigation.">
          <textarea
            name="reason"
            rows={4}
            minLength={12}
            className="w-full rounded-3xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm leading-6 text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
            placeholder="Grant design-partner buyer admin access for direct SSO rollout validation."
            required
          />
        </WorkflowFormField>
      </WorkflowFormPanel>
      <RecordListPanel
        eyebrow="Provider exchange posture"
        title="Assignments currently able to exchange"
        description="Only active assignments can exchange external provider tokens into Atlas sessions."
        items={activeAssignments.map((assignment) => ({
          id: assignment.id,
          title: `${assignment.externalEmail} -> ${assignment.organizationName}`,
          description: `${assignment.provider} · ${assignment.role} · provisioned by ${assignment.provisionedByUserEmail}`,
          detail: assignment.lastExchangedAt
            ? `Last exchanged ${new Date(assignment.lastExchangedAt).toLocaleString()} · ${assignment.activeSessionCount} active sessions`
            : `No successful exchanges yet · ${assignment.activeSessionCount} active sessions`,
          statusLabel: assignment.status,
          statusTone: assignment.activeSessionCount > 0 ? "success" : "default"
        }))}
        emptyTitle="No active assignments"
        emptyDescription="Provisioned external identities will appear here once they are active."
      />
      <section className="space-y-4">
        <PageHeader
          eyebrow="Assignment ledger"
          title="Govern external identity lifecycle"
          description="Suspend, reactivate, or revoke assignments without relying on provider-link lifecycle alone."
        />
        {assignments.length === 0 ? (
          <Panel className="p-5">
            <p className="text-sm text-[var(--atlas-muted)]">No external identity assignments have been provisioned yet.</p>
          </Panel>
        ) : (
          <div className="grid gap-4">
            {assignments.map((assignment) => (
              <Panel key={assignment.id} className="space-y-4 p-5">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[var(--atlas-ink)]">
                    {assignment.externalEmail} {"->"} {assignment.organizationName} ({assignment.role})
                  </p>
                  <p className="text-sm text-[var(--atlas-muted)]">
                    {assignment.provider} · provisioned by {assignment.provisionedByUserEmail}
                  </p>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--atlas-muted)]">
                    {assignment.status} · {assignment.activeSessionCount} active sessions · provisioned{" "}
                    {new Date(assignment.provisionedAt).toLocaleString()}
                  </p>
                  {assignment.statusReason ? (
                    <p className="text-xs text-[var(--atlas-muted)]">Reason: {assignment.statusReason}</p>
                  ) : null}
                </div>
                <div className="grid gap-4 xl:grid-cols-3">
                  {assignment.status === "ACTIVE" ? (
                    <form
                      action={updateExternalIdentityAssignmentLifecycleAction.bind(null, assignment.id)}
                      className="grid gap-3 rounded-3xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.52)] p-4"
                    >
                      <input type="hidden" name="action" value="SUSPEND" />
                      <WorkflowFormField label="Suspend" hint="Temporarily block exchange without deleting the assignment.">
                        <textarea
                          name="reason"
                          rows={3}
                          minLength={12}
                          className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm leading-6 text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
                          placeholder="Suspend direct access while the tenant ownership mapping is being reviewed."
                          required
                        />
                      </WorkflowFormField>
                      <button
                        type="submit"
                        className="rounded-full border border-[var(--atlas-line)] bg-white/4 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--atlas-ink)] transition hover:border-[var(--atlas-accent)]"
                      >
                        Suspend assignment
                      </button>
                    </form>
                  ) : null}
                  {assignment.status === "SUSPENDED" ? (
                    <form
                      action={updateExternalIdentityAssignmentLifecycleAction.bind(null, assignment.id)}
                      className="grid gap-3 rounded-3xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.52)] p-4"
                    >
                      <input type="hidden" name="action" value="REACTIVATE" />
                      <WorkflowFormField label="Reactivate" hint="Restore exchange eligibility for this tenant-scoped assignment.">
                        <textarea
                          name="reason"
                          rows={3}
                          minLength={12}
                          className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm leading-6 text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
                          placeholder="Reactivate access after confirming the tenant owner approved the rollout."
                          required
                        />
                      </WorkflowFormField>
                      <button
                        type="submit"
                        className="rounded-full border border-[var(--atlas-line)] bg-white/4 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--atlas-ink)] transition hover:border-[var(--atlas-accent)]"
                      >
                        Reactivate assignment
                      </button>
                    </form>
                  ) : null}
                  {assignment.status !== "REVOKED" ? (
                    <form
                      action={updateExternalIdentityAssignmentLifecycleAction.bind(null, assignment.id)}
                      className="grid gap-3 rounded-3xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.52)] p-4"
                    >
                      <input type="hidden" name="action" value="REVOKE" />
                      <WorkflowFormField label="Revoke" hint="End the assignment and revoke any active Atlas sessions tied to it.">
                        <textarea
                          name="reason"
                          rows={3}
                          minLength={12}
                          className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm leading-6 text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
                          placeholder="Revoke external access after offboarding the design-partner administrator."
                          required
                        />
                      </WorkflowFormField>
                      <button
                        type="submit"
                        className="rounded-full border border-[var(--atlas-line)] bg-white/4 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--atlas-ink)] transition hover:border-[var(--atlas-accent)]"
                      >
                        Revoke assignment
                      </button>
                    </form>
                  ) : null}
                </div>
              </Panel>
            ))}
          </div>
        )}
      </section>
      <RecordListPanel
        eyebrow="Inactive assignment posture"
        title="Suspended and revoked assignments"
        description="Atlas keeps non-active assignments visible so rollout and offboarding reviews stay legible."
        items={[...suspendedAssignments, ...revokedAssignments].map((assignment) => ({
          id: assignment.id,
          title: `${assignment.externalEmail} -> ${assignment.organizationName}`,
          description: `${assignment.provider} · ${assignment.role} · ${assignment.status.toLowerCase()}`,
          detail: assignment.statusChangedAt
            ? `Updated ${new Date(assignment.statusChangedAt).toLocaleString()} by ${assignment.statusChangedByUserEmail ?? "unknown operator"}`
            : "Lifecycle change not yet recorded",
          statusLabel: assignment.status,
          statusTone: assignment.status === "SUSPENDED" ? "warning" : "critical"
        }))}
        emptyTitle="No inactive assignments"
        emptyDescription="Suspended or revoked assignments will appear here after lifecycle actions are recorded."
      />
    </div>
  );
}
