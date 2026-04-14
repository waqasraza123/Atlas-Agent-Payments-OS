import { describe, expect, it } from "vitest";
import {
  createOperatorAutomationFacts,
  createOperatorAutomationRunItems,
  createOperatorTelemetryRemediationFacts,
  createOperatorTelemetryOwnershipItems
} from "./operator-observability";

describe("createOperatorTelemetryOwnershipItems", () => {
  it("maps telemetry ownership records into operator list items", () => {
    const items = createOperatorTelemetryOwnershipItems([
      {
        key: "api-runtime",
        label: "API runtime telemetry",
        status: "healthy",
        detail: "Last published 1 minute ago from blue.",
        lastRecordedAt: "2026-04-13T00:11:00.000Z"
      },
      {
        key: "automation-cadence",
        label: "Automation cadence",
        status: "warning",
        detail: "Scheduled observability automation is disabled, so telemetry cadence depends on manual runs.",
        lastRecordedAt: null
      }
    ]);

    expect(items).toEqual([
      expect.objectContaining({
        id: "api-runtime",
        title: "API runtime telemetry",
        statusLabel: "Healthy",
        statusTone: "success"
      }),
      expect.objectContaining({
        id: "automation-cadence",
        title: "Automation cadence",
        statusLabel: "Warning",
        statusTone: "warning"
      })
    ]);
  });
});

describe("createOperatorAutomationFacts", () => {
  it("surfaces telemetry ownership policy alongside schedule facts", () => {
    const items = createOperatorAutomationFacts({
      scheduleMode: "interval",
      intervalMinutes: 15,
      startupDelaySeconds: 30,
      telemetryPolicy: "recover",
      telemetryRecoveryEscalation: {
        status: "triggered",
        consecutiveBreachedRuns: 3,
        threshold: 2,
        detail: "Telemetry auto-recovery has breached its target for 3 consecutive runs."
      },
      telemetryRemediation: {
        status: "escalated",
        title: "Telemetry ownership is breaching recovery policy",
        detail: "Telemetry auto-recovery has breached its target for 3 consecutive runs.",
        recommendedAction: "run-recovery-and-dispatch",
        recommendedActionLabel: "Run escalated recovery",
        reason: "Run guided telemetry remediation after repeated recovery-policy breaches.",
        minimumSeverity: "critical",
        dispatchAlerts: true,
        triggerIncidents: true,
        affectedOwnershipKeys: ["worker-runtime"],
        latestReportPath: "/tmp/observability-automation.json",
        runbookPath: "docs/runbooks/production-operations-baseline.md"
      },
      actorUserEmail: "operator-admin@atlas.local",
      minimumSeverity: "warning",
      dispatchAlerts: false,
      dispatchMode: "dry-run",
      dispatchProvider: "generic-webhook",
      dispatchDeliveryKind: "alert-dispatch",
      triggerIncidents: true,
      retention: {
        snapshotRetentionDays: 30,
        dispatchRetentionDays: 30,
        incidentRetentionDays: 30,
        automationRetentionDays: 30
      },
      lastRunAt: null,
      lastRunStatus: null,
      lastReportPath: null,
      telemetryOwnership: [],
      recentRuns: []
    });

    expect(items).toContainEqual({
      label: "Telemetry policy",
      value: "Recover degraded ownership"
    });
    expect(items).toContainEqual({
      label: "Recovery escalation",
      value: "3 run streak"
    });
  });
});

describe("createOperatorTelemetryRemediationFacts", () => {
  it("surfaces guided remediation details for operators", () => {
    const items = createOperatorTelemetryRemediationFacts({
      status: "escalated",
      title: "Telemetry ownership is breaching recovery policy",
      detail: "Telemetry auto-recovery has breached its target for 3 consecutive runs.",
      recommendedAction: "run-recovery-and-dispatch",
      recommendedActionLabel: "Run escalated recovery",
      reason: "Run guided telemetry remediation after repeated recovery-policy breaches.",
      minimumSeverity: "critical",
      dispatchAlerts: true,
      triggerIncidents: true,
      affectedOwnershipKeys: ["worker-runtime"],
      latestReportPath: "/tmp/observability-automation.json",
      runbookPath: "docs/runbooks/production-operations-baseline.md"
    });

    expect(items).toContainEqual({
      label: "Remediation status",
      value: "Escalated"
    });
    expect(items).toContainEqual({
      label: "Recommended action",
      value: "Run escalated recovery"
    });
  });
});

describe("createOperatorAutomationRunItems", () => {
  it("renders telemetry recovery details for policy-driven runs", () => {
    const items = createOperatorAutomationRunItems([
      {
        id: "run-1",
        status: "SUCCEEDED",
        trigger: "scheduled",
        generatedAt: "2026-04-13T00:11:00.000Z",
        actorUserEmail: "operator-admin@atlas.local",
        reason: "Recover degraded telemetry ownership during the current release slot.",
        minimumSeverity: "warning",
        dispatchAlerts: false,
        triggerIncidents: true,
        telemetryPolicy: "recover",
        telemetryRecoveryStatus: "partial",
        recoveredOwnershipCount: 1,
        remainingOwnershipCount: 1,
        alertCount: 2,
        activeIncidentCount: 1,
        snapshotId: "snapshot-1",
        dispatchId: null,
        workerTelemetryStatus: "healthy",
        reportPath: "/tmp/run-1.json",
        errorMessage: null
      }
    ]);

    expect(items).toEqual([
      expect.objectContaining({
        detail: "recover policy · warning threshold · /tmp/run-1.json",
        description: "Recovered 1 telemetry ownership signal with 1 still degraded."
      })
    ]);
  });
});
