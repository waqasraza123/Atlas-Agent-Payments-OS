import { listBuyerPoliciesForActor } from "@atlas/database";
import { PageHeader, Panel, RecordListPanel } from "@atlas/ui";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { createBuyerPolicyAction, updateBuyerPolicyAction } from "../actions";
import { WorkflowFeedbackPanel } from "@/components/workflow-feedback-panel";
import { WorkflowFormField } from "@/components/workflow-form-field";
import { WorkflowFormPanel } from "@/components/workflow-form-panel";

const inputClassName =
  "w-full rounded-2xl border border-[var(--atlas-line)] bg-black/20 px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition placeholder:text-[var(--atlas-muted)] focus:border-[var(--atlas-accent-strong)]";

type BuyerPoliciesPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

function readSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "None";
}

export default async function BuyerPoliciesPage({ searchParams }: BuyerPoliciesPageProps) {
  const resolution = await resolveWorkspaceActor("BUYER");

  if (resolution.status !== "ready") {
    return null;
  }

  const [params, policies] = await Promise.all([searchParams, listBuyerPoliciesForActor(resolution.actor)]);

  const feedbackTitle = readSingleSearchParam(params.feedbackTitle);
  const feedbackDescription = readSingleSearchParam(params.feedbackDescription);
  const feedbackTone = readSingleSearchParam(params.feedbackTone);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Buyer policies"
        title="Policy management baseline"
        description="Define the bounded-authority layer that will evaluate agent spend requests and determine approval posture."
      />
      {feedbackTitle && feedbackDescription ? (
        <WorkflowFeedbackPanel
          title={feedbackTitle}
          description={feedbackDescription}
          tone={feedbackTone === "error" || feedbackTone === "warning" ? feedbackTone : "default"}
        />
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <WorkflowFormPanel
          eyebrow="Create policy"
          title="Add a buyer policy"
          description="Policies carry the current rule baseline for per-action limits, approval posture, and seller or service boundaries."
          action={createBuyerPolicyAction}
          submitLabel="Create policy"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <WorkflowFormField label="Policy name">
              <input className={inputClassName} type="text" name="name" placeholder="Low Risk API Access" required />
            </WorkflowFormField>
            <WorkflowFormField label="Status">
              <select className={inputClassName} name="status" defaultValue="DRAFT">
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </WorkflowFormField>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <WorkflowFormField label="Max amount minor">
              <input className={inputClassName} type="number" name="maxAmountMinor" min="1" placeholder="5000" />
            </WorkflowFormField>
            <WorkflowFormField label="Auto-approval threshold">
              <input className={inputClassName} type="number" name="autoApprovalThresholdMinor" min="0" placeholder="2500" />
            </WorkflowFormField>
            <WorkflowFormField label="Escalation threshold">
              <input className={inputClassName} type="number" name="escalationThresholdMinor" min="0" placeholder="10000" />
            </WorkflowFormField>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <WorkflowFormField label="Seller allowlist" hint="Comma-separated seller organization ids">
              <input className={inputClassName} type="text" name="sellerAllowlist" placeholder="seller-id-a,seller-id-b" />
            </WorkflowFormField>
            <WorkflowFormField label="Service allowlist" hint="Comma-separated service keys">
              <input className={inputClassName} type="text" name="serviceAllowlist" placeholder="benchmark-api,global-dataset-access" />
            </WorkflowFormField>
            <WorkflowFormField label="Service categories" hint="Comma-separated categories">
              <input className={inputClassName} type="text" name="serviceCategories" placeholder="api-access,digital-service" />
            </WorkflowFormField>
          </div>
          <label className="flex items-center gap-3 text-sm text-[var(--atlas-ink)]">
            <input type="checkbox" name="emergencyStop" className="h-4 w-4 rounded border-[var(--atlas-line)] bg-black/20" />
            Emergency stop
          </label>
        </WorkflowFormPanel>
        <RecordListPanel
          eyebrow="Current policies"
          title="Buyer policy inventory"
          description="Each policy tracks the rule shape and linked request history needed for later versioned control."
          items={policies.map((policy) => ({
            id: policy.id,
            title: policy.name,
            description: `${policy.linkedAgentCount} linked agents · ${policy.requestCount} requests · v${policy.version}`,
            detail: `Sellers: ${policy.rules.sellerAllowlist.length} · Services: ${policy.rules.serviceAllowlist.length}`,
            statusLabel: policy.status,
            statusTone: policy.status === "ACTIVE" ? "success" : policy.status === "ARCHIVED" ? "critical" : "warning"
          }))}
          emptyTitle="No buyer policies yet"
          emptyDescription="Create the first active policy before submitting new spend requests."
        />
      </div>
      <div className="grid gap-4">
        {policies.map((policy) => (
          <Panel key={policy.id} className="p-6">
            <div className="mb-4 space-y-1">
              <h2 className="text-lg font-semibold">{policy.name}</h2>
              <p className="text-sm text-[var(--atlas-muted)]">
                v{policy.version} · Sellers: {formatList(policy.rules.sellerAllowlist)} · Services: {formatList(policy.rules.serviceAllowlist)}
              </p>
            </div>
            <form action={updateBuyerPolicyAction.bind(null, policy.id)} className="grid gap-4 lg:grid-cols-3">
              <WorkflowFormField label="Name">
                <input className={inputClassName} type="text" name="name" defaultValue={policy.name} required />
              </WorkflowFormField>
              <WorkflowFormField label="Status">
                <select className={inputClassName} name="status" defaultValue={policy.status}>
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </WorkflowFormField>
              <WorkflowFormField label="Max amount minor">
                <input className={inputClassName} type="number" name="maxAmountMinor" min="1" defaultValue={policy.rules.maxAmountMinor ?? ""} />
              </WorkflowFormField>
              <WorkflowFormField label="Auto-approval threshold">
                <input
                  className={inputClassName}
                  type="number"
                  name="autoApprovalThresholdMinor"
                  min="0"
                  defaultValue={policy.rules.autoApprovalThresholdMinor ?? ""}
                />
              </WorkflowFormField>
              <WorkflowFormField label="Escalation threshold">
                <input
                  className={inputClassName}
                  type="number"
                  name="escalationThresholdMinor"
                  min="0"
                  defaultValue={policy.rules.escalationThresholdMinor ?? ""}
                />
              </WorkflowFormField>
              <WorkflowFormField label="Service categories">
                <input className={inputClassName} type="text" name="serviceCategories" defaultValue={policy.rules.serviceCategories.join(", ")} />
              </WorkflowFormField>
              <WorkflowFormField label="Seller allowlist">
                <input className={inputClassName} type="text" name="sellerAllowlist" defaultValue={policy.rules.sellerAllowlist.join(", ")} />
              </WorkflowFormField>
              <WorkflowFormField label="Service allowlist">
                <input className={inputClassName} type="text" name="serviceAllowlist" defaultValue={policy.rules.serviceAllowlist.join(", ")} />
              </WorkflowFormField>
              <label className="flex items-center gap-3 text-sm text-[var(--atlas-ink)]">
                <input
                  type="checkbox"
                  name="emergencyStop"
                  className="h-4 w-4 rounded border-[var(--atlas-line)] bg-black/20"
                  defaultChecked={policy.rules.emergencyStop}
                />
                Emergency stop
              </label>
              <div className="lg:col-span-3 flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center rounded-full border border-[var(--atlas-accent-strong)] bg-[var(--atlas-accent)] px-5 py-2.5 text-sm font-medium text-[var(--atlas-ink)] transition hover:border-[var(--atlas-ink)] hover:bg-[var(--atlas-accent-strong)]"
                >
                  Update policy
                </button>
              </div>
            </form>
          </Panel>
        ))}
      </div>
    </div>
  );
}
