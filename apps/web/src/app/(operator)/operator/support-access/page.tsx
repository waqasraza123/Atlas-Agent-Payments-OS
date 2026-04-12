import {
  listIdentityProviderSessions,
  listPlatformOrganizations,
  listSupportAccessGrants,
  listSupportAccessReviewCampaignCandidates,
  listSupportAccessReviewCampaigns,
  prisma
} from "@atlas/database";
import { authRuntime } from "@atlas/config";
import { MetricCard, PageHeader, Panel, RecordListPanel } from "@atlas/ui";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { WorkflowFormField } from "@/components/workflow-form-field";
import { WorkflowFormPanel } from "@/components/workflow-form-panel";
import {
  createSupportAccessReviewCampaignAction,
  createSupportAccessSessionAction,
  recertifySupportAccessGrantAction,
  resolveSupportAccessReviewCampaignItemAction,
  revokeIdentityProviderSessionAction,
  reviewSupportAccessGrantAction,
  revokeSupportAccessGrantAction
} from "../actions";

export default async function OperatorSupportAccessPage() {
  const resolution = await resolveWorkspaceActor("OPERATOR");

  if (resolution.status !== "ready") {
    return null;
  }

  const [organizations, targetOrganizations, grants, campaignCandidates, campaigns, identitySessions] = await Promise.all([
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
    }),
    listSupportAccessGrants(resolution.actor),
    listSupportAccessReviewCampaignCandidates(resolution.actor),
    listSupportAccessReviewCampaigns(resolution.actor),
    listIdentityProviderSessions(resolution.actor)
  ]);
  const pendingGrants = grants.filter((grant) => grant.status === "PENDING_REVIEW");
  const activeGrants = grants.filter((grant) => grant.status === "ACTIVE");
  const recertificationRequiredGrants = grants.filter((grant) => grant.status === "RECERTIFICATION_REQUIRED");
  const reviewableGrants = pendingGrants.filter((grant) => grant.issuedByUserId !== resolution.actor.user.id);
  const recertifiableGrants = recertificationRequiredGrants.filter(
    (grant) => grant.issuedByUserId !== resolution.actor.user.id
  );
  const openCampaigns = campaigns.filter((campaign) => campaign.status === "OPEN");

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
          value={`${authRuntime.supportAccessTtlMinutes} min`}
          detail="Short-lived support sessions reduce accidental long-running tenant access."
        />
        <MetricCard
          label="Tracked grants"
          value={String(grants.length)}
          detail="Support grants now persist for review, activation, revoke, and later audit inspection."
        />
        <MetricCard
          label="Recertification required"
          value={String(recertificationRequiredGrants.length)}
          detail="Active support scope now ages out of review and must be explicitly recertified before continued tenant inspection."
        />
        <MetricCard
          label="Campaign candidates"
          value={String(campaignCandidates.length)}
          detail={`Grants expiring within ${authRuntime.supportAccessReviewLookaheadHours} hours now surface as access-review campaign candidates.`}
        />
        <MetricCard
          label="Open campaigns"
          value={String(openCampaigns.length)}
          detail="Operator review campaigns group due support grants into one governance queue."
        />
        <MetricCard
          label="Live IdP sessions"
          value={String(identitySessions.length)}
          detail="External and bridged Atlas sessions can now be revoked directly from operator governance."
        />
      </section>
      <WorkflowFormPanel
        eyebrow="Request support scope"
        title="Request a constrained support grant"
        description="Support access is now a reviewable operator grant. Atlas records the request first, then an operator admin or owner approves it before support mode can start."
        action={createSupportAccessSessionAction}
        submitLabel="Request support scope"
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
      <WorkflowFormPanel
        eyebrow="Access review"
        title="Open a review campaign"
        description="Campaigns group expiring or overdue support grants into a single governance queue so recertification and revoke decisions are deliberate and traceable."
        action={createSupportAccessReviewCampaignAction}
        submitLabel="Create review campaign"
      >
        <WorkflowFormField label="Campaign title" hint="Use a durable title that makes review history legible later.">
          <input
            type="text"
            name="title"
            minLength={12}
            defaultValue={`Support access review ${new Date().toLocaleDateString()}`}
            className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
            required
          />
        </WorkflowFormField>
        <WorkflowFormField
          label="Campaign reason"
          hint="Campaign creation records why the current review window requires operator follow-up."
        >
          <textarea
            name="reason"
            rows={4}
            minLength={12}
            className="w-full rounded-3xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm leading-6 text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
            placeholder="Review support grants expiring before the next design-partner operations window."
            required
          />
        </WorkflowFormField>
      </WorkflowFormPanel>
      <RecordListPanel
        eyebrow="Candidate queue"
        title="Support grants due for governance review"
        description="These grants are already overdue or will age out of review soon."
        items={campaignCandidates.map((candidate) => ({
          id: candidate.grantId,
          title: `${candidate.targetOrganizationName} (${candidate.targetWorkspace})`,
          description: candidate.reason,
          detail: `Requested by ${candidate.issuedByUserEmail} · review ${candidate.reviewExpiresAt ? `expires ${new Date(candidate.reviewExpiresAt).toLocaleString()}` : "not set"}`,
          statusLabel: candidate.status.replaceAll("_", " "),
          statusTone: candidate.status === "RECERTIFICATION_REQUIRED" ? "warning" : "default"
        }))}
        emptyTitle="No review candidates"
        emptyDescription="Atlas will surface candidate grants here once active support scope approaches review expiry."
      />
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
      <section className="space-y-4">
        <PageHeader
          eyebrow="Governance campaigns"
          title="Access review campaigns"
          description="Campaigns bundle expiring support grants into a governed queue for recertification or revoke decisions."
        />
        {campaigns.length === 0 ? (
          <Panel className="p-5">
            <p className="text-sm text-[var(--atlas-muted)]">No access review campaigns have been created yet.</p>
          </Panel>
        ) : (
          <div className="grid gap-4">
            {campaigns.map((campaign) => (
              <Panel key={campaign.id} className="space-y-4 p-5">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[var(--atlas-ink)]">{campaign.title}</p>
                  <p className="text-sm text-[var(--atlas-muted)]">{campaign.reason}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--atlas-muted)]">
                    {campaign.status} · {campaign.pendingItemCount} pending · due {new Date(campaign.dueAt).toLocaleString()} · opened by {campaign.createdByUserEmail}
                  </p>
                </div>
                <div className="grid gap-4">
                  {campaign.items.map((item) => (
                    <Panel key={item.id} className="space-y-4 p-4">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-[var(--atlas-ink)]">
                          {item.targetOrganizationName} ({item.targetWorkspace})
                        </p>
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--atlas-muted)]">
                          {item.status} · requested by {item.issuedByUserEmail} · grant {item.grantStatus.toLowerCase().replaceAll("_", " ")}
                        </p>
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--atlas-muted)]">
                          review expires {item.reviewExpiresAt ? new Date(item.reviewExpiresAt).toLocaleString() : "not set"} · grant expires{" "}
                          {new Date(item.expiresAt).toLocaleString()}
                        </p>
                        {item.resolutionReason ? (
                          <p className="text-sm text-[var(--atlas-muted)]">{item.resolutionReason}</p>
                        ) : null}
                      </div>
                      {campaign.status === "OPEN" && item.status === "PENDING" ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          <form
                            action={resolveSupportAccessReviewCampaignItemAction.bind(null, campaign.id, item.id)}
                            className="grid gap-3"
                          >
                            <input type="hidden" name="action" value="RECERTIFY" />
                            <input
                              type="text"
                              name="reason"
                              minLength={12}
                              placeholder="Recertification reason for audit review"
                              className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
                              required
                            />
                            <button
                              type="submit"
                              className="rounded-full border border-[var(--atlas-line)] bg-white/4 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--atlas-muted)] transition hover:border-[var(--atlas-accent)] hover:text-[var(--atlas-ink)]"
                            >
                              Recertify grant
                            </button>
                          </form>
                          <form
                            action={resolveSupportAccessReviewCampaignItemAction.bind(null, campaign.id, item.id)}
                            className="grid gap-3"
                          >
                            <input type="hidden" name="action" value="REVOKE" />
                            <input
                              type="text"
                              name="reason"
                              minLength={12}
                              placeholder="Revoke reason for audit review"
                              className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
                              required
                            />
                            <button
                              type="submit"
                              className="rounded-full border border-[var(--atlas-line)] bg-white/4 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--atlas-muted)] transition hover:border-[var(--atlas-warn)] hover:text-[var(--atlas-ink)]"
                            >
                              Revoke grant
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </Panel>
                  ))}
                </div>
              </Panel>
            ))}
          </div>
        )}
      </section>
      <section className="space-y-4">
        <PageHeader
          eyebrow="Review queue"
          title="Pending support reviews"
          description="A second operator reviews support requests before Atlas allows tenant-scoped support mode."
        />
        {pendingGrants.length === 0 ? (
          <Panel className="p-5">
            <p className="text-sm text-[var(--atlas-muted)]">No support grants are awaiting review in this environment.</p>
          </Panel>
        ) : (
          <div className="grid gap-4">
            {pendingGrants.map((grant) => (
              <Panel key={grant.id} className="space-y-4 p-5">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[var(--atlas-ink)]">
                    {grant.targetOrganizationName} ({grant.targetWorkspace})
                  </p>
                  <p className="text-sm text-[var(--atlas-muted)]">{grant.reason}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--atlas-muted)]">
                    {grant.status} · requested by {grant.issuedByUserEmail} · expires {new Date(grant.expiresAt).toLocaleString()}
                  </p>
                </div>
                {grant.latestReview ? (
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--atlas-muted)]">
                    Last review: {grant.latestReview.decision} by {grant.latestReview.reviewerUserEmail}
                  </p>
                ) : (
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--atlas-muted)]">No review recorded yet.</p>
                )}
                {reviewableGrants.some((reviewableGrant) => reviewableGrant.id === grant.id) ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <form action={reviewSupportAccessGrantAction.bind(null, grant.id)} className="grid gap-3">
                      <input type="hidden" name="decision" value="APPROVED" />
                      <input
                        type="text"
                        name="reviewReason"
                        minLength={12}
                        placeholder="Approval reason for audit review"
                        className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
                        required
                      />
                      <button
                        type="submit"
                        className="rounded-full border border-[var(--atlas-line)] bg-white/4 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--atlas-muted)] transition hover:border-[var(--atlas-accent)] hover:text-[var(--atlas-ink)]"
                      >
                        Approve grant
                      </button>
                    </form>
                    <form action={reviewSupportAccessGrantAction.bind(null, grant.id)} className="grid gap-3">
                      <input type="hidden" name="decision" value="REJECTED" />
                      <input
                        type="text"
                        name="reviewReason"
                        minLength={12}
                        placeholder="Rejection reason for audit review"
                        className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
                        required
                      />
                      <button
                        type="submit"
                        className="rounded-full border border-[var(--atlas-line)] bg-white/4 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--atlas-muted)] transition hover:border-[var(--atlas-warn)] hover:text-[var(--atlas-ink)]"
                      >
                        Reject grant
                      </button>
                    </form>
                  </div>
                ) : (
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--atlas-muted)]">
                    {grant.issuedByUserId === resolution.actor.user.id
                      ? "A different operator admin or owner must review your request."
                      : "This pending grant is not reviewable from the current operator role."}
                  </p>
                )}
              </Panel>
            ))}
          </div>
        )}
      </section>
      <section className="space-y-4">
        <PageHeader
          eyebrow="Recertification"
          title="Review renewal queue"
          description="Support scope is now time-bounded by review. Active grants that age out must be recertified before operators continue using them."
        />
        {recertifiableGrants.length === 0 ? (
          <Panel className="p-5">
            <p className="text-sm text-[var(--atlas-muted)]">No support grants currently require recertification in this environment.</p>
          </Panel>
        ) : (
          <div className="grid gap-4">
            {recertifiableGrants.map((grant) => (
              <Panel key={grant.id} className="space-y-4 p-5">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[var(--atlas-ink)]">
                    {grant.targetOrganizationName} ({grant.targetWorkspace})
                  </p>
                  <p className="text-sm text-[var(--atlas-muted)]">{grant.reason}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--atlas-muted)]">
                    {grant.status} · review expires {grant.reviewExpiresAt ? new Date(grant.reviewExpiresAt).toLocaleString() : "not set"}
                  </p>
                </div>
                {grant.latestReview ? (
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--atlas-muted)]">
                    Last review: {grant.latestReview.reviewType} · {grant.latestReview.decision} by {grant.latestReview.reviewerUserEmail}
                  </p>
                ) : null}
                {recertifiableGrants.some((reviewableGrant) => reviewableGrant.id === grant.id) ? (
                  <form action={recertifySupportAccessGrantAction.bind(null, grant.id)} className="grid gap-3">
                    <input
                      type="text"
                      name="reviewReason"
                      minLength={12}
                      placeholder="Recertification reason for audit review"
                      className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
                      required
                    />
                    <button
                      type="submit"
                      className="rounded-full border border-[var(--atlas-line)] bg-white/4 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--atlas-muted)] transition hover:border-[var(--atlas-accent)] hover:text-[var(--atlas-ink)]"
                    >
                      Recertify grant
                    </button>
                  </form>
                ) : (
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--atlas-muted)]">
                    A different operator admin or owner must recertify this grant.
                  </p>
                )}
              </Panel>
            ))}
          </div>
        )}
      </section>
      <section className="space-y-4">
        <PageHeader
          eyebrow="Identity sessions"
          title="Active provider-backed tenant sessions"
          description="External and bridged Atlas sessions can now be revoked deliberately when support, security, or tenant-boundary review requires it."
        />
        {identitySessions.length === 0 ? (
          <Panel className="p-5">
            <p className="text-sm text-[var(--atlas-muted)]">No live buyer or seller identity sessions are active right now.</p>
          </Panel>
        ) : (
          <div className="grid gap-4">
            {identitySessions.map((session) => (
              <Panel key={session.id} className="space-y-4 p-5">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[var(--atlas-ink)]">
                    {session.userEmail} · {session.organizationName}
                  </p>
                  <p className="text-sm text-[var(--atlas-muted)]">
                    {session.provider} · {session.authProviderMode.toLowerCase().replaceAll("_", " ")} · {session.role}
                  </p>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--atlas-muted)]">
                    last seen {new Date(session.lastSeenAt).toLocaleString()} · expires {new Date(session.expiresAt).toLocaleString()}
                  </p>
                </div>
                <form action={revokeIdentityProviderSessionAction.bind(null, session.id)} className="grid gap-3 md:max-w-xl">
                  <input
                    type="text"
                    name="reason"
                    minLength={12}
                    placeholder="Reason for revoking this tenant session"
                    className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
                    required
                  />
                  <button
                    type="submit"
                    className="rounded-full border border-[var(--atlas-line)] bg-white/4 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--atlas-muted)] transition hover:border-[var(--atlas-warn)] hover:text-[var(--atlas-ink)]"
                  >
                    Revoke identity session
                  </button>
                </form>
              </Panel>
            ))}
          </div>
        )}
      </section>
      <section className="space-y-4">
        <PageHeader
          eyebrow="Active grants"
          title="Approved support access"
          description="Approved grants can enter read-only support mode and can still be revoked deliberately when the investigation is complete."
        />
        {activeGrants.length === 0 ? (
          <Panel className="p-5">
            <p className="text-sm text-[var(--atlas-muted)]">No approved support grants are active right now.</p>
          </Panel>
        ) : (
          <div className="grid gap-4">
            {activeGrants.map((grant) => (
              <Panel key={grant.id} className="space-y-4 p-5">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[var(--atlas-ink)]">
                    {grant.targetOrganizationName} ({grant.targetWorkspace})
                  </p>
                  <p className="text-sm text-[var(--atlas-muted)]">{grant.reason}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--atlas-muted)]">
                    active · requested by {grant.issuedByUserEmail} · expires {new Date(grant.expiresAt).toLocaleString()}
                  </p>
                </div>
                {grant.latestReview ? (
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--atlas-muted)]">
                    Approved by {grant.latestReview.reviewerUserEmail} · reviewed {new Date(grant.latestReview.createdAt).toLocaleString()} · review expires{" "}
                    {grant.reviewExpiresAt ? new Date(grant.reviewExpiresAt).toLocaleString() : "not set"}
                  </p>
                ) : null}
                <div className="grid gap-3 md:grid-cols-2">
                  {grant.issuedByUserId === resolution.actor.user.id ? (
                    <form action={createSupportAccessSessionAction} className="grid gap-3">
                      <input type="hidden" name="grantId" value={grant.id} />
                      <button
                        type="submit"
                        className="rounded-full border border-[var(--atlas-line)] bg-white/4 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--atlas-muted)] transition hover:border-[var(--atlas-accent)] hover:text-[var(--atlas-ink)]"
                      >
                        Enter support mode
                      </button>
                    </form>
                  ) : (
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--atlas-muted)]">
                      Only the requesting operator can activate this approved grant.
                    </p>
                  )}
                  <form action={revokeSupportAccessGrantAction.bind(null, grant.id)} className="grid gap-3">
                    <input
                      type="text"
                      name="revokeReason"
                      minLength={12}
                      placeholder="Revoke reason for audit review"
                      className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
                      required
                    />
                    <button
                      type="submit"
                      className="rounded-full border border-[var(--atlas-line)] bg-white/4 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--atlas-muted)] transition hover:border-[var(--atlas-accent)] hover:text-[var(--atlas-ink)]"
                    >
                      Revoke grant
                    </button>
                  </form>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
