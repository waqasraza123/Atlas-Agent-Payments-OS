import {
  createOperationId,
  readAtlasOperationPayload,
  readTraceContext,
  requireText,
  shouldSimulateExternalExecution,
  withTraceHeaders,
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
const trace = readTraceContext(payload);

if (provider === "generic-webhook") {
  requireText(process.env.OBSERVABILITY_ALERT_DISPATCH_WEBHOOK_URL, "OBSERVABILITY_ALERT_DISPATCH_WEBHOOK_URL");
}

if (provider === "slack-webhook") {
  requireText(process.env.OBSERVABILITY_ALERT_DISPATCH_SLACK_WEBHOOK_URL, "OBSERVABILITY_ALERT_DISPATCH_SLACK_WEBHOOK_URL");
}

if (provider === "pagerduty-events") {
  requireText(
    process.env.OBSERVABILITY_ALERT_DISPATCH_PAGERDUTY_ROUTING_KEY,
    "OBSERVABILITY_ALERT_DISPATCH_PAGERDUTY_ROUTING_KEY"
  );
}

if (provider === "opsgenie-alerts") {
  requireText(process.env.OBSERVABILITY_ALERT_DISPATCH_OPSGENIE_API_KEY, "OBSERVABILITY_ALERT_DISPATCH_OPSGENIE_API_KEY");
  requireText(process.env.OBSERVABILITY_ALERT_DISPATCH_OPSGENIE_TEAM, "OBSERVABILITY_ALERT_DISPATCH_OPSGENIE_TEAM");
}

const simulated = shouldSimulateExternalExecution();
const operationId = createOperationId(provider, payload);

function sanitizeTargetRef(rawUrl) {
  const parsed = new URL(rawUrl);
  return `${parsed.origin}${parsed.pathname}`;
}

function normalizeBaseUrl(value) {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value.replace(/\/+$/, "");
  }

  return `https://${value.replace(/\/+$/, "")}`;
}

function getDeliveryKind(resolvedProvider) {
  return resolvedProvider === "pagerduty-events" || resolvedProvider === "opsgenie-alerts" ? "paging" : "alert-dispatch";
}

function mapPagerDutySeverity() {
  if (alerts.some((alert) => String(alert.severity) === "critical")) {
    return "critical";
  }

  if (alerts.some((alert) => String(alert.severity) === "warning")) {
    return "warning";
  }

  return "info";
}

function mapOpsgeniePriority() {
  if (alerts.some((alert) => String(alert.severity) === "critical")) {
    return "P1";
  }

  if (alerts.some((alert) => String(alert.severity) === "warning")) {
    return "P3";
  }

  return "P5";
}

function readExternalRequestId(headers) {
  return (
    headers.get("x-request-id") ??
    headers.get("request-id") ??
    headers.get("x-trace-id") ??
    headers.get("x-amzn-requestid") ??
    null
  );
}

