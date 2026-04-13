import { observabilityRuntime } from "@atlas/config";
import { executeObservabilityAutomation, writeObservabilityAutomationFailureReport } from "@atlas/database";
import { log } from "./logger";

type AtlasObservabilityAutomationTrigger = "manual" | "scheduled";

type AtlasWorkerObservabilityAutomationResult = {
  status: "SUCCEEDED" | "FAILED";
  reportPath: string;
  errorMessage: string | null;
};

type AtlasWorkerObservabilityAutomationDependencies = {
  executeAutomation: typeof executeObservabilityAutomation;
  writeFailureReport: typeof writeObservabilityAutomationFailureReport;
  logMessage: typeof log;
  setTimeout: typeof globalThis.setTimeout;
  clearTimeout: typeof globalThis.clearTimeout;
  setInterval: typeof globalThis.setInterval;
  clearInterval: typeof globalThis.clearInterval;
};

const defaultDependencies: AtlasWorkerObservabilityAutomationDependencies = {
  executeAutomation: executeObservabilityAutomation,
  writeFailureReport: writeObservabilityAutomationFailureReport,
  logMessage: log,
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
  setInterval: globalThis.setInterval.bind(globalThis),
  clearInterval: globalThis.clearInterval.bind(globalThis)
};

function buildAutomationPayload(trigger: AtlasObservabilityAutomationTrigger, generatedAt: string) {
  return {
    actorUserEmail: observabilityRuntime.automationActorUserEmail ?? "",
    reason: observabilityRuntime.automationReason ?? "",
    minimumSeverity: observabilityRuntime.automationDefaultMinimumSeverity,
    dispatchAlerts: observabilityRuntime.automationDispatchAlerts,
    triggerIncidents: observabilityRuntime.automationTriggerIncidents,
    trigger,
    now: generatedAt
  } as const;
}

function unrefTimer(handle: { unref?: () => void } | null | undefined) {
  if (handle && typeof handle.unref === "function") {
    handle.unref();
  }
}

export async function runWorkerObservabilityAutomationCycle(
  trigger: AtlasObservabilityAutomationTrigger,
  dependencies: AtlasWorkerObservabilityAutomationDependencies = defaultDependencies
): Promise<AtlasWorkerObservabilityAutomationResult> {
  const generatedAt = new Date().toISOString();

  try {
    const result = await dependencies.executeAutomation(buildAutomationPayload(trigger, generatedAt));
    dependencies.logMessage("worker.observability_automation.completed", {
      trigger,
      reportPath: result.reportPath,
      snapshotId: result.snapshot.id,
      dispatchId: result.dispatch?.id ?? null,
      activeIncidentCount: result.incidentTriggers?.activeCount ?? 0
    });

    return {
      status: "SUCCEEDED",
      reportPath: result.reportPath,
      errorMessage: null
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const failureReport = dependencies.writeFailureReport({
      trigger,
      actorUserEmail: observabilityRuntime.automationActorUserEmail,
      reason: observabilityRuntime.automationReason,
      minimumSeverity: observabilityRuntime.automationDefaultMinimumSeverity,
      dispatchAlerts: observabilityRuntime.automationDispatchAlerts,
      triggerIncidents: observabilityRuntime.automationTriggerIncidents,
      generatedAt,
      errorMessage
    });

    dependencies.logMessage(
      "worker.observability_automation.failed",
      {
        trigger,
        reportPath: failureReport.reportPath,
        error: errorMessage
      },
      "error"
    );

    return {
      status: "FAILED",
      reportPath: failureReport.reportPath,
      errorMessage
    };
  }
}

export function startWorkerObservabilityAutomationScheduler(
  dependencies: AtlasWorkerObservabilityAutomationDependencies = defaultDependencies
) {
  if (observabilityRuntime.automationScheduleMode !== "interval") {
    return null;
  }

  let activeRun: Promise<AtlasWorkerObservabilityAutomationResult> | null = null;
  const runScheduledCycle = () => {
    if (activeRun) {
      dependencies.logMessage("worker.observability_automation.skipped", {
        reason: "previous_run_active"
      });
      return activeRun;
    }

    activeRun = runWorkerObservabilityAutomationCycle("scheduled", dependencies).finally(() => {
      activeRun = null;
    });

    return activeRun;
  };
  const startupTimeout = dependencies.setTimeout(
    () => {
      void runScheduledCycle();
    },
    observabilityRuntime.automationScheduleStartupDelaySeconds * 1000
  );
  const intervalHandle = dependencies.setInterval(
    () => {
      void runScheduledCycle();
    },
    observabilityRuntime.automationScheduleIntervalMinutes * 60 * 1000
  );

  unrefTimer(startupTimeout);
  unrefTimer(intervalHandle);

  dependencies.logMessage("worker.observability_automation.started", {
    intervalMinutes: observabilityRuntime.automationScheduleIntervalMinutes,
    startupDelaySeconds: observabilityRuntime.automationScheduleStartupDelaySeconds,
    actorUserEmail: observabilityRuntime.automationActorUserEmail,
    dispatchAlerts: observabilityRuntime.automationDispatchAlerts,
    triggerIncidents: observabilityRuntime.automationTriggerIncidents
  });

  return {
    stop() {
      dependencies.clearTimeout(startupTimeout);
      dependencies.clearInterval(intervalHandle);
    },
    runNow() {
      return runWorkerObservabilityAutomationCycle("manual", dependencies);
    }
  };
}
