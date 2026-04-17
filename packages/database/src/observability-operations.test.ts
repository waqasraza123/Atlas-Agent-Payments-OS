import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
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
    tracedRequestCount: 42,
    traceCoverageRate: 1,
    averageDurationMs: 24,
    maxDurationMs: 120,
    inFlightRequests: 1,
    lastReadinessStatus: "ready",
    lastReadinessAt: "2026-04-13T00:05:00.000Z",
    routeMetrics: [],
    recentTraces: [],
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
  vi.useRealTimers();
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
      },
      observabilityIncidentTrigger: {
        findMany: vi.fn(async () => []),
        create: vi.fn(),
        update: vi.fn()
      },
      notification: {
        upsert: vi.fn()
      },
      auditEvent: {
        create: vi.fn()
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
            payload: {
              trace: {
                traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
              }
            },
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
      observabilityIncidentTrigger: {
        findMany: vi.fn(async () => []),
        create: vi.fn(),
        update: vi.fn()
      },
      notification: {
        upsert: vi.fn()
      },
      auditEvent: {
        create: vi.fn()
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
    expect(dispatch.deliveryKind).toBe("alert-dispatch");
    expect(dispatch.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(client.operationalIntegration.update).toHaveBeenCalled();

    const listed = await listObservabilityAlertDispatches(createActor(), { limit: 5 }, client as never);
    expect(listed[0]).toMatchObject({
      id: "dispatch-1",
      provider: "generic-webhook",
      deliveryKind: "alert-dispatch",
      minimumSeverity: "warning",
      traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    });
  });

  it("maps paging providers into delivery-kind dispatch records", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "atlas-observability-paging-"));
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("OBSERVABILITY_ALERT_DISPATCH_MODE", "command");
    vi.stubEnv("OBSERVABILITY_ALERT_DISPATCH_PROVIDER", "pagerduty-events");
    vi.stubEnv("OBSERVABILITY_ALERT_DISPATCH_COMMAND", `${process.execPath} ${adapterScriptPath("alert-dispatch.mjs")}`);
    vi.stubEnv("OBSERVABILITY_ALERT_DISPATCH_REPORT_DIR", sandbox);
    vi.stubEnv("OBSERVABILITY_ALERT_DISPATCH_PAGERDUTY_ROUTING_KEY", "routing-key-production");
    vi.stubEnv("ATLAS_SIMULATE_EXTERNAL_EXECUTION", "true");

    const client = {
      observabilityAlertDispatch: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: "dispatch-paging-1",
          ...data,
          createdAt: new Date("2026-04-13T00:20:00.000Z")
        }))
      },
      observabilityIncidentTrigger: {
        findMany: vi.fn(async () => []),
        create: vi.fn(),
        update: vi.fn()
      },
      notification: {
        upsert: vi.fn()
      },
      auditEvent: {
        create: vi.fn()
      },
      operationalIntegration: {
        findMany: vi.fn(async () => [
          {
            id: "integration-paging-1",
            kind: "ALERT_DISPATCH",
            targetEnvironment: "PRODUCTION",
            provider: "pagerduty-events",
            label: "production pagerduty paging",
            ownerEmail: "platform-ops@atlas.local",
            endpointReference: "https://events.pagerduty.com/v2/enqueue",
            secretReference: "aws-secrets://atlas/production/pagerduty",
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

    const { dispatchObservabilityAlerts } = await import("./observability-operations");

    const dispatch = await dispatchObservabilityAlerts(
      {
        actor: createActor(),
        minimumSeverity: "critical",
        reason: "Escalate the critical alert set through the owned paging target.",
        alerts: createAlerts(),
        metrics: createMetrics(),
        incidentReadiness: createIncidentReadiness()
      },
      client as never
    );

    expect(dispatch.deliveryKind).toBe("paging");
    expect(dispatch.provider).toBe("pagerduty-events");
    expect(dispatch.targetReference).toBe("https://events.pagerduty.com/v2/enqueue");
    expect(dispatch.traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it("syncs durable observability incident triggers from active alerts", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "atlas-observability-incidents-"));
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("OBSERVABILITY_INCIDENT_REPORT_DIR", sandbox);

    const client = {
      observabilityIncidentTrigger: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: "incident-old",
              dedupeKey: "staging:worker-queue-failures",
              appEnv: "staging",
              releaseStage: "private-beta",
              source: "runtime",
              severity: "critical",
              status: "ACTIVE",
              title: "Worker queue failures require review",
              summary: "6 worker failures were recorded.",
              alertIds: ["worker-queue-failures"],
              traceIds: [],
              actorUserEmail: "operator-admin@atlas.local",
              reportPath: join(sandbox, "incident-old.json"),
              payload: null,
              resolvedAt: null,
              createdAt: new Date("2026-04-13T00:00:00.000Z"),
              updatedAt: new Date("2026-04-13T00:00:00.000Z")
            }
          ])
          .mockResolvedValueOnce([
            {
              id: "incident-new",
              dedupeKey: "staging:operator-critical-cases",
              appEnv: "staging",
              releaseStage: "private-beta",
              source: "operator",
              severity: "critical",
              status: "ACTIVE",
              title: "Critical operator cases are open",
              summary: "1 critical case currently requires immediate investigation.",
              alertIds: ["operator-critical-cases"],
              traceIds: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
              actorUserEmail: "operator-admin@atlas.local",
              reportPath: join(sandbox, "incident-new.json"),
              payload: null,
              resolvedAt: null,
              createdAt: new Date("2026-04-13T00:15:00.000Z"),
              updatedAt: new Date("2026-04-13T00:15:00.000Z")
            }
          ]),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: "incident-new",
          ...data,
          resolvedAt: null,
          createdAt: new Date("2026-04-13T00:15:00.000Z"),
          updatedAt: new Date("2026-04-13T00:15:00.000Z")
        })),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
          id: where.id,
          dedupeKey: where.id === "incident-old" ? "staging:worker-queue-failures" : "staging:operator-critical-cases",
          appEnv: "staging",
          releaseStage: "private-beta",
          source: "runtime",
          severity: "critical",
          status: data.status ?? "ACTIVE",
          title: "Worker queue failures require review",
          summary: "6 worker failures were recorded.",
          alertIds: ["worker-queue-failures"],
          traceIds: [],
          actorUserEmail: "operator-admin@atlas.local",
          reportPath: join(sandbox, "incident-old.json"),
          payload: null,
          resolvedAt: data.resolvedAt ?? null,
          createdAt: new Date("2026-04-13T00:00:00.000Z"),
          updatedAt: new Date("2026-04-13T00:20:00.000Z")
        }))
      },
      notification: {
        upsert: vi.fn(async () => undefined)
      },
      auditEvent: {
        create: vi.fn(async () => undefined)
      }
    } as const;

    const { syncObservabilityIncidentTriggers } = await import("./observability-operations");
    const result = await syncObservabilityIncidentTriggers(
      {
        actor: createActor(),
        minimumSeverity: "critical",
        reason: "Sync active incidents after reviewing the current runtime posture.",
        alerts: [createAlerts()[1]],
        metrics: {
          ...createMetrics(),
          recentTraces: [
            {
              traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              spanId: "bbbbbbbbbbbbbbbb",
              parentSpanId: null,
              sourceService: "api",
              origin: "http",
              name: "GET /health",
              status: "ok",
              requestId: "request-1",
              method: "GET",
              path: "/health",
              queueKey: null,
              queueName: null,
              jobId: null,
              attempt: null,
              startedAt: "2026-04-13T00:00:00.000Z",
              endedAt: "2026-04-13T00:00:00.050Z",
              durationMs: 50
            }
          ]
        },
        incidentReadiness: createIncidentReadiness(),
        workerTelemetry: {
          status: "healthy",
          summary: "Shared worker telemetry is current and all queues have reported readiness.",
          snapshotPath: null,
          recordedAt: null,
          staleAfterMinutes: 10,
          snapshot: null
        }
      },
      client as never
    );

    expect(result.activeCount).toBe(1);
    expect(result.createdCount).toBe(1);
    expect(result.resolvedCount).toBe(1);
    expect(client.notification.upsert).toHaveBeenCalledTimes(2);
    expect(client.auditEvent.create).toHaveBeenCalledTimes(2);
  });

  it("prunes expired observability records and artifacts across retention classes", async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "atlas-observability-retention-"));
    const snapshotDir = join(sandbox, "snapshots");
    const dispatchDir = join(sandbox, "dispatches");
    const incidentDir = join(sandbox, "incidents");
    const remediationDir = join(sandbox, "remediation");
    const automationDir = join(sandbox, "automation");
    const ownershipDir = join(sandbox, "ownership");
    vi.stubEnv("OBSERVABILITY_SNAPSHOT_DIR", snapshotDir);
    vi.stubEnv("OBSERVABILITY_ALERT_DISPATCH_REPORT_DIR", dispatchDir);
    vi.stubEnv("OBSERVABILITY_INCIDENT_REPORT_DIR", incidentDir);
    vi.stubEnv("OBSERVABILITY_REMEDIATION_REPORT_DIR", remediationDir);
    vi.stubEnv("OBSERVABILITY_AUTOMATION_REPORT_DIR", automationDir);
    vi.stubEnv("OBSERVABILITY_OWNERSHIP_HISTORY_DIR", ownershipDir);
    vi.stubEnv("OBSERVABILITY_SNAPSHOT_RETENTION_DAYS", "1");
    vi.stubEnv("OBSERVABILITY_DISPATCH_RETENTION_DAYS", "2");
    vi.stubEnv("OBSERVABILITY_INCIDENT_RETENTION_DAYS", "3");
    vi.stubEnv("OBSERVABILITY_REMEDIATION_RETENTION_DAYS", "4");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_RETENTION_DAYS", "4");
    vi.stubEnv("OBSERVABILITY_OWNERSHIP_HISTORY_RETENTION_DAYS", "4");

    for (const directory of [snapshotDir, dispatchDir, incidentDir, remediationDir, automationDir, ownershipDir]) {
      mkdirSync(directory, {
        recursive: true
      });
    }

    const oldSnapshot = join(snapshotDir, "old.json");
    const oldDispatch = join(dispatchDir, "old.json");
    const oldIncident = join(incidentDir, "old.json");
    const oldRemediation = join(remediationDir, "old.json");
    const oldAutomation = join(automationDir, "old.json");
    const oldOwnership = join(ownershipDir, "old.json");
    for (const filePath of [oldSnapshot, oldDispatch, oldIncident, oldRemediation, oldAutomation, oldOwnership]) {
      writeFileSync(filePath, "{}\n", "utf8");
      utimesSync(filePath, new Date("2026-04-01T00:00:00.000Z"), new Date("2026-04-01T00:00:00.000Z"));
    }

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-13T00:00:00.000Z"));

    const client = {
      observabilitySnapshot: {
        deleteMany: vi.fn(async () => ({ count: 2 }))
      },
      observabilityAlertDispatch: {
        deleteMany: vi.fn(async () => ({ count: 3 }))
      },
      observabilityIncidentTrigger: {
        deleteMany: vi.fn(async () => ({ count: 1 }))
      }
    } as const;
    const { applyObservabilityRetentionPolicy } = await import("./observability-operations");
    const result = await applyObservabilityRetentionPolicy(client as never);

    expect(result).toEqual({
      deletedSnapshotRecords: 2,
      deletedDispatchRecords: 3,
      deletedResolvedIncidentTriggerRecords: 1,
      deletedSnapshotArtifacts: 1,
      deletedDispatchArtifacts: 1,
      deletedIncidentArtifacts: 1,
      deletedRemediationArtifacts: 1,
      deletedAutomationArtifacts: 1,
      deletedOwnershipHistoryArtifacts: 1
    });
    expect(client.observabilitySnapshot.deleteMany).toHaveBeenCalled();
    expect(client.observabilityAlertDispatch.deleteMany).toHaveBeenCalled();
    expect(client.observabilityIncidentTrigger.deleteMany).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
