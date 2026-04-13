import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AtlasActorContext } from "@atlas/auth";
import type { AtlasApiRuntimeTelemetryRecord, AtlasIncidentReadinessRecord, AtlasObservabilityAlertRecord } from "@atlas/domain";
import { afterEach, describe, expect, it, vi } from "vitest";

function createActor(): AtlasActorContext {
  return {
    user: {
      id: "user-operator",
      email: "operator-admin@atlas.local",
      name: "Operator Admin"
    },
    organization: {
      id: "org-operator",
      slug: "atlas-demo-operator",
      name: "Atlas Demo Operator",
      kind: "OPERATOR"
    },
    membership: {
      id: "membership-operator",
      role: "ADMIN"
    },
    workspace: "OPERATOR",
    agentId: null,
    source: "identity-provider",
    providerMode: "external-oidc",
    sessionId: "session-1"
  };
}

function createMetrics(): AtlasApiRuntimeTelemetryRecord {
  return {
    service: "api",
    startedAt: "2026-04-13T00:00:00.000Z",
    uptimeSeconds: 300,
    totalRequests: 42,
    successCount: 38,
    errorCount: 4,
    averageDurationMs: 24,
    maxDurationMs: 120,
    inFlightRequests: 1,
    lastReadinessStatus: "ready",
    lastReadinessAt: "2026-04-13T00:05:00.000Z",
    routeMetrics: [],
    configurationStatus: "valid",
    verificationCommand: "pnpm verify:release",
    revision: "rev-123",
    deploymentSlot: "blue",
    recordedAt: "2026-04-13T00:05:00.000Z"
  };
}

function createAlerts(): AtlasObservabilityAlertRecord[] {
  return [
    {
      id: "api-error-rate-elevated",
      title: "API error rate is elevated",
      description: "Observed error rate is 10% across 40 requests.",
      severity: "warning",
      source: "runtime",
      metricLabel: "Error rate",
      status: "monitoring",
      runbookPath: "docs/runbooks/production-operations-baseline.md",
      updatedAt: "2026-04-13T00:10:00.000Z"
    },
    {
      id: "operator-critical-cases",
      title: "Critical operator cases are open",
      description: "1 critical case currently requires immediate investigation.",
      severity: "critical",
      source: "operator",
      metricLabel: "Critical cases",
      status: "open",
      runbookPath: "docs/runbooks/incident-response-baseline.md",
      updatedAt: "2026-04-13T00:10:00.000Z"
    }
  ];
}

function createIncidentReadiness(): AtlasIncidentReadinessRecord {
  return {
    overallStatus: "warning",
    releaseStage: "private-beta",
    items: [
      {
        key: "active-alert-load",
        label: "Active alert load",
        status: "warning",
        detail: "2 active alerts currently need monitoring or intervention.",
        runbookPath: "docs/runbooks/incident-response-baseline.md"
      }
    ]
  };
}

