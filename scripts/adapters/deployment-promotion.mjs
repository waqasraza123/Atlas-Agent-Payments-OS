import { createOperationId, readAtlasOperationPayload, requireText, writeAdapterResult } from "./shared.mjs";

const payload = readAtlasOperationPayload();
const provider = requireText(payload.provider, "provider");
const fromEnv = requireText(payload.fromEnv, "fromEnv");
const toEnv = requireText(payload.toEnv, "toEnv");
const bundlePath = requireText(payload.bundlePath, "bundlePath");
const bundleSha256 = requireText(payload.bundleSha256, "bundleSha256");

if (provider === "github-actions") {
  requireText(process.env.DEPLOYMENT_AUTOMATION_GITHUB_REPOSITORY, "DEPLOYMENT_AUTOMATION_GITHUB_REPOSITORY");
  requireText(process.env.DEPLOYMENT_AUTOMATION_GITHUB_WORKFLOW, "DEPLOYMENT_AUTOMATION_GITHUB_WORKFLOW");
}

if (provider === "argo-rollouts") {
  requireText(process.env.DEPLOYMENT_AUTOMATION_ARGO_SERVER, "DEPLOYMENT_AUTOMATION_ARGO_SERVER");
  requireText(process.env.DEPLOYMENT_AUTOMATION_ARGO_APPLICATION, "DEPLOYMENT_AUTOMATION_ARGO_APPLICATION");
}

const services = Array.isArray(payload.services) ? payload.services.map((entry) => String(entry)) : [];
const operationId = createOperationId(provider, payload);
const targetRef =
  provider === "github-actions"
    ? `${process.env.DEPLOYMENT_AUTOMATION_GITHUB_REPOSITORY}/${process.env.DEPLOYMENT_AUTOMATION_GITHUB_WORKFLOW}`
    : provider === "argo-rollouts"
      ? `${process.env.DEPLOYMENT_AUTOMATION_ARGO_SERVER}/${process.env.DEPLOYMENT_AUTOMATION_ARGO_APPLICATION}`
      : `${fromEnv}->${toEnv}`;

writeAdapterResult({
  version: 1,
  adapter: provider === "github-actions" ? "github-actions-dispatch" : provider === "argo-rollouts" ? "argo-rollouts-sync" : "generic-deployment-runner",
  provider,
  operationId,
  summary: `Promote ${services.join(",")} from ${fromEnv} to ${toEnv}.`,
  targetRef,
  metadata: {
    fromEnv,
    toEnv,
    bundlePath,
    bundleSha256,
    services: services.join(",")
  }
});
