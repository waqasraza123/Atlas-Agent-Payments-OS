import {
  formatAtlasOperatorActionTypeLabel,
  formatAtlasOperatorCaseSeverityLabel,
  formatAtlasOperatorCaseStatusLabel
} from "@atlas/domain";
import { DetailGrid, PageHeader, RecordListPanel, StatePanel, StatusChip, TimelinePanel } from "@atlas/ui";
import { WorkflowFeedbackPanel } from "@/components/workflow-feedback-panel";
import { WorkflowFormField } from "@/components/workflow-form-field";
import { WorkflowFormPanel } from "@/components/workflow-form-panel";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import {
  createOperatorCaseFacts,
  createOperatorCaseRelatedItems,
  createOperatorCaseTimeline,
  loadOperatorCaseDetailData
} from "@/lib/server/operator-data";
import { readWorkflowFeedback } from "@/lib/workflow-feedback";
import { performOperatorCaseActionAction } from "../../actions";

const inputClassName =
  "w-full rounded-2xl border border-[var(--atlas-line)] bg-black/20 px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition placeholder:text-[var(--atlas-muted)] focus:border-[var(--atlas-accent-strong)]";

type OperatorCaseDetailPageProps = Readonly<{
  params: Promise<{
    caseId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function OperatorCaseDetailPage({ params, searchParams }: OperatorCaseDetailPageProps) {
  const [{ caseId }, resolvedSearchParams, resolution] = await Promise.all([
    params,
    searchParams,
    resolveWorkspaceActor("OPERATOR")
  ]);

  if (resolution.status !== "ready") {
    return null;
  }

  const detail = await loadOperatorCaseDetailData(resolution.actor, caseId);

  if (!detail) {
    return (
      <StatePanel
        eyebrow="Operator case"
        title="Operator case not available"
        description="The selected case could not be found or is not available in this workspace."
        tone="warning"
      />
    );
  }

  const feedback = readWorkflowFeedback(resolvedSearchParams);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operator case detail"
        title={detail.item.title}
        description={detail.item.summary}
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusChip label={formatAtlasOperatorCaseStatusLabel(detail.item.status)} tone={detail.item.status === "RESOLVED" ? "success" : detail.item.severity === "CRITICAL" ? "critical" : "warning"} />
            <StatusChip
              label={formatAtlasOperatorCaseSeverityLabel(detail.item.severity)}
              tone={detail.item.severity === "CRITICAL" ? "critical" : detail.item.severity === "HIGH" ? "warning" : "default"}
            />
          </div>
        }
      />
      {feedback ? <WorkflowFeedbackPanel title={feedback.title} description={feedback.description} tone={feedback.tone} /> : null}
      <section className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <DetailGrid
          eyebrow="Case facts"
          title="Operational case posture"
          description="Case facts stay tied to the current request, payment, and receipt lifecycle so operator actions remain grounded."
          items={createOperatorCaseFacts(detail)}
        />
        <RecordListPanel
          eyebrow="Linked records"
          title="Related request and receipt"
          description="Open the linked lifecycle records directly from the case when deeper inspection is needed."
          items={createOperatorCaseRelatedItems(detail)}
          emptyTitle="No related records"
          emptyDescription="Atlas will link request and receipt detail here when those records are available."
        />
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <TimelinePanel
          eyebrow="Investigation trail"
          title="Actions and audit events"
          description="Every operator action and related audit event stays visible in one investigation-ready timeline."
          items={createOperatorCaseTimeline(detail)}
          emptyTitle="No investigation events recorded"
          emptyDescription="Operator actions and lifecycle audit events will appear here once investigation begins."
        />
        <WorkflowFormPanel
          eyebrow="Operator action"
          title="Record a reason-captured intervention"
          description="Pause, release, requeue, annotate, or resolve from the same case detail view. Every action requires an explicit reason and is written to the audit trail."
          action={performOperatorCaseActionAction.bind(null, caseId)}
          submitLabel="Record operator action"
        >
          <div className="space-y-4">
            <WorkflowFormField label="Action type">
              <select className={inputClassName} name="actionType" defaultValue={detail.item.availableActions[0] ?? "ANNOTATE_CASE"}>
                {detail.item.availableActions.map((actionType) => (
                  <option key={actionType} value={actionType}>
                    {formatAtlasOperatorActionTypeLabel(actionType)}
                  </option>
                ))}
              </select>
            </WorkflowFormField>
            <WorkflowFormField
              label="Reason"
              hint="Reasons are required because operator actions are part of Atlas' durable audit story."
            >
              <textarea
                className={`${inputClassName} min-h-32`}
                name="reason"
                placeholder="Describe why this operator action is necessary and what it should accomplish."
                required
              />
            </WorkflowFormField>
          </div>
        </WorkflowFormPanel>
      </section>
      <RecordListPanel
        eyebrow="Case notifications"
        title="Notification history"
        description="Operator attention items stay deduplicated and tied to the same case until the investigation is resolved."
        items={detail.notifications.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          detail: item.updatedAt,
          statusLabel: item.status,
          statusTone: item.status === "UNREAD" ? "warning" : "default"
        }))}
        emptyTitle="No notification history"
        emptyDescription="Atlas will show notification events here when this case is surfaced to the attention queue."
      />
    </div>
  );
}
