import { listBuyerApprovalsForActor } from "@atlas/database";
import { PageHeader, Panel, RecordListPanel } from "@atlas/ui";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { getAtlasWorkspaceDetailHref } from "@/lib/detail-hrefs";
import { decideBuyerApprovalAction } from "../actions";
import { WorkflowFeedbackPanel } from "@/components/workflow-feedback-panel";
import { WorkflowFormField } from "@/components/workflow-form-field";

const inputClassName =
  "w-full rounded-2xl border border-[var(--atlas-line)] bg-black/20 px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition placeholder:text-[var(--atlas-muted)] focus:border-[var(--atlas-accent-strong)]";

type BuyerApprovalsPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

function readSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatCurrencyMinor(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(amountMinor / 100);
}

export default async function BuyerApprovalsPage({ searchParams }: BuyerApprovalsPageProps) {
  const resolution = await resolveWorkspaceActor("BUYER");

  if (resolution.status !== "ready") {
    return null;
  }

  const [params, approvals] = await Promise.all([searchParams, listBuyerApprovalsForActor(resolution.actor)]);

  const feedbackTitle = readSingleSearchParam(params.feedbackTitle);
  const feedbackDescription = readSingleSearchParam(params.feedbackDescription);
  const feedbackTone = readSingleSearchParam(params.feedbackTone);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Buyer approvals"
        title="Approval decision baseline"
        description="Review pending requests, record decision reasons, and move the request lifecycle forward with durable audit events."
      />
      {feedbackTitle && feedbackDescription ? (
        <WorkflowFeedbackPanel
          title={feedbackTitle}
          description={feedbackDescription}
          tone={feedbackTone === "error" || feedbackTone === "warning" ? feedbackTone : "default"}
        />
      ) : null}
      <RecordListPanel
        eyebrow="Approval ledger"
        title="Approvals"
          description="Pending and completed approval records now reflect the actual buyer-side decision path."
          items={approvals.map((approval) => ({
            id: approval.id,
            title: approval.requestTitle,
            description: `${formatCurrencyMinor(approval.amountMinor, approval.currency)} · ${approval.serviceCategory}`,
            detail: approval.decisionReason ?? "Awaiting buyer decision",
            href: getAtlasWorkspaceDetailHref("BUYER", "approvals", approval.id) ?? undefined,
            statusLabel: approval.status,
            statusTone: approval.status === "APPROVED" ? "success" : approval.status === "REJECTED" ? "critical" : "warning"
          }))}
        emptyTitle="No approvals yet"
        emptyDescription="Create a request above the auto-approval threshold to populate the buyer approval queue."
      />
      <div className="grid gap-4">
        {approvals
          .filter((approval) => approval.status === "PENDING")
          .map((approval) => (
            <Panel key={approval.id} className="p-6">
              <div className="mb-4 space-y-1">
                <h2 className="text-lg font-semibold">{approval.requestTitle}</h2>
                <p className="text-sm text-[var(--atlas-muted)]">
                  {formatCurrencyMinor(approval.amountMinor, approval.currency)} · {approval.serviceCategory}
                </p>
              </div>
              <form action={decideBuyerApprovalAction.bind(null, approval.id)} className="grid gap-4 lg:grid-cols-[minmax(0,0.24fr)_minmax(0,1fr)_auto]">
                <WorkflowFormField label="Decision">
                  <select className={inputClassName} name="decision" defaultValue="approve">
                    <option value="approve">Approve</option>
                    <option value="deny">Deny</option>
                  </select>
                </WorkflowFormField>
                <WorkflowFormField label="Decision reason">
                  <input
                    className={inputClassName}
                    type="text"
                    name="decisionReason"
                    placeholder="Capture the business reason for the approval decision."
                    required
                  />
                </WorkflowFormField>
                <div className="flex items-end justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-full border border-[var(--atlas-accent-strong)] bg-[var(--atlas-accent)] px-5 py-2.5 text-sm font-medium text-[var(--atlas-ink)] transition hover:border-[var(--atlas-ink)] hover:bg-[var(--atlas-accent-strong)]"
                  >
                    Record decision
                  </button>
                </div>
              </form>
            </Panel>
          ))}
      </div>
    </div>
  );
}
