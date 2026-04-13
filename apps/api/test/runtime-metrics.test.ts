import { beforeEach, describe, expect, it } from "vitest";
import {
  beginApiRequestMetric,
  getApiRuntimeMetricsSnapshot,
  getApiRuntimeTelemetryRecord,
  recordApiReadinessSnapshot,
  recordApiRequestMetric,
  resetApiRuntimeMetrics
} from "../src/lib/runtime-metrics";

describe("api runtime metrics", () => {
  beforeEach(() => {
    resetApiRuntimeMetrics();
  });

  it("records request volume and readiness posture", () => {
    const complete = beginApiRequestMetric();
    recordApiRequestMetric({
      method: "GET",
      path: "/health",
      statusCode: 200,
      durationMs: 12
    });
    complete();
    recordApiReadinessSnapshot("ready");

    const snapshot = getApiRuntimeMetricsSnapshot();

    expect(snapshot.totalRequests).toBe(1);
    expect(snapshot.successCount).toBe(1);
    expect(snapshot.errorCount).toBe(0);
    expect(snapshot.inFlightRequests).toBe(0);
    expect(snapshot.lastReadinessStatus).toBe("ready");
    expect(snapshot.routeMetrics[0]).toMatchObject({
      key: "GET /health",
      totalRequests: 1,
      lastStatusCode: 200
    });
    expect(getApiRuntimeTelemetryRecord()).toMatchObject({
      service: "api",
      configurationStatus: expect.any(String),
      revision: expect.any(String),
      deploymentSlot: expect.any(String)
    });
  });
});
