import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("worker observability automation", () => {
  it("runs a successful automation cycle with the configured scheduler payload", async () => {
    vi.stubEnv("OBSERVABILITY_AUTOMATION_ACTOR_USER_EMAIL", "operator-admin@atlas.local");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_REASON", "Run scheduled observability automation for the current release slot.");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_DEFAULT_MINIMUM_SEVERITY", "warning");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_DISPATCH_ALERTS", "true");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_TRIGGER_INCIDENTS", "true");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_TELEMETRY_POLICY", "monitor");

    const executeAutomationPolicy = vi.fn(async () => ({
      reportPath: "/tmp/observability-automation.json",
      telemetryPolicy: "monitor",
      telemetryRecoveryStatus: "not_requested",
      recoveredKeys: [],
      remainingKeys: [],
      snapshotId: "snapshot-1",
      dispatchId: "dispatch-1",
      activeIncidentCount: 2
    }));
    const writeFailureReport = vi.fn();
    const logMessage = vi.fn();
    const { runWorkerObservabilityAutomationCycle } = await import("./observability-automation");

    const result = await runWorkerObservabilityAutomationCycle("scheduled", {
      executeAutomationPolicy: executeAutomationPolicy as never,
      writeFailureReport: writeFailureReport as never,
      logMessage: logMessage as never,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval
    });

    expect(result).toEqual({
      status: "SUCCEEDED",
      reportPath: "/tmp/observability-automation.json",
      errorMessage: null
    });
    expect(executeAutomationPolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserEmail: "operator-admin@atlas.local",
        dispatchAlerts: true,
        telemetryPolicy: "monitor",
        triggerIncidents: true,
        trigger: "scheduled"
      })
    );
    expect(writeFailureReport).not.toHaveBeenCalled();
    expect(logMessage).toHaveBeenCalledWith(
      "worker.observability_automation.completed",
      expect.objectContaining({
        snapshotId: "snapshot-1",
        dispatchId: "dispatch-1",
        activeIncidentCount: 2,
        telemetryPolicy: "monitor",
        telemetryRecoveryStatus: "not_requested"
      })
    );
  }, 15000);

  it("runs ownership recovery policy when scheduled automation is configured to recover", async () => {
    vi.stubEnv("OBSERVABILITY_AUTOMATION_ACTOR_USER_EMAIL", "operator-admin@atlas.local");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_REASON", "Recover degraded telemetry ownership during the current release slot.");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_DEFAULT_MINIMUM_SEVERITY", "warning");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_DISPATCH_ALERTS", "false");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_TRIGGER_INCIDENTS", "true");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_TELEMETRY_POLICY", "recover");

    const executeAutomationPolicy = vi.fn(async () => ({
      reportPath: "/tmp/observability-automation-recovery.json",
      telemetryPolicy: "recover",
      telemetryRecoveryStatus: "partial",
      recoveredKeys: ["automation-cadence"],
      remainingKeys: ["worker-runtime"],
      snapshotId: "snapshot-recovery-1",
      dispatchId: null,
      activeIncidentCount: 1
    }));
    const { runWorkerObservabilityAutomationCycle } = await import("./observability-automation");
    const logMessage = vi.fn();

    const result = await runWorkerObservabilityAutomationCycle("scheduled", {
      executeAutomationPolicy: executeAutomationPolicy as never,
      writeFailureReport: vi.fn() as never,
      logMessage: logMessage as never,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval
    });

    expect(result).toEqual({
      status: "SUCCEEDED",
      reportPath: "/tmp/observability-automation-recovery.json",
      errorMessage: null
    });
    expect(executeAutomationPolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        telemetryPolicy: "recover",
        trigger: "scheduled"
      })
    );
    expect(logMessage).toHaveBeenCalledWith(
      "worker.observability_automation.completed",
      expect.objectContaining({
        telemetryPolicy: "recover",
        telemetryRecoveryStatus: "partial",
        recoveredOwnershipCount: 1,
        remainingOwnershipCount: 1
      })
    );
  }, 15000);

  it("writes a durable failure report when the automation cycle fails", async () => {
    vi.stubEnv("OBSERVABILITY_AUTOMATION_ACTOR_USER_EMAIL", "operator-admin@atlas.local");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_REASON", "Run scheduled observability automation for the current release slot.");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_DEFAULT_MINIMUM_SEVERITY", "critical");
    const executeAutomation = vi.fn(async () => {
      throw new Error("Published API runtime snapshot is missing.");
    });
    const writeFailureReport = vi.fn(() => ({
      reportPath: "/tmp/observability-automation-failed.json"
    }));
    const logMessage = vi.fn();
    const { runWorkerObservabilityAutomationCycle } = await import("./observability-automation");

    const result = await runWorkerObservabilityAutomationCycle("scheduled", {
      executeAutomationPolicy: executeAutomation as never,
      writeFailureReport: writeFailureReport as never,
      logMessage: logMessage as never,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval
    });

    expect(result).toEqual({
      status: "FAILED",
      reportPath: "/tmp/observability-automation-failed.json",
      errorMessage: "Published API runtime snapshot is missing."
    });
    expect(writeFailureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: "scheduled",
        minimumSeverity: "critical",
        telemetryPolicy: "monitor",
        errorMessage: "Published API runtime snapshot is missing."
      })
    );
    expect(logMessage).toHaveBeenCalledWith(
      "worker.observability_automation.failed",
      expect.objectContaining({
        reportPath: "/tmp/observability-automation-failed.json",
        error: "Published API runtime snapshot is missing."
      }),
      "error"
    );
  }, 15000);

  it("starts and stops the interval scheduler when interval mode is enabled", async () => {
    vi.stubEnv("OBSERVABILITY_AUTOMATION_SCHEDULE_MODE", "interval");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_INTERVAL_MINUTES", "20");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_STARTUP_DELAY_SECONDS", "45");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_TELEMETRY_POLICY", "recover");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_ACTOR_USER_EMAIL", "operator-admin@atlas.local");
    vi.stubEnv("OBSERVABILITY_AUTOMATION_REASON", "Run scheduled observability automation for the current release slot.");
    const timeoutHandle = { unref: vi.fn() };
    const intervalHandle = { unref: vi.fn() };
    const setTimeoutMock = vi.fn(() => timeoutHandle as never);
    const setIntervalMock = vi.fn(() => intervalHandle as never);
    const clearTimeoutMock = vi.fn();
    const clearIntervalMock = vi.fn();
    const logMessage = vi.fn();
    const executeAutomationPolicy = vi.fn(async () => ({
      reportPath: "/tmp/observability-automation.json",
      telemetryPolicy: "recover",
      telemetryRecoveryStatus: "no_action",
      recoveredKeys: [],
      remainingKeys: [],
      snapshotId: null,
      dispatchId: null,
      activeIncidentCount: 0
    }));
    const { startWorkerObservabilityAutomationScheduler } = await import("./observability-automation");

    const scheduler = startWorkerObservabilityAutomationScheduler({
      executeAutomationPolicy: executeAutomationPolicy as never,
      writeFailureReport: vi.fn() as never,
      logMessage: logMessage as never,
      setTimeout: setTimeoutMock as never,
      clearTimeout: clearTimeoutMock as never,
      setInterval: setIntervalMock as never,
      clearInterval: clearIntervalMock as never
    });

    expect(scheduler).not.toBeNull();
    expect(setTimeoutMock).toHaveBeenCalledWith(expect.any(Function), 45_000);
    expect(setIntervalMock).toHaveBeenCalledWith(expect.any(Function), 1_200_000);
    expect(timeoutHandle.unref).toHaveBeenCalled();
    expect(intervalHandle.unref).toHaveBeenCalled();

    scheduler?.stop();

    expect(clearTimeoutMock).toHaveBeenCalledWith(timeoutHandle);
    expect(clearIntervalMock).toHaveBeenCalledWith(intervalHandle);
  }, 15000);
});
