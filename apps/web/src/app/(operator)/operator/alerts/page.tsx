import { DetailGrid, MetricCard, PageHeader, RecordListPanel, StatePanel } from "@atlas/ui";
import { WorkflowFormField } from "@/components/workflow-form-field";
import { WorkflowFormPanel } from "@/components/workflow-form-panel";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import {
  createOperatorAlertItems,
  createOperatorDispatchItems,
  createOperatorIncidentItems,
  createOperatorMetricsFacts,
  createOperatorRouteMetricItems,
  createOperatorSnapshotItems,
  createOperatorWorkerQueueItems,
  loadOperatorObservabilityData
} from "@/lib/server/operator-observability";
import {
  captureObservabilitySnapshotAction,
  dispatchObservabilityAlertsAction,
  runObservabilityAutomationAction
} from "../actions";

export default async function OperatorAlertsPage() {
  const resolution = await resolveWorkspaceActor("OPERATOR");

  if (resolution.status !== "ready") {
    return null;
  }

  try {
    const observability = await loadOperatorObservabilityData(resolution.actor, resolution.selection);
    const metrics = observability.metrics;
    const alerts = observability.alerts;
    const incidentReadiness = observability.incidentReadiness;
    const workerTelemetry = observability.workerTelemetry;
    const snapshots = observability.snapshots;
    const dispatches = observability.dispatches;

    if (!metrics || !incidentReadiness) {
      return (
        <StatePanel
          eyebrow="Observability"
          title="Observability data is unavailable"
          description="Atlas could not load runtime metrics or incident-readiness posture from the API."
          tone="error"
        />
      );
    }

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Operator workspace"
          title="Alerts and incident readiness"
          description="Review runtime health, operator alert pressure, and incident response posture before issues turn into support escalations."
        />
        <section className="grid gap-4 xl:grid-cols-7">
          <MetricCard label="Total requests" value={String(metrics.totalRequests)} detail="Requests observed by the API runtime since the current process started." />
          <MetricCard label="Active alerts" value={String(alerts.length)} detail="Open or monitoring alerts derived from runtime and operator posture." />
          <MetricCard
            label="Worker status"
            value={workerTelemetry?.status ?? "missing"}
            detail={workerTelemetry?.summary ?? "Shared worker telemetry is not available."}
          />
          <MetricCard label="Retained snapshots" value={String(snapshots.length)} detail="Persisted observability snapshots kept for later incident review." />
          <MetricCard label="Alert dispatches" value={String(dispatches.length)} detail="Recent external alert dispatch attempts recorded by Atlas." />
          <MetricCard label="Server errors" value={String(metrics.errorCount)} detail="5xx responses recorded by the API runtime metrics registry." />
          <MetricCard label="Incident posture" value={incidentReadiness.overallStatus === "ready" ? "Ready" : "Warning"} detail="Current incident-readiness summary for the tracked release stage." />
        </section>
        <section className="grid gap-6 xl:grid-cols-3">
          <WorkflowFormPanel
            eyebrow="Telemetry retention"
            title="Capture retained observability snapshot"
            description="Store the current runtime metrics, alert posture, and incident-readiness state for later incident review and retention-aware trending."
            action={captureObservabilitySnapshotAction}
            submitLabel="Capture snapshot"
          >
            <WorkflowFormField label="Reason" hint="Describe why this telemetry checkpoint matters operationally.">
              <textarea
                name="reason"
                rows={4}
                minLength={12}
                className="w-full rounded-3xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm leading-6 text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
                placeholder="Capture a retained telemetry checkpoint before the next staging promotion window."
                required
              />
            </WorkflowFormField>
          </WorkflowFormPanel>
          <WorkflowFormPanel
            eyebrow="External dispatch"
            title="Dispatch current alerts externally"
            description="Send the current alert set to the owned external dispatch target while keeping a durable local report of what Atlas sent."
            action={dispatchObservabilityAlertsAction}
            submitLabel="Dispatch alerts"
          >
            <WorkflowFormField label="Minimum severity" hint="Only alerts at or above this severity will be sent externally.">
              <select
                name="minimumSeverity"
                defaultValue="warning"
                className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
              >
                <option value="critical">Critical only</option>
                <option value="warning">Warning and above</option>
                <option value="info">Info and above</option>
              </select>
            </WorkflowFormField>
            <WorkflowFormField label="Reason" hint="This reason is persisted alongside the dispatch report.">
              <textarea
                name="reason"
                rows={4}
                minLength={12}
                className="w-full rounded-3xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm leading-6 text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
                placeholder="Dispatch the current alert set to the staging operations webhook for escalation."
                required
              />
            </WorkflowFormField>
          </WorkflowFormPanel>
          <WorkflowFormPanel
            eyebrow="Owned automation"
            title="Run observability automation"
            description="Resolve the published API and worker telemetry, store a retained snapshot, and optionally dispatch alerts through the owned automation flow."
            action={runObservabilityAutomationAction}
            submitLabel="Run automation"
          >
            <WorkflowFormField label="Minimum severity" hint="Used only when automatic external dispatch is enabled.">
              <select
                name="minimumSeverity"
                defaultValue="warning"
                className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
              >
                <option value="critical">Critical only</option>
                <option value="warning">Warning and above</option>
                <option value="info">Info and above</option>
              </select>
            </WorkflowFormField>
            <WorkflowFormField label="Dispatch externally" hint="When enabled, Atlas will route the selected alerts through the configured external dispatch adapter.">
              <label className="flex items-center gap-3 rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)]">
                <input type="checkbox" name="dispatchAlerts" className="h-4 w-4 accent-[var(--atlas-accent)]" />
                Dispatch alerts after capturing the retained snapshot
              </label>
            </WorkflowFormField>
            <WorkflowFormField label="Reason" hint="This reason is stored on the automation report and downstream records.">
              <textarea
                name="reason"
                rows={4}
                minLength={12}
                className="w-full rounded-3xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm leading-6 text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
                placeholder="Run the owned observability automation before the next on-call handoff."
                required
              />
            </WorkflowFormField>
          </WorkflowFormPanel>
        </section>
        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <RecordListPanel
            eyebrow="Alert queue"
            title="Current observability alerts"
            description="Alerts combine runtime readiness, API error posture, and operator workload so triage starts from one screen."
            items={createOperatorAlertItems(alerts)}
            emptyTitle="No active alerts"
            emptyDescription="Atlas is not currently surfacing runtime or operator alerts that need follow-up."
          />
          <div className="space-y-6">
            <DetailGrid
              eyebrow="Runtime facts"
              title="API observability snapshot"
              description="Runtime metrics stay tied to startup validation and release verification so operators can judge whether an issue is operational or release-induced."
              items={createOperatorMetricsFacts(metrics)}
            />
            <StatePanel
              eyebrow="Response posture"
              title="Incident response is codified in the repo"
              description="Runbooks now cover observability, backup and restore, rollback readiness, and environment promotion so operator response is not trapped in chat history."
              tone={incidentReadiness.overallStatus === "ready" ? "default" : "warning"}
            />
          </div>
        </section>
        <section className="grid gap-6 xl:grid-cols-2">
          <RecordListPanel
            eyebrow="Worker telemetry"
            title="Worker queue runtime"
            description={workerTelemetry?.summary ?? "Shared worker telemetry is not available to the operator surface yet."}
            items={createOperatorWorkerQueueItems(workerTelemetry ?? null)}
            emptyTitle="No worker queue telemetry"
            emptyDescription="Start the worker to publish queue runtime telemetry into the shared observability snapshot directory."
          />
          <RecordListPanel
            eyebrow="Retained telemetry"
            title="Recent observability snapshots"
            description="Snapshots preserve alert and runtime posture beyond the current process lifetime."
            items={createOperatorSnapshotItems(snapshots)}
            emptyTitle="No retained snapshots"
            emptyDescription="Capture a snapshot to start building retained observability history."
          />
          <RecordListPanel
            eyebrow="Dispatch history"
            title="Recent external alert dispatches"
            description="Every external dispatch is recorded locally so incident review can verify what was sent and when."
            items={createOperatorDispatchItems(dispatches)}
            emptyTitle="No dispatch history"
            emptyDescription="External alert dispatches will appear here after the first operator-triggered run."
          />
        </section>
        <section className="grid gap-6 xl:grid-cols-2">
          <RecordListPanel
            eyebrow="Runtime metrics"
            title="Highest-traffic API routes"
            description="This route summary keeps latency, error posture, and recency visible during triage."
            items={createOperatorRouteMetricItems(metrics)}
            emptyTitle="No route metrics yet"
            emptyDescription="Route metrics will appear after the API handles requests in the current process."
          />
          <RecordListPanel
            eyebrow="Incident checklist"
            title="Incident-readiness baseline"
            description="Every item maps to a repo-owned runbook so incident posture remains verifiable."
            items={createOperatorIncidentItems(incidentReadiness)}
            emptyTitle="No incident-readiness data"
            emptyDescription="Atlas could not compute incident-readiness posture for the current release stage."
          />
        </section>
      </div>
    );
  } catch (error) {
    return (
      <StatePanel
        eyebrow="Observability"
        title="Operator observability could not be loaded"
        description={error instanceof Error ? error.message : "Unknown observability failure"}
        tone="error"
      />
    );
  }
}
