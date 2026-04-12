import { Socket } from "node:net";
import {
  apiRuntime,
  appRuntime,
  atlasProduct,
  createAtlasReleaseManifest,
  storageRuntime,
  validateAtlasRuntimeConfiguration,
  workerRuntime
} from "@atlas/config";
import {
  buildAtlasIncidentReadinessRecord,
  buildAtlasObservabilityAlerts,
  type AtlasIncidentReadinessRecord
} from "@atlas/domain";
import { getApiRuntimeMetricsSnapshot, recordApiReadinessSnapshot } from "../../lib/runtime-metrics";
import { getOperatorOverview } from "@atlas/database";
import { prisma } from "@atlas/database";
import { Injectable } from "@nestjs/common";
import type { AtlasActorContext } from "@atlas/auth";

type AtlasHealthCheckStatus = "ok" | "degraded" | "skipped";

type AtlasHealthCheckResult = {
  dependency: "database" | "redis" | "object-storage";
  status: AtlasHealthCheckStatus;
  latencyMs: number;
  detail: string;
};

type AtlasReadinessPayload = {
  status: "ready" | "degraded";
  service: "api";
  product: string;
  appEnv: string;
  releaseStage: string;
  timestamp: string;
  checks: AtlasHealthCheckResult[];
};

@Injectable()
export class HealthService {
  private createTimestamp() {
    return new Date().toISOString();
  }

  private isSimulatedCheckMode() {
    return process.env.NODE_ENV === "test" || appRuntime.nodeEnv === "test";
  }

  private async measureDependencyCheck(
    dependency: AtlasHealthCheckResult["dependency"],
    runner: () => Promise<string>
  ): Promise<AtlasHealthCheckResult> {
    const startedAt = Date.now();

    try {
      const detail = await runner();
      return {
        dependency,
        status: "ok",
        latencyMs: Date.now() - startedAt,
        detail
      };
    } catch (error) {
      return {
        dependency,
        status: "degraded",
        latencyMs: Date.now() - startedAt,
        detail: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private createSimulatedCheckResult(dependency: AtlasHealthCheckResult["dependency"]): AtlasHealthCheckResult {
    return {
      dependency,
      status: "skipped",
      latencyMs: 0,
      detail: "Dependency checks are simulated in test mode."
    };
  }

  private async checkDatabase() {
    return this.measureDependencyCheck("database", async () => {
      await prisma.$queryRawUnsafe("SELECT 1");
      return "Database query succeeded.";
    });
  }

  private async checkRedis() {
    return this.measureDependencyCheck("redis", async () => {
      const redisUrl = new URL(workerRuntime.redisUrl);
      const host = redisUrl.hostname;
      const port = Number(redisUrl.port || 6379);

      await new Promise<void>((resolve, reject) => {
        const socket = new Socket();

        const fail = (error: Error) => {
          socket.destroy();
          reject(error);
        };

        socket.setTimeout(appRuntime.healthcheckTimeoutMs);
        socket.once("error", fail);
        socket.once("timeout", () => fail(new Error("Redis connectivity check timed out")));
        socket.connect(port, host, () => {
          socket.end();
          resolve();
        });
      });

      return `Redis TCP connection succeeded for ${host}:${port}.`;
    });
  }

  private async checkObjectStorage() {
    return this.measureDependencyCheck("object-storage", async () => {
      const protocol = storageRuntime.useSsl ? "https" : "http";
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), appRuntime.healthcheckTimeoutMs);

      try {
        const response = await fetch(
          `${protocol}://${storageRuntime.endpoint}:${storageRuntime.port}/minio/health/live`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Object storage health endpoint returned ${response.status}`);
        }

        return "Object storage live endpoint is reachable.";
      } finally {
        clearTimeout(timeoutHandle);
      }
    });
  }

  async getReadiness(): Promise<AtlasReadinessPayload> {
    const checks = this.isSimulatedCheckMode()
      ? [
          this.createSimulatedCheckResult("database"),
          this.createSimulatedCheckResult("redis"),
          this.createSimulatedCheckResult("object-storage")
        ]
      : await Promise.all([this.checkDatabase(), this.checkRedis(), this.checkObjectStorage()]);

    const payload = {
      status: checks.every((check) => check.status !== "degraded") ? "ready" : "degraded",
      service: "api",
      product: atlasProduct.name,
      appEnv: appRuntime.appEnv,
      releaseStage: appRuntime.releaseStage,
      timestamp: this.createTimestamp(),
      checks
    } satisfies AtlasReadinessPayload;

    recordApiReadinessSnapshot(payload.status);

    return payload;
  }

  getLiveness() {
    return {
      status: "ok",
      service: "api",
      product: atlasProduct.name,
      appEnv: appRuntime.appEnv,
      releaseStage: appRuntime.releaseStage,
      port: apiRuntime.port,
      timestamp: this.createTimestamp()
    } as const;
  }

  getStartup() {
    const manifest = createAtlasReleaseManifest("api");
    const validation = validateAtlasRuntimeConfiguration("api");

    return {
      status: "started",
      service: "api",
      product: atlasProduct.name,
      appEnv: appRuntime.appEnv,
      releaseStage: appRuntime.releaseStage,
      baseUrl: apiRuntime.baseUrl,
      revision: manifest.revision,
      deploymentSlot: manifest.deploymentSlot,
      configurationStatus: validation.ok ? "valid" : "invalid",
      requiredVariables: validation.requiredVariables,
      dependencies: ["database", "redis", "object-storage"],
      verificationCommand: "pnpm verify:release",
      timestamp: this.createTimestamp()
    } as const;
  }

  async getSummary() {
    const readiness = await this.getReadiness();

    return {
      status: readiness.status === "ready" ? "ok" : "degraded",
      service: "api",
      product: atlasProduct.name,
      appEnv: appRuntime.appEnv,
      releaseStage: appRuntime.releaseStage,
      dependencies: readiness.checks,
      timestamp: this.createTimestamp()
    } as const;
  }

  getMetrics() {
    const metrics = getApiRuntimeMetricsSnapshot();
    const startup = this.getStartup();

    return {
      item: {
        ...metrics,
        configurationStatus: startup.configurationStatus,
        verificationCommand: startup.verificationCommand
      }
    };
  }

  async getIncidentReadiness(actor: AtlasActorContext | null): Promise<AtlasIncidentReadinessRecord> {
    const startup = this.getStartup();
    const metrics = this.getMetrics().item;
    const overview = actor
      ? await getOperatorOverview(actor)
      : {
          openCaseCount: 0,
          criticalCaseCount: 0,
          actionRequiredCount: 0,
          unreadNotificationCount: 0,
          delayedCaseCount: 0,
          failedCaseCount: 0,
          recentCases: [],
          recentNotifications: [],
          recentAuditEvents: []
        };
    const alerts = buildAtlasObservabilityAlerts({
      metrics,
      overview,
      configurationStatus: startup.configurationStatus,
      releaseStage: appRuntime.releaseStage
    });

    return buildAtlasIncidentReadinessRecord({
      releaseStage: appRuntime.releaseStage,
      configurationStatus: startup.configurationStatus,
      hasRequestCorrelation: true,
      hasMetricsEndpoint: true,
      hasHealthEndpoints: true,
      hasRollbackVerification: true,
      hasBackupRestoreRunbook: true,
      activeAlertCount: alerts.length
    });
  }
}
