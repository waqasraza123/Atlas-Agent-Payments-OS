import { describe, expect, it } from "vitest";
import {
  createOperatorAutomationFacts,
  createOperatorAutomationRunItems,
  createOperatorTelemetryRemediationActionItems,
  createOperatorTelemetryRemediationFacts,
  createOperatorTelemetryRemediationFollowUpFacts,
  createOperatorTelemetryRemediationOwnershipFacts,
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
        remediationRetentionDays: 30,
        automationRetentionDays: 30
      },
      lastRunAt: null,
      lastRunStatus: null,
      lastReportPath: null,
      telemetryOwnership: [],
      telemetryRemediationOwnership: {
        status: "acknowledged",
        actorUserEmail: "operator-admin@atlas.local",
        reason: "Taking ownership of the current telemetry issue.",
        updatedAt: "2026-04-13T00:11:00.000Z",
        reportPath: "/tmp/remediation-1.json",
        detail: "Telemetry remediation is currently acknowledged by operator-admin@atlas.local."
      },
      telemetryRemediationFollowUp: {
        status: "warning",
        thresholdMinutes: 60,
        ageMinutes: 75,
        detail: "Telemetry remediation follow-up is 15 minutes overdue after 75 minutes since acknowledgement."
      },
      recentTelemetryRemediationActions: [],
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

describe("createOperatorTelemetryRemediationOwnershipFacts", () => {
  it("surfaces remediation ownership and closure details", () => {
    const items = createOperatorTelemetryRemediationOwnershipFacts({
      status: "acknowledged",
      actorUserEmail: "operator-admin@atlas.local",
      reason: "Taking ownership of the current telemetry issue.",
      updatedAt: "2026-04-13T00:11:00.000Z",
      reportPath: "/tmp/remediation-1.json",
      detail: "Telemetry remediation is currently acknowledged by operator-admin@atlas.local."
    });

    expect(items).toContainEqual({
      label: "Owner state",
      value: "Acknowledged"
    });
    expect(items).toContainEqual({
      label: "Owner",
      value: "operator-admin@atlas.local"
    });
  });
});

describe("createOperatorTelemetryRemediationFollowUpFacts", () => {
  it("surfaces remediation follow-up timing for operators", () => {
    const items = createOperatorTelemetryRemediationFollowUpFacts({
      status: "warning",
      thresholdMinutes: 60,
      ageMinutes: 75,
      detail: "Telemetry remediation follow-up is 15 minutes overdue after 75 minutes since acknowledgement."
    });

    expect(items).toContainEqual({
      label: "Follow-up posture",
      value: "Approaching breach"
    });
    expect(items).toContainEqual({
      label: "Acknowledgement age",
      value: "75 minutes"
    });
  });
});

describe("createOperatorTelemetryRemediationActionItems", () => {
  it("maps remediation closure history into operator list items", () => {
    const items = createOperatorTelemetryRemediationActionItems([
      {
        id: "/tmp/remediation-1.json",
        action: "ACKNOWLEDGED",
        generatedAt: "2026-04-13T00:11:00.000Z",
        actorUserEmail: "operator-admin@atlas.local",
        reason: "Taking ownership of the current telemetry issue.",
        remediationStatus: "action_required",
        affectedOwnershipKeys: ["worker-runtime"],
        latestAutomationReportPath: "/tmp/observability-automation.json",
        resolvedIncidentTriggerCount: 0,
        activeIncidentTriggerCount: 0,
        reportPath: "/tmp/remediation-1.json"
      }
    ]);

    expect(items).toEqual([
      expect.objectContaining({
        title: "Acknowledged telemetry remediation",
        statusTone: "warning"
      })
    ]);
  });

  it("renders incident reconciliation details for remediation closure history", () => {
    const items = createOperatorTelemetryRemediationActionItems([
      {
        id: "/tmp/remediation-2.json",
        action: "RESOLVED",
        generatedAt: "2026-04-13T00:15:00.000Z",
        actorUserEmail: "operator-admin@atlas.local",
        reason: "Closing telemetry remediation after healthy ownership was restored.",
        remediationStatus: "ready",
        affectedOwnershipKeys: ["automation-cadence"],
        latestAutomationReportPath: "/tmp/observability-automation.json",
        resolvedIncidentTriggerCount: 1,
        activeIncidentTriggerCount: 0,
        reportPath: "/tmp/remediation-2.json"
      }
    ]);

    expect(items).toEqual([
      expect.objectContaining({
        title: "Resolved telemetry remediation",
        detail: "ready posture · resolved 1 incident triggers · 0 active remain · /tmp/remediation-2.json",
        statusTone: "success"
      })
    ]);
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
