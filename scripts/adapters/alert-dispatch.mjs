import {
  createOperationId,
  readAtlasOperationPayload,
  requireText,
  shouldSimulateExternalExecution,
  writeAdapterResult
} from "./shared.mjs";

const payload = readAtlasOperationPayload();
const provider = requireText(payload.provider, "provider");
const actorUserEmail = requireText(payload.actorUserEmail, "actorUserEmail");
const reason = requireText(payload.reason, "reason");
const minimumSeverity = requireText(payload.minimumSeverity, "minimumSeverity");
const appEnv = requireText(payload.appEnv, "appEnv");
const releaseStage = requireText(payload.releaseStage, "releaseStage");
const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];

if (provider === "generic-webhook") {
  requireText(process.env.OBSERVABILITY_ALERT_DISPATCH_WEBHOOK_URL, "OBSERVABILITY_ALERT_DISPATCH_WEBHOOK_URL");
}

if (provider === "slack-webhook") {
  requireText(process.env.OBSERVABILITY_ALERT_DISPATCH_SLACK_WEBHOOK_URL, "OBSERVABILITY_ALERT_DISPATCH_SLACK_WEBHOOK_URL");
}

const simulated = shouldSimulateExternalExecution();
const operationId = createOperationId(provider, payload);

function sanitizeTargetRef(rawUrl) {
  const parsed = new URL(rawUrl);
  return `${parsed.origin}${parsed.pathname}`;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Alert dispatch failed with ${response.status}: ${(await response.text()).slice(0, 1200)}`);
  }
}

const summary = `${alerts.length} alerts met the ${minimumSeverity} threshold in ${appEnv}.`;
let targetRef =
  provider === "slack-webhook"
    ? sanitizeTargetRef(process.env.OBSERVABILITY_ALERT_DISPATCH_SLACK_WEBHOOK_URL)
    : provider === "generic-webhook"
      ? sanitizeTargetRef(process.env.OBSERVABILITY_ALERT_DISPATCH_WEBHOOK_URL)
      : appEnv;

if (!simulated && alerts.length > 0) {
  if (provider === "slack-webhook") {
    await postJson(process.env.OBSERVABILITY_ALERT_DISPATCH_SLACK_WEBHOOK_URL, {
      text: `Atlas alert dispatch for ${appEnv}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `Atlas alerts · ${appEnv}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Threshold*: ${minimumSeverity}\n*Release stage*: ${releaseStage}\n*Actor*: ${actorUserEmail}\n*Reason*: ${reason}`
          }
        },
        ...alerts.slice(0, 10).map((alert) => ({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${String(alert.severity).toUpperCase()}* · ${String(alert.title)}\n${String(alert.description)}\nRunbook: ${String(alert.runbookPath)}`
          }
        }))
      ]
    });
  } else if (provider === "generic-webhook") {
    await postJson(process.env.OBSERVABILITY_ALERT_DISPATCH_WEBHOOK_URL, {
      version: 1,
      operationId,
      provider,
      summary,
      actorUserEmail,
      reason,
      minimumSeverity,
      appEnv,
      releaseStage,
      alerts
    });
  }
}

writeAdapterResult({
  version: 1,
  adapter: provider === "slack-webhook" ? "slack-webhook-dispatch" : "generic-webhook-dispatch",
  provider,
  operationId,
  summary,
  targetRef,
  metadata: {
    actorUserEmail,
    reason,
    minimumSeverity,
    appEnv,
    releaseStage,
    alertCount: alerts.length,
    executionMode: simulated ? "simulated" : "live"
  }
});
