import {
  deploymentAutomationRuntime,
  restoreDrillRuntime,
  secretRotationRuntime,
  upstreamIdentityRuntime
} from "@atlas/config";
import {
  getOperationalExecutionSummary,
  listAtlasPromotionExecutionReports,
  listAtlasRestoreDrillReports,
  listAtlasSecretRotationExecutionReports,
  listAtlasUpstreamIdentityLifecycleReports,
  listOperationalExecutions,
  listOperationalIntegrations
} from "@atlas/database";
import { MetricCard, PageHeader, Panel, RecordListPanel } from "@atlas/ui";
import { WorkflowFeedbackPanel } from "@/components/workflow-feedback-panel";
import { WorkflowFormField } from "@/components/workflow-form-field";
import { WorkflowFormPanel } from "@/components/workflow-form-panel";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { readWorkflowFeedback } from "@/lib/workflow-feedback";
import {
  executePromotionAutomationAction,
  executeRestoreDrillAction,
  executeSecretRotationAction,
  registerOperationalIntegrationAction,
  updateOperationalIntegrationLifecycleAction,
  updateOperationalIntegrationVerificationAction
} from "../actions";

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
  const [integrations, executionSummary, recentExecutions] = await Promise.all([
    listOperationalIntegrations(resolution.actor),
    getOperationalExecutionSummary(resolution.actor),
    listOperationalExecutions(
      resolution.actor,
      {
        limit: 12
      }
    )
  ]);
  const activeVerifiedIntegrations = integrations.filter(
    (integration) => integration.status === "ACTIVE" && integration.verificationStatus === "VERIFIED"
  ).length;

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
      <section className="grid gap-4 xl:grid-cols-4">
        <MetricCard label="Owned targets" value={String(integrations.length)} detail="Persisted rollout integrations" />
        <MetricCard label="Verified targets" value={String(activeVerifiedIntegrations)} detail="Active and execution-ready" />
        <MetricCard
          label="Execution runs"
          value={String(executionSummary.totalCount)}
          detail={executionSummary.latestCompletedAt ? `Latest ${new Date(executionSummary.latestCompletedAt).toLocaleString()}` : "No executions yet"}
        />
        <MetricCard
          label="Failed runs"
          value={String(executionSummary.failedCount)}
          detail={`${executionSummary.commandCount} command · ${executionSummary.dryRunCount} dry run`}
        />
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.1fr_1.9fr]">
        <WorkflowFormPanel
          eyebrow="Execution ownership"
          title="Register rollout integration"
          description="Command-mode automation now requires one active verified owned target for each integration kind and environment."
          action={registerOperationalIntegrationAction}
          submitLabel="Register integration"
        >
          <WorkflowFormField label="Kind" hint="Use one record per execution boundary and environment.">
            <select
              name="kind"
              defaultValue="RESTORE_DRILL"
              className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
            >
              <option value="UPSTREAM_IDENTITY">Upstream identity</option>
              <option value="RESTORE_DRILL">Restore drill</option>
              <option value="SECRET_ROTATION">Secret rotation</option>
              <option value="DEPLOYMENT_AUTOMATION">Deployment automation</option>
            </select>
          </WorkflowFormField>
          <WorkflowFormField label="Target environment" hint="Atlas resolves command-mode ownership against the target environment.">
            <select
              name="targetEnvironment"
              defaultValue="STAGING"
              className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
            >
              <option value="DEVELOPMENT">Development</option>
              <option value="STAGING">Staging</option>
              <option value="PRODUCTION">Production</option>
            </select>
          </WorkflowFormField>
          <WorkflowFormField label="Provider" hint="Match the configured provider for this environment.">
            <input
              type="text"
              name="provider"
              placeholder="github-actions"
              className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
              required
            />
          </WorkflowFormField>
          <WorkflowFormField label="Label" hint="Use a stable human-readable target name.">
            <input
              type="text"
              name="label"
              placeholder="staging primary deployment runner"
              className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
              required
            />
          </WorkflowFormField>
          <WorkflowFormField label="Owner email" hint="This should be the accountable team or operator owner.">
            <input
              type="email"
              name="ownerEmail"
              placeholder="platform-ops@atlas.local"
              className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
              required
            />
          </WorkflowFormField>
          <WorkflowFormField label="Endpoint reference" hint="Optional external endpoint, namespace, or repository target.">
            <input
              type="text"
              name="endpointReference"
              placeholder="argo://atlas-production/api"
              className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
            />
          </WorkflowFormField>
          <WorkflowFormField label="Secret reference" hint="Optional secret-manager path or credential alias.">
            <input
              type="text"
              name="secretReference"
              placeholder="aws-secrets://atlas/production/deployer"
              className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
            />
          </WorkflowFormField>
          <WorkflowFormField label="Config reference" hint="Optional config file, app id, or job template reference.">
            <input
              type="text"
              name="configReference"
              placeholder="workflow:deploy-production"
              className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
            />
          </WorkflowFormField>
        </WorkflowFormPanel>
        <Panel className="space-y-4 p-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--atlas-ink)]">Owned rollout integrations</p>
            <p className="text-sm text-[var(--atlas-muted)]">
              Command-mode restore, rotation, promotion, and upstream identity execution now resolve against this owned integration registry.
            </p>
          </div>
          <div className="space-y-4">
            {integrations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--atlas-line)] bg-[rgba(7,10,18,0.45)] px-4 py-5 text-sm text-[var(--atlas-muted)]">
                No owned rollout integrations are registered yet.
              </div>
            ) : (
              integrations.map((integration) => (
                <div key={integration.id} className="rounded-3xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.5)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-[var(--atlas-ink)]">
                        {integration.label} · {integration.targetEnvironment.toLowerCase()}
                      </p>
                      <p className="text-sm text-[var(--atlas-muted)]">
                        {integration.kind.replaceAll("_", " ").toLowerCase()} · {integration.provider} · owner {integration.ownerEmail}
                      </p>
                      <p className="text-xs text-[var(--atlas-muted)]">
                        Status {integration.status.toLowerCase()} · verification {integration.verificationStatus.toLowerCase()} · last used{" "}
                        {integration.lastUsedAt ? new Date(integration.lastUsedAt).toLocaleString() : "never"}
                      </p>
                      <p className="text-xs text-[var(--atlas-muted)]">
                        Endpoint {integration.endpointReference ?? "none"} · secret {integration.secretReference ?? "none"} · config{" "}
                        {integration.configReference ?? "none"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <form action={updateOperationalIntegrationVerificationAction.bind(null, integration.id)} className="space-y-3 rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.4)] p-3">
                      <input type="hidden" name="integrationId" value={integration.id} />
                      <select
                        name="verificationStatus"
                        defaultValue={integration.verificationStatus}
                        className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
                      >
                        <option value="VERIFIED">Verified</option>
                        <option value="STALE">Stale</option>
                        <option value="FAILED">Failed</option>
                        <option value="PENDING">Pending</option>
                      </select>
                      <textarea
                        name="verificationReason"
                        rows={3}
                        minLength={12}
                        placeholder="Verified against the owned staging runner and secret references."
                        className="w-full rounded-3xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm leading-6 text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
                        required
                      />
                      <button type="submit" className="w-full rounded-2xl bg-[var(--atlas-accent)] px-4 py-3 text-sm font-semibold text-[var(--atlas-ink-inverse)]">
                        Update verification
                      </button>
                    </form>
                    <form action={updateOperationalIntegrationLifecycleAction.bind(null, integration.id)} className="space-y-3 rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.4)] p-3">
                      <input type="hidden" name="integrationId" value={integration.id} />
                      <select
                        name="action"
                        defaultValue={integration.status === "SUSPENDED" ? "REACTIVATE" : integration.status === "REVOKED" ? "REACTIVATE" : "SUSPEND"}
                        className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
                      >
                        <option value="SUSPEND">Suspend</option>
                        <option value="REACTIVATE">Reactivate</option>
                        <option value="REVOKE">Revoke</option>
                      </select>
                      <textarea
                        name="reason"
                        rows={3}
                        minLength={12}
                        placeholder="Suspend this target while credentials are rotated or ownership is reassigned."
                        className="w-full rounded-3xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm leading-6 text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
                        required
                      />
                      <button type="submit" className="w-full rounded-2xl border border-[var(--atlas-line-strong)] px-4 py-3 text-sm font-semibold text-[var(--atlas-ink)]">
                        Update lifecycle
                      </button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>
      <section className="grid gap-6 xl:grid-cols-3">
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
        <WorkflowFormPanel
          eyebrow="Promotion execution"
          title="Run deployment promotion"
          description="Use the latest target-environment restore and rotation proof to create a promotion bundle and dispatch the configured deployment runner."
          action={executePromotionAutomationAction}
          submitLabel="Execute promotion"
        >
          <WorkflowFormField label="From environment" hint="Promotions advance one environment at a time.">
            <select
              name="fromEnv"
              defaultValue="development"
              className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
            >
              <option value="development">Development</option>
              <option value="staging">Staging</option>
            </select>
          </WorkflowFormField>
          <WorkflowFormField label="To environment" hint="Atlas validates proof freshness against the promotion target.">
            <select
              name="toEnv"
              defaultValue="staging"
              className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
            >
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </WorkflowFormField>
          <WorkflowFormField label="Service set" hint="Use all for full environment promotion or a subset for staged rollout.">
            <input
              type="text"
              name="services"
              defaultValue="all"
              className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
              required
            />
          </WorkflowFormField>
          <WorkflowFormField label="Environment file" hint="This file provides the target-environment config snapshot used to build the promotion bundle.">
            <input
              type="text"
              name="envFile"
              defaultValue=".env.staging.example"
              className="w-full rounded-2xl border border-[var(--atlas-line)] bg-[rgba(7,10,18,0.72)] px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition focus:border-[var(--atlas-accent)]"
              required
            />
          </WorkflowFormField>
        </WorkflowFormPanel>
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <RecordListPanel
          eyebrow="Execution ledger"
          title="Recent rollout executions"
          description="Atlas now persists rollout execution records and proof artifacts in the database instead of relying only on filesystem reports."
          items={recentExecutions.map((execution) => ({
            id: execution.id,
            title: `${execution.kind.replaceAll("_", " ").toLowerCase()} · ${execution.provider}`,
            description: execution.summary,
            detail: `${execution.mode} · ${execution.status} · ${execution.proofArtifacts.length} proof artifacts · ${new Date(execution.completedAt).toLocaleString()}`,
            statusLabel: execution.status,
            statusTone: execution.status === "SUCCEEDED" ? "success" : "critical"
          }))}
          emptyTitle="No rollout executions"
          emptyDescription="Execution records will appear here after the first restore, rotation, promotion, or upstream lifecycle run."
        />
        <RecordListPanel
          eyebrow="Proof registry"
          title="Latest stored proof artifacts"
          description="Every persisted rollout execution now carries integrity-tracked proof artifacts."
          items={recentExecutions.flatMap((execution) =>
            execution.proofArtifacts.slice(0, 1).map((artifact) => ({
              id: artifact.id,
              title: `${artifact.kind.toLowerCase()} · ${execution.kind.replaceAll("_", " ").toLowerCase()}`,
              description: artifact.label,
              detail: `${artifact.sizeBytes} bytes · ${artifact.sha256.slice(0, 12)}… · ${new Date(artifact.createdAt).toLocaleString()}`,
              statusLabel: execution.targetEnvironment ?? "GLOBAL",
              statusTone: execution.status === "SUCCEEDED" ? "default" : "warning"
            }))
          )}
          emptyTitle="No proof artifacts"
          emptyDescription="Proof artifacts will appear once execution records are stored."
        />
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
            detail: `${report.mode.toUpperCase()} · ${report.adapterResult?.operationId ?? "no operation id"} · ${new Date(report.generatedAt).toLocaleString()}`,
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
            detail: `${report.provider} · ${report.adapterResult?.operationId ?? "no operation id"} · ${new Date(report.generatedAt).toLocaleString()}`,
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
            detail: `${report.mode.toUpperCase()} · ${report.adapterResult?.operationId ?? "no operation id"} · ${new Date(report.generatedAt).toLocaleString()}`,
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
