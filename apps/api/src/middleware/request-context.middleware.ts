import type { NestMiddleware } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { logApiEvent } from "../lib/logger";
import { createApiRequestTraceContext, createAtlasTraceparentHeader, runWithApiRequestTraceContext } from "../lib/request-trace";
import { beginApiRequestMetric, recordApiRequestMetric, recordApiTrace } from "../lib/runtime-metrics";

type ApiRequest = {
  method?: string;
  originalUrl?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  on(event: "finish", listener: () => void): void;
};

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: ApiRequest, response: ApiResponse, next: () => void) {
    const requestPath = request.originalUrl ?? request.url ?? "/";
    const traceContext = createApiRequestTraceContext({
      headers: request.headers,
      method: request.method ?? "UNKNOWN",
      path: requestPath
    });
    const startedAt = Date.now();
    const completeInFlightMetric = beginApiRequestMetric();

    response.setHeader("x-atlas-request-id", traceContext.requestId);
    response.setHeader("x-atlas-trace-id", traceContext.traceId);
    response.setHeader("x-atlas-span-id", traceContext.spanId);
    response.setHeader("traceparent", createAtlasTraceparentHeader(traceContext.traceId, traceContext.spanId));
    response.on("finish", () => {
      const durationMs = Date.now() - startedAt;
      completeInFlightMetric();
      recordApiRequestMetric({
        method: traceContext.method,
        path: requestPath,
        statusCode: response.statusCode,
        durationMs
      });
      recordApiTrace({
        traceId: traceContext.traceId,
        spanId: traceContext.spanId,
        parentSpanId: traceContext.parentSpanId,
        sourceService: "api",
        origin: "http",
        name: `${traceContext.method} ${requestPath}`,
        status: response.statusCode >= 500 ? "error" : "ok",
        requestId: traceContext.requestId,
        method: traceContext.method,
        path: requestPath,
        queueKey: null,
        queueName: null,
        jobId: null,
        attempt: null,
        startedAt: traceContext.startedAt,
        endedAt: new Date().toISOString(),
        durationMs
      });
      logApiEvent("info", "request.completed", {
        requestId: traceContext.requestId,
        traceId: traceContext.traceId,
        spanId: traceContext.spanId,
        parentSpanId: traceContext.parentSpanId,
        method: traceContext.method,
        path: requestPath,
        statusCode: response.statusCode,
        durationMs
      });
    });

    runWithApiRequestTraceContext(traceContext, next);
  }
}
