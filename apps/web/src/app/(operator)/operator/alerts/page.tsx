import { DetailGrid, MetricCard, PageHeader, RecordListPanel, StatePanel } from "@atlas/ui";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import {
  createOperatorAlertItems,
  createOperatorIncidentItems,
  createOperatorMetricsFacts,
  createOperatorRouteMetricItems,
  loadOperatorObservabilityData
} from "@/lib/server/operator-observability";

export default async function OperatorAlertsPage() {
  const resolution = await resolveWorkspaceActor("OPERATOR");

  if (resolution.status !== "ready") {
    return null;
  }

  try {
    const observability = await loadOperatorObservabilityData(resolution.selection);
    const metrics = observability.metrics;
    const alerts = observability.alerts;
    const incidentReadiness = observability.incidentReadiness;

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
        <section className="grid gap-4 xl:grid-cols-5">
          <MetricCard label="Total requests" value={String(metrics.totalRequests)} detail="Requests observed by the API runtime since the current process started." />
          <MetricCard label="Server errors" value={String(metrics.errorCount)} detail="5xx responses recorded by the API runtime metrics registry." />
          <MetricCard label="In flight" value={String(metrics.inFlightRequests)} detail="Requests still executing when the metrics snapshot was created." />
          <MetricCard label="Active alerts" value={String(alerts.length)} detail="Open or monitoring alerts derived from runtime and operator posture." />
          <MetricCard label="Incident posture" value={incidentReadiness.overallStatus === "ready" ? "Ready" : "Warning"} detail="Current incident-readiness summary for the tracked release stage." />
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
