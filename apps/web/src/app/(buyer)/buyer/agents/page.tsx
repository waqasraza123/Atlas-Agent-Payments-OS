import { listBuyerAgents, listBuyerPolicies } from "@atlas/database";
import { PageHeader, Panel, RecordListPanel } from "@atlas/ui";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { createBuyerAgentAction, updateBuyerAgentAction } from "../actions";
import { WorkflowFeedbackPanel } from "@/components/workflow-feedback-panel";
import { WorkflowFormField } from "@/components/workflow-form-field";
import { WorkflowFormPanel } from "@/components/workflow-form-panel";

const inputClassName =
  "w-full rounded-2xl border border-[var(--atlas-line)] bg-black/20 px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition placeholder:text-[var(--atlas-muted)] focus:border-[var(--atlas-accent-strong)]";

type BuyerAgentsPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

function readSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BuyerAgentsPage({ searchParams }: BuyerAgentsPageProps) {
  const resolution = await resolveWorkspaceActor("BUYER");

  if (resolution.status !== "ready") {
    return null;
  }

  const [params, agents, policies] = await Promise.all([
    searchParams,
    listBuyerAgents(resolution.actor.organization.id),
    listBuyerPolicies(resolution.actor.organization.id)
  ]);

  const feedbackTitle = readSingleSearchParam(params.feedbackTitle);
  const feedbackDescription = readSingleSearchParam(params.feedbackDescription);
  const feedbackTone = readSingleSearchParam(params.feedbackTone);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Buyer agents"
        title="Agent management baseline"
        description="Create accountable buyer agents, connect them to active policies, and keep their spend authority explicit."
      />
      {feedbackTitle && feedbackDescription ? (
        <WorkflowFeedbackPanel
          title={feedbackTitle}
          description={feedbackDescription}
          tone={feedbackTone === "error" || feedbackTone === "warning" ? feedbackTone : "default"}
        />
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <WorkflowFormPanel
          eyebrow="Create agent"
          title="Add a buyer agent"
          description="New agents enter the control plane with explicit purpose, policy context, and local-first lifecycle status."
          action={createBuyerAgentAction}
          submitLabel="Create agent"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <WorkflowFormField label="Agent name">
              <input className={inputClassName} type="text" name="name" placeholder="Procurement Research Agent" required />
            </WorkflowFormField>
            <WorkflowFormField label="External reference">
              <input className={inputClassName} type="text" name="externalRef" placeholder="agent://atlas/new-agent" />
            </WorkflowFormField>
          </div>
          <WorkflowFormField label="Purpose">
            <textarea
              className={`${inputClassName} min-h-28`}
              name="purpose"
              placeholder="Describe the paid digital actions this agent is allowed to initiate."
              required
            />
          </WorkflowFormField>
          <div className="grid gap-4 md:grid-cols-2">
            <WorkflowFormField label="Policy link">
              <select className={inputClassName} name="policyId" defaultValue="">
                <option value="">No linked policy</option>
                {policies.map((policy) => (
                  <option key={policy.id} value={policy.id}>
                    {policy.name}
                  </option>
                ))}
              </select>
            </WorkflowFormField>
            <WorkflowFormField label="Initial status">
              <select className={inputClassName} name="status" defaultValue="DRAFT">
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </WorkflowFormField>
          </div>
        </WorkflowFormPanel>
        <RecordListPanel
          eyebrow="Current inventory"
          title="Buyer agents"
          description="Each agent remains tied to an explicit buyer policy and recent request history."
          items={agents.map((agent) => ({
            id: agent.id,
            title: agent.name,
            description: agent.purpose ?? "No purpose recorded",
            detail: `${agent.requestCount} requests · ${agent.policyName ?? "No linked policy"}`,
            statusLabel: agent.status,
            statusTone: agent.status === "ACTIVE" ? "success" : agent.status === "PAUSED" ? "warning" : "default"
          }))}
          emptyTitle="No buyer agents yet"
          emptyDescription="Create the first buyer agent to make the control loop operational."
        />
      </div>
      <div className="grid gap-4">
        {agents.map((agent) => (
          <Panel key={agent.id} className="p-6">
            <div className="mb-4 space-y-1">
              <h2 className="text-lg font-semibold">{agent.name}</h2>
              <p className="text-sm text-[var(--atlas-muted)]">
                {agent.purpose ?? "No purpose recorded"} · {agent.requestCount} requests linked
              </p>
            </div>
            <form action={updateBuyerAgentAction.bind(null, agent.id)} className="grid gap-4 lg:grid-cols-4">
              <WorkflowFormField label="Name">
                <input className={inputClassName} type="text" name="name" defaultValue={agent.name} required />
              </WorkflowFormField>
              <WorkflowFormField label="External reference">
                <input className={inputClassName} type="text" name="externalRef" defaultValue={agent.externalRef ?? ""} />
              </WorkflowFormField>
              <WorkflowFormField label="Status">
                <select className={inputClassName} name="status" defaultValue={agent.status}>
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PAUSED">Paused</option>
                  <option value="DISABLED">Disabled</option>
                </select>
              </WorkflowFormField>
              <WorkflowFormField label="Policy">
                <select className={inputClassName} name="policyId" defaultValue={agent.policyId ?? ""}>
                  <option value="">No linked policy</option>
                  {policies.map((policy) => (
                    <option key={policy.id} value={policy.id}>
                      {policy.name}
                    </option>
                  ))}
                </select>
              </WorkflowFormField>
              <div className="lg:col-span-4">
                <WorkflowFormField label="Purpose">
                  <textarea className={`${inputClassName} min-h-24`} name="purpose" defaultValue={agent.purpose ?? ""} required />
                </WorkflowFormField>
              </div>
              <div className="lg:col-span-4 flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center rounded-full border border-[var(--atlas-accent-strong)] bg-[var(--atlas-accent)] px-5 py-2.5 text-sm font-medium text-[var(--atlas-ink)] transition hover:border-[var(--atlas-ink)] hover:bg-[var(--atlas-accent-strong)]"
                >
                  Update agent
                </button>
              </div>
            </form>
          </Panel>
        ))}
      </div>
    </div>
  );
}