async function postJson(url, body, headers = {}) {
  const response = await fetch(
    url,
    withTraceHeaders(
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...headers
        },
        body: JSON.stringify(body)
      },
      trace
    )
  );
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Alert dispatch failed with ${response.status}: ${responseText.slice(0, 1200)}`);
  }

  return {
    requestId: readExternalRequestId(response.headers)
  };
}

function createAlertDetails() {
  return alerts.slice(0, 10).map((alert) => ({
    id: String(alert.id),
    title: String(alert.title),
    severity: String(alert.severity),
    source: String(alert.source),
    runbookPath: String(alert.runbookPath)
  }));
}

const summary = `${alerts.length} alerts met the ${minimumSeverity} threshold in ${appEnv}.`;
const pagerDutyEventsUrl = normalizeBaseUrl(
  process.env.OBSERVABILITY_ALERT_DISPATCH_PAGERDUTY_EVENTS_URL ?? "https://events.pagerduty.com/v2/enqueue"
);
const opsgenieApiUrl = normalizeBaseUrl(process.env.OBSERVABILITY_ALERT_DISPATCH_OPSGENIE_API_URL ?? "https://api.opsgenie.com");
const opsgenieTeam = process.env.OBSERVABILITY_ALERT_DISPATCH_OPSGENIE_TEAM?.trim() ?? "";
const deliveryKind = getDeliveryKind(provider);
let externalRequestId = null;
let targetRef =
  provider === "slack-webhook"
    ? sanitizeTargetRef(process.env.OBSERVABILITY_ALERT_DISPATCH_SLACK_WEBHOOK_URL)
    : provider === "generic-webhook"
      ? sanitizeTargetRef(process.env.OBSERVABILITY_ALERT_DISPATCH_WEBHOOK_URL)
      : provider === "pagerduty-events"
        ? sanitizeTargetRef(pagerDutyEventsUrl)
        : provider === "opsgenie-alerts"
          ? `${sanitizeTargetRef(opsgenieApiUrl)}/v2/alerts/${encodeURIComponent(opsgenieTeam)}`
          : appEnv;

if (!simulated && alerts.length > 0) {
  if (provider === "slack-webhook") {
    const result = await postJson(process.env.OBSERVABILITY_ALERT_DISPATCH_SLACK_WEBHOOK_URL, {
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
    externalRequestId = result.requestId;
  } else if (provider === "generic-webhook") {
    const result = await postJson(process.env.OBSERVABILITY_ALERT_DISPATCH_WEBHOOK_URL, {
      version: 1,
      operationId,
      provider,
      summary,
      actorUserEmail,
      reason,
      minimumSeverity,
      appEnv,
      releaseStage,
      trace,
      alerts
    });
    externalRequestId = result.requestId;
  } else if (provider === "pagerduty-events") {
    const result = await postJson(pagerDutyEventsUrl, {
      routing_key: process.env.OBSERVABILITY_ALERT_DISPATCH_PAGERDUTY_ROUTING_KEY,
      event_action: "trigger",
      dedup_key: operationId,
      client: "Atlas Agent Payments OS",
      payload: {
        summary,
        source: `atlas/${appEnv}`,
        severity: mapPagerDutySeverity(),
        custom_details: {
          actorUserEmail,
          reason,
          minimumSeverity,
          releaseStage,
          traceId: trace?.traceId ?? null,
          alerts: createAlertDetails()
        }
      }
    });
    externalRequestId = result.requestId;
  } else if (provider === "opsgenie-alerts") {
    const result = await postJson(
      `${opsgenieApiUrl}/v2/alerts`,
      {
        message: summary.slice(0, 130),
        description: `Atlas paging alert dispatch for ${appEnv}\nRelease stage: ${releaseStage}\nActor: ${actorUserEmail}\nReason: ${reason}`,
        alias: operationId,
        priority: mapOpsgeniePriority(),
        responders: [
          {
            type: "team",
            name: opsgenieTeam
          }
        ],
        details: {
          actorUserEmail,
          reason,
          minimumSeverity,
          releaseStage,
          traceId: trace?.traceId ?? null,
          alerts: createAlertDetails()
        }
      },
      {
        accept: "application/json",
        authorization: `GenieKey ${process.env.OBSERVABILITY_ALERT_DISPATCH_OPSGENIE_API_KEY}`
      }
    );
    externalRequestId = result.requestId;
  }
}

writeAdapterResult({
  version: 1,
  adapter:
    provider === "slack-webhook"
      ? "slack-webhook-dispatch"
      : provider === "pagerduty-events"
        ? "pagerduty-events-dispatch"
        : provider === "opsgenie-alerts"
          ? "opsgenie-alerts-dispatch"
          : "generic-webhook-dispatch",
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
    deliveryKind,
    externalRequestId,
    executionMode: simulated ? "simulated" : "live",
    traceId: trace?.traceId ?? null,
    traceparent: trace?.traceparent ?? null,
    sourceService: trace?.sourceService ?? null,
    opsgenieTeam: provider === "opsgenie-alerts" ? opsgenieTeam : null
  }
});