function adapterScriptPath(fileName: string) {
  return fileURLToPath(new URL(`../../../scripts/adapters/${fileName}`, import.meta.url));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("observability operations", () => {
  it("persists and lists retained observability snapshots", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "atlas-observability-snapshots-"));
    vi.stubEnv("OBSERVABILITY_SNAPSHOT_DIR", sandbox);

    const client = {
      observabilitySnapshot: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: "snapshot-1",
          ...data,
          storageUrl: null,
          createdAt: new Date("2026-04-13T00:10:00.000Z")
        })),
        findMany: vi.fn(async () => [
          {
            id: "snapshot-1",
            appEnv: "local",
            releaseStage: "functional-alpha",
            actorUserEmail: "operator-admin@atlas.local",
            configurationStatus: "valid",
            readinessStatus: "ready",
            totalRequests: 42,
            errorCount: 4,
            activeAlertCount: 2,
            criticalAlertCount: 1,
            reportPath: join(sandbox, "local", "snapshot.json"),
            storageUrl: null,
            expiresAt: new Date("2026-05-13T00:10:00.000Z"),
            createdAt: new Date("2026-04-13T00:10:00.000Z")
          }
        ])
      }
    } as const;

    const { listObservabilitySnapshots, persistObservabilitySnapshot } = await import("./observability-operations");

    const snapshot = await persistObservabilitySnapshot(
      {
        actor: createActor(),
        metrics: createMetrics(),
        alerts: createAlerts(),
        incidentReadiness: createIncidentReadiness(),
        reason: "Capture retained telemetry after reviewing the current alert posture."
      },
      client as never
    );

    expect(snapshot.activeAlertCount).toBe(2);

    const listed = await listObservabilitySnapshots(createActor(), { limit: 5 }, client as never);
    expect(listed[0]).toMatchObject({
      id: "snapshot-1",
      activeAlertCount: 2,
      criticalAlertCount: 1
    });
  });

  it("dispatches current alerts through the configured adapter and stores a durable record", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "atlas-observability-dispatch-"));
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("OBSERVABILITY_ALERT_DISPATCH_MODE", "command");
    vi.stubEnv("OBSERVABILITY_ALERT_DISPATCH_PROVIDER", "generic-webhook");
    vi.stubEnv("OBSERVABILITY_ALERT_DISPATCH_COMMAND", `${process.execPath} ${adapterScriptPath("alert-dispatch.mjs")}`);
    vi.stubEnv("OBSERVABILITY_ALERT_DISPATCH_REPORT_DIR", sandbox);
    vi.stubEnv("OBSERVABILITY_ALERT_DISPATCH_WEBHOOK_URL", "https://alerts.atlas.local/webhook");
    vi.stubEnv("ATLAS_SIMULATE_EXTERNAL_EXECUTION", "true");

    const client = {
      observabilityAlertDispatch: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: "dispatch-1",
          ...data,
          createdAt: new Date("2026-04-13T00:15:00.000Z")
        })),
        findMany: vi.fn(async () => [
          {
            id: "dispatch-1",
            provider: "generic-webhook",
            mode: "COMMAND",
            status: "SUCCEEDED",
            minimumSeverity: "warning",
            actorUserEmail: "operator-admin@atlas.local",
            summary: "2 alerts met the warning threshold for staging.",
            targetReference: "https://alerts.atlas.local/webhook",
            reportPath: join(sandbox, "dispatch.json"),
            dispatchedAlertCount: 2,
            criticalAlertCount: 1,
            warningAlertCount: 1,
            infoAlertCount: 0,
            completedAt: new Date("2026-04-13T00:15:00.000Z"),
            createdAt: new Date("2026-04-13T00:15:00.000Z"),
            operationalIntegrationId: "integration-1"
          }
        ])
      },
      operationalIntegration: {
        findMany: vi.fn(async () => [
          {
            id: "integration-1",
            kind: "ALERT_DISPATCH",
            targetEnvironment: "STAGING",
            provider: "generic-webhook",
            label: "staging webhook dispatch",
            ownerEmail: "platform-ops@atlas.local",
            endpointReference: "https://alerts.atlas.local/webhook",
            secretReference: "aws-secrets://atlas/staging/alerts",
            configReference: null,
            status: "ACTIVE",
            verificationStatus: "VERIFIED",
            verificationReason: null,
            statusReason: null,
            metadata: null,
            lastVerifiedAt: new Date("2026-04-13T00:10:00.000Z"),
            lastUsedAt: null,
            createdAt: new Date("2026-04-13T00:10:00.000Z"),
            updatedAt: new Date("2026-04-13T00:10:00.000Z"),
            createdByUser: {
              email: "platform-ops@atlas.local"
            },
            updatedByUser: null
          }
        ]),
        update: vi.fn(async () => undefined)
      }
    } as const;

    const { dispatchObservabilityAlerts, listObservabilityAlertDispatches } = await import("./observability-operations");

    const dispatch = await dispatchObservabilityAlerts(
      {
        actor: createActor(),
        minimumSeverity: "warning",
        reason: "Dispatch externally while staging alert posture is being investigated.",
        alerts: createAlerts(),
        metrics: createMetrics(),
        incidentReadiness: createIncidentReadiness()
      },
      client as never
    );

    expect(dispatch.dispatchedAlertCount).toBe(2);
    expect(client.operationalIntegration.update).toHaveBeenCalled();

    const listed = await listObservabilityAlertDispatches(createActor(), { limit: 5 }, client as never);
    expect(listed[0]).toMatchObject({
      id: "dispatch-1",
      provider: "generic-webhook",
      minimumSeverity: "warning"
    });
  });
});
