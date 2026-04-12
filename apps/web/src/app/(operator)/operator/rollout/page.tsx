import {
  deploymentAutomationRuntime,
  restoreDrillRuntime,
  secretRotationRuntime,
  upstreamIdentityRuntime
} from "@atlas/config";
import {
  listAtlasPromotionExecutionReports,
  listAtlasRestoreDrillReports,
  listAtlasSecretRotationExecutionReports,
  listAtlasUpstreamIdentityLifecycleReports
} from "@atlas/database";
import { MetricCard, PageHeader, Panel, RecordListPanel } from "@atlas/ui";
import { WorkflowFeedbackPanel } from "@/components/workflow-feedback-panel";
import { WorkflowFormField } from "@/components/workflow-form-field";
import { WorkflowFormPanel } from "@/components/workflow-form-panel";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { readWorkflowFeedback } from "@/lib/workflow-feedback";
import { executeRestoreDrillAction, executeSecretRotationAction } from "../actions";

type OperatorRolloutPageProps = Readonly<{
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function OperatorRolloutPage({ searchParams }: OperatorRolloutPageProps) {
  const resolution = await resolveWorkspaceActor("OPERATOR");

  if (resolution.status !== "ready") {
    return null;
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const feedback = readWorkflowFeedback(resolvedSearchParams);
  const restoreReports = listAtlasRestoreDrillReports(6);
  const secretRotationReports = listAtlasSecretRotationExecutionReports(6);
  const promotionReports = listAtlasPromotionExecutionReports(6);
  const upstreamReports = listAtlasUpstreamIdentityLifecycleReports(6);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operator rollout"
        title="Execute and inspect rollout readiness proof"
        description="Atlas now treats restore drills, secret rotation, deployment promotion, and upstream identity lifecycle execution as first-class operational evidence."
      />
      {feedback ? (
        <WorkflowFeedbackPanel title={feedback.title} description={feedback.description} tone={feedback.tone} />
      ) : null}
      <section className="grid gap-4 xl:grid-cols-4">
        <MetricCard label="Restore mode" value={restoreDrillRuntime.mode.toUpperCase()} detail={restoreDrillRuntime.reportDirectory} />
        <MetricCard
          label="Rotation mode"
          value={secretRotationRuntime.mode.toUpperCase()}
          detail={`${secretRotationRuntime.provider} · ${secretRotationRuntime.reportDirectory}`}
        />
        <MetricCard
          label="Promotion mode"
          value={deploymentAutomationRuntime.mode.toUpperCase()}
          detail={deploymentAutomationRuntime.reportDirectory}
        />
        <MetricCard
          label="Identity mode"
          value={upstreamIdentityRuntime.mode.toUpperCase()}
          detail={`${upstreamIdentityRuntime.provider} · ${upstreamIdentityRuntime.reportDirectory}`}
        />
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <WorkflowFormPanel
          eyebrow="Restore proof"
          title="Run restore drill"
          description="Generate a fresh restore-drill report and, when configured, execute against a non-local target through the command adapter."
          action={executeRestoreDrillAction}
          submitLabel="Store restore proof"
        >
          <WorkflowFormField label="Target environment" hint="Promotion requires restore proof for the target environment.">
            <select
              name="targetEnvironment"
              defaultValue="staging"
              className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
            >
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </WorkflowFormField>
          <WorkflowFormField label="Target label" hint="Use a stable restore slot or environment label.">
            <input
              type="text"
              name="targetLabel"
              defaultValue="staging-restore-slot"
              className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
              required
            />
          </WorkflowFormField>
          <WorkflowFormField label="Target host" hint="Optional host label for remote restore targets.">
            <input
              type="text"
              name="targetHost"
              placeholder="postgres.staging.internal"
              className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
            />
          </WorkflowFormField>
          <WorkflowFormField label="Backup path" hint="Defaults to the repo-owned restore fixture when left unchanged.">
            <input
              type="text"
              name="backupPath"
              defaultValue="scripts/fixtures/restore-drill.sql"
              className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
              required
            />
          </WorkflowFormField>
          <label className="flex items-center gap-3 rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.52)] px-4 py-3 text-sm text-[var(--atlas-muted)]">
            <input type="checkbox" name="executeRestore" defaultChecked className="size-4 accent-[var(--atlas-accent)]" />
            Execute the restore instead of producing only dry-run proof.
          </label>
        </WorkflowFormPanel>
        <WorkflowFormPanel
          eyebrow="Secret rotation"
          title="Run secret rotation execution"
          description="Generate and store rotation proof through the configured secret-manager adapter."
          action={executeSecretRotationAction}
          submitLabel="Store rotation proof"
        >
          <WorkflowFormField label="Environment" hint="Rotation proof is validated against the promotion target environment.">
            <select
              name="environment"
              defaultValue="staging"
              className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
            >
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </WorkflowFormField>
          <WorkflowFormField label="Reason" hint="Use a durable operational reason that can survive later access review.">
            <textarea
              name="reason"
              rows={4}
              minLength={12}
              className="w-full rounded-3xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm leading-6 text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
              placeholder="Rotate staging secrets before promoting the current release artifact."
              required
            />
          </WorkflowFormField>
          <WorkflowFormField label="Secret keys" hint="Comma-separated keys that must be rotated and proven for promotion.">
            <input
              type="text"
              name="secretKeys"
              defaultValue="AUTH_SESSION_SIGNING_SECRET, AUTH_IDENTITY_BRIDGE_SECRET, DATABASE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, MINIO_SECRET_KEY"
              className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
              required
            />
          </WorkflowFormField>
        </WorkflowFormPanel>
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <RecordListPanel
          eyebrow="Restore drills"
          title="Latest restore proof"
          description="Promotion now depends on fresh executed restore proof instead of only dry-run validation."
          items={restoreReports.map((report) => ({
            id: `${report.targetEnvironment}-${report.completedAt}`,
            title: `${report.targetEnvironment} · ${report.targetLabel}`,
            description: `${report.executor} · ${report.executionMode.toUpperCase()}`,
            detail: `${report.executedRestore ? "Executed restore" : "Dry run"} · ${new Date(report.completedAt).toLocaleString()}`,
            statusLabel: report.executedRestore ? "EXECUTED" : "DRY_RUN",
            statusTone: report.executedRestore ? "success" : "warning"
          }))}
          emptyTitle="No restore proof"
          emptyDescription="Restore drill reports will appear here after the first execution."
        />
        <RecordListPanel
          eyebrow="Secret rotation"
          title="Latest rotation proof"
          description="Atlas now stores execution-aware secret rotation proof, not only manifest files."
          items={secretRotationReports.map((report) => ({
            id: `${report.environment}-${report.generatedAt}`,
            title: `${report.environment} · ${report.provider}`,
            description: report.manifest.secrets.map((secret) => secret.key).join(", "),
            detail: `${report.mode.toUpperCase()} · ${new Date(report.generatedAt).toLocaleString()}`,
            statusLabel: report.mode === "command" ? "EXECUTED" : "DRY_RUN",
            statusTone: report.mode === "command" ? "success" : "default"
          }))}
          emptyTitle="No rotation proof"
          emptyDescription="Secret rotation execution reports will appear here after the first run."
        />
        <RecordListPanel
          eyebrow="Promotion automation"
          title="Latest promotion executions"
          description="Promotion bundles now carry execution reports once the deployment automation adapter runs."
          items={promotionReports.map((report) => ({
            id: `${report.toEnv}-${report.generatedAt}`,
            title: `${report.fromEnv} -> ${report.toEnv}`,
            description: report.services.join(", "),
            detail: `${report.mode.toUpperCase()} · ${new Date(report.generatedAt).toLocaleString()}`,
            statusLabel: report.mode === "command" ? "EXECUTED" : "DRY_RUN",
            statusTone: report.mode === "command" ? "success" : "default"
          }))}
          emptyTitle="No promotion executions"
          emptyDescription="Promotion execution reports appear after running the promotion automation step."
        />
        <RecordListPanel
          eyebrow="Upstream identity"
          title="Latest upstream lifecycle executions"
          description="Identity assignment changes can now synchronize directly to the configured upstream provider."
          items={upstreamReports.map((report) => ({
            id: `${report.assignmentId}-${report.generatedAt}`,
            title: `${report.action} ${report.externalEmail}`,
            description: `${report.provider} · ${report.organizationSlug}`,
            detail: `${report.mode.toUpperCase()} · ${new Date(report.generatedAt).toLocaleString()}`,
            statusLabel: report.mode === "command" ? "EXECUTED" : "DRY_RUN",
            statusTone: report.mode === "command" ? "success" : "default"
          }))}
          emptyTitle="No upstream identity executions"
          emptyDescription="Upstream identity lifecycle reports will appear here after the first synchronized identity action."
        />
      </div>
      <Panel className="space-y-2 p-5">
        <p className="text-sm font-semibold text-[var(--atlas-ink)]">Current promotion posture</p>
        <p className="text-sm text-[var(--atlas-muted)]">
          Restore drill automation is {restoreDrillRuntime.mode}, secret rotation automation is {secretRotationRuntime.mode},
          deployment automation is {deploymentAutomationRuntime.mode}, and upstream identity automation is {upstreamIdentityRuntime.mode}.
        </p>
      </Panel>
    </div>
  );
}
