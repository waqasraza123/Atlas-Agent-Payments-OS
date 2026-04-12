import { createOperationId, readAtlasOperationPayload, requireText, writeAdapterResult } from "./shared.mjs";

const payload = readAtlasOperationPayload();
const provider = requireText(payload.provider, "provider");
const backupPath = requireText(payload.backupPath, "backupPath");
const targetEnvironment = requireText(payload.targetEnvironment, "targetEnvironment");
const targetLabel = requireText(payload.targetLabel, "targetLabel");

if (provider === "ssh-postgres") {
  requireText(process.env.RESTORE_DRILL_SSH_DESTINATION, "RESTORE_DRILL_SSH_DESTINATION");
}

if (provider === "kubernetes-job") {
  requireText(process.env.RESTORE_DRILL_KUBERNETES_NAMESPACE, "RESTORE_DRILL_KUBERNETES_NAMESPACE");
  requireText(process.env.RESTORE_DRILL_KUBERNETES_JOB_TEMPLATE, "RESTORE_DRILL_KUBERNETES_JOB_TEMPLATE");
}

const operationId = createOperationId(provider, payload);
const targetRef =
  provider === "ssh-postgres"
    ? process.env.RESTORE_DRILL_SSH_DESTINATION
    : provider === "kubernetes-job"
      ? `${process.env.RESTORE_DRILL_KUBERNETES_NAMESPACE}/${process.env.RESTORE_DRILL_KUBERNETES_JOB_TEMPLATE}`
      : payload.targetHost ?? "local-restore-target";

writeAdapterResult({
  version: 1,
  adapter: provider === "kubernetes-job" ? "kubernetes-restore-job" : provider === "ssh-postgres" ? "ssh-postgres-restore" : "local-psql-restore",
  provider,
  operationId,
  summary: `Restore drill for ${targetEnvironment}:${targetLabel} using ${backupPath}.`,
  targetRef,
  metadata: {
    backupPath,
    targetEnvironment,
    targetLabel,
    targetHost: typeof payload.targetHost === "string" ? payload.targetHost : null,
    executeRestore: payload.executeRestore === true
  }
});

