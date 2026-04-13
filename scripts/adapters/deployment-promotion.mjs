import {
  createOperationId,
  readAtlasOperationPayload,
  requireText,
  shouldSimulateExternalExecution,
  writeAdapterResult
} from "./shared.mjs";

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
const simulated = shouldSimulateExternalExecution();
let operationId = createOperationId(provider, payload);
const targetRef =
  provider === "github-actions"
    ? `${process.env.DEPLOYMENT_AUTOMATION_GITHUB_REPOSITORY}/${process.env.DEPLOYMENT_AUTOMATION_GITHUB_WORKFLOW}@${process.env.DEPLOYMENT_AUTOMATION_GITHUB_REF ?? "main"}`
    : provider === "argo-rollouts"
      ? `${process.env.DEPLOYMENT_AUTOMATION_ARGO_SERVER}/${process.env.DEPLOYMENT_AUTOMATION_ARGO_APPLICATION}`
      : `${fromEnv}->${toEnv}`;

if (provider === "github-actions" && !simulated) {
  const apiUrl = (process.env.DEPLOYMENT_AUTOMATION_GITHUB_API_URL ?? "https://api.github.com").replace(/\/+$/, "");
  const token = requireText(
    process.env.DEPLOYMENT_AUTOMATION_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN,
    "DEPLOYMENT_AUTOMATION_GITHUB_TOKEN"
  );
  const workflowRef = process.env.DEPLOYMENT_AUTOMATION_GITHUB_REF ?? "main";
  const response = await fetch(
    `${apiUrl}/repos/${process.env.DEPLOYMENT_AUTOMATION_GITHUB_REPOSITORY}/actions/workflows/${encodeURIComponent(process.env.DEPLOYMENT_AUTOMATION_GITHUB_WORKFLOW)}/dispatches`,
    {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "user-agent": "atlas-rollout-automation"
      },
      body: JSON.stringify({
        ref: workflowRef,
        inputs: {
          from_environment: fromEnv,
          to_environment: toEnv,
          services: services.join(","),
          bundle_path: bundlePath,
          bundle_sha256: bundleSha256
        }
      })
    }
  );

  if (response.status !== 204) {
    const errorText = await response.text();
    throw new Error(`GitHub workflow dispatch failed with ${response.status}: ${errorText}`);
  }

  operationId = response.headers.get("x-github-request-id") ?? operationId;
}

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
    services: services.join(","),
    executionMode: simulated ? "simulated" : "live"
  }
});
