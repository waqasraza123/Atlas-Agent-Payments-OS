import { listBuyerAgents, listBuyerPolicies, listBuyerRequestAnalyticsForActor, prisma } from "@atlas/database";
import { PageHeader, RecordListPanel } from "@atlas/ui";
import { FilterPanel } from "@/components/filter-panel";
import { ExportLinkGroup } from "@/components/export-link-group";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { getAtlasWorkspaceDetailHref } from "@/lib/detail-hrefs";
import { formatCurrencyMinor } from "@/lib/formatters";
import { createBuyerRequestAction } from "../actions";
import { WorkflowFeedbackPanel } from "@/components/workflow-feedback-panel";
import { WorkflowFormField } from "@/components/workflow-form-field";
import { WorkflowFormPanel } from "@/components/workflow-form-panel";

const inputClassName =
  "w-full rounded-2xl border border-[var(--atlas-line)] bg-black/20 px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition placeholder:text-[var(--atlas-muted)] focus:border-[var(--atlas-accent-strong)]";

type BuyerRequestsPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

function readSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BuyerRequestsPage({ searchParams }: BuyerRequestsPageProps) {
  const resolution = await resolveWorkspaceActor("BUYER");

  if (resolution.status !== "ready") {
    return null;
  }

  const params = await searchParams;

  const [agents, policies, requests, sellers] = await Promise.all([
    listBuyerAgents(resolution.actor.organization.id),
    listBuyerPolicies(resolution.actor.organization.id),
    listBuyerRequestAnalyticsForActor(resolution.actor, params),
    prisma.organization.findMany({
      where: {
        kind: "SELLER"
      },
      orderBy: {
        name: "asc"
      }
    })
  ]);

  const feedbackTitle = readSingleSearchParam(params.feedbackTitle);
  const feedbackDescription = readSingleSearchParam(params.feedbackDescription);
  const feedbackTone = readSingleSearchParam(params.feedbackTone);
  const query = readSingleSearchParam(params.query) ?? "";
  const requestStatus = readSingleSearchParam(params.requestStatus) ?? "";
  const paymentStatus = readSingleSearchParam(params.paymentStatus) ?? "";
  const serviceCategory = readSingleSearchParam(params.serviceCategory) ?? "";
  const riskLevel = readSingleSearchParam(params.riskLevel) ?? "";
  const exportSearch = new URLSearchParams();

  if (query) {
    exportSearch.set("query", query);
  }
  if (requestStatus) {
    exportSearch.set("requestStatus", requestStatus);
  }
  if (paymentStatus) {
    exportSearch.set("paymentStatus", paymentStatus);
  }
  if (serviceCategory) {
    exportSearch.set("serviceCategory", serviceCategory);
  }
  if (riskLevel) {
    exportSearch.set("riskLevel", riskLevel);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Buyer requests"
        title="Spend request creation baseline"
        description="Create real buyer-side spend requests, evaluate them against the active policy posture, and keep the resulting lifecycle visible."
      />
      {feedbackTitle && feedbackDescription ? (
        <WorkflowFeedbackPanel
          title={feedbackTitle}
          description={feedbackDescription}
          tone={feedbackTone === "error" || feedbackTone === "warning" ? feedbackTone : "default"}
        />
      ) : null}
      <div className="flex justify-end">
        <ExportLinkGroup
          links={[
            {
              label: "Export filtered buyer requests",
              href: `/buyer/requests/export.csv${exportSearch.size > 0 ? `?${exportSearch.toString()}` : ""}`
            }
          ]}
        />
      </div>
      <WorkflowFormPanel
        eyebrow="Create request"
        title="Submit a spend request"
        description="Every request captures the buyer actor, selected agent, policy context, seller boundary, and the intended paid digital action."
        action={createBuyerRequestAction}
        submitLabel="Create request"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <WorkflowFormField label="Request title">
            <input className={inputClassName} type="text" name="title" placeholder="Premium dataset unlock" required />
          </WorkflowFormField>
          <WorkflowFormField label="Idempotency key" hint="Optional but recommended for repeat-safe request creation">
            <input className={inputClassName} type="text" name="idempotencyKey" placeholder="buyer-dataset-refresh-001" />
          </WorkflowFormField>
        </div>
        <WorkflowFormField label="Purpose">
          <textarea
            className={`${inputClassName} min-h-28`}
            name="purpose"
            placeholder="Explain why the agent needs this paid digital action and what result it should unlock."
            required
          />
        </WorkflowFormField>
        <div className="grid gap-4 md:grid-cols-3">
          <WorkflowFormField label="Agent">
            <select className={inputClassName} name="agentId" defaultValue="" required>
              <option value="" disabled>
                Select agent
              </option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </WorkflowFormField>
          <WorkflowFormField label="Policy override">
            <select className={inputClassName} name="policyId" defaultValue="">
              <option value="">Use linked agent policy</option>
              {policies.map((policy) => (
                <option key={policy.id} value={policy.id}>
                  {policy.name}
                </option>
              ))}
            </select>
          </WorkflowFormField>
          <WorkflowFormField label="Seller organization">
            <select className={inputClassName} name="sellerOrganizationId" defaultValue="" required>
              <option value="" disabled>
                Select seller
              </option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.name}
                </option>
              ))}
            </select>
          </WorkflowFormField>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <WorkflowFormField label="Amount minor">
            <input className={inputClassName} type="number" name="amountMinor" min="1" placeholder="2400" required />
          </WorkflowFormField>
          <WorkflowFormField label="Currency">
            <input className={inputClassName} type="text" name="currency" defaultValue="USD" maxLength={3} required />
          </WorkflowFormField>
          <WorkflowFormField label="Service category">
            <input className={inputClassName} type="text" name="serviceCategory" placeholder="api-access" required />
          </WorkflowFormField>
          <WorkflowFormField label="Service key">
            <input className={inputClassName} type="text" name="serviceKey" placeholder="global-dataset-access" />
          </WorkflowFormField>
        </div>
      </WorkflowFormPanel>
      <FilterPanel
        eyebrow="Filters"
        title="Refine the buyer request ledger"
        description="Search by title, purpose, agent, seller, or service context, then tighten the ledger by lifecycle status and risk posture."
        submitLabel="Apply filters"
      >
        <input className={inputClassName} type="search" name="query" defaultValue={query} placeholder="Search requests, sellers, or agents" />
        <select className={inputClassName} name="requestStatus" defaultValue={requestStatus}>
          <option value="">All request statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="APPROVED">Approved</option>
          <option value="EXECUTING">Executing</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELED">Canceled</option>
        </select>
        <select className={inputClassName} name="paymentStatus" defaultValue={paymentStatus}>
          <option value="">All payment statuses</option>
          <option value="PENDING">Pending</option>
          <option value="AUTHORIZED">Authorized</option>
          <option value="CAPTURED">Captured</option>
          <option value="FAILED">Failed</option>
          <option value="VOIDED">Voided</option>
        </select>
        <input className={inputClassName} type="text" name="serviceCategory" defaultValue={serviceCategory} placeholder="Filter service category" />
        <select className={inputClassName} name="riskLevel" defaultValue={riskLevel}>
          <option value="">All risk postures</option>
          <option value="attention">Needs attention</option>
          <option value="healthy">Receipt available</option>
        </select>
      </FilterPanel>
      <RecordListPanel
        eyebrow="Current requests"
        title="Buyer request ledger"
        description="Requests now support search, filtering, export, and richer reconciliation posture instead of only static list visibility."
        items={requests.map((request) => ({
          id: request.id,
          title: request.title,
          description: `${formatCurrencyMinor(request.amountMinor, request.currency)} · ${request.serviceCategory} · ${request.purpose}`,
          detail: `${request.agentName} · ${request.sellerOrganizationName ?? "No seller"} · ${request.reconciliationState}`,
          href: getAtlasWorkspaceDetailHref("BUYER", "requests", request.id) ?? undefined,
          statusLabel: request.approvalStatus ? `${request.requestStatus} / ${request.approvalStatus}` : request.requestStatus,
          statusTone:
            request.requestStatus === "APPROVED" || request.requestStatus === "COMPLETED"
              ? "success"
              : request.requestStatus === "REJECTED" || request.requestStatus === "FAILED"
                ? "critical"
                : "warning"
        }))}
        emptyTitle="No buyer requests match the current filters"
        emptyDescription="Broaden the filters or create a new spend request to expand the buyer ledger."
      />
    </div>
  );
}
