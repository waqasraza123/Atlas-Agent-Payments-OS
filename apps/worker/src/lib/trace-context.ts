import { randomBytes } from "node:crypto";
import type { Job } from "bullmq";

type AtlasWorkerJobTracePayload = {
  traceId?: unknown;
  parentSpanId?: unknown;
  requestId?: unknown;
};

export type AtlasWorkerJobTraceContext = {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  requestId: string | null;
};

function createHexId(byteLength: number) {
  return randomBytes(byteLength).toString("hex");
}

function readTracePayload(job: Job) {
  const data = job.data;

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  const trace = (data as Record<string, unknown>).trace;

  if (!trace || typeof trace !== "object" || Array.isArray(trace)) {
    return null;
  }

  return trace as AtlasWorkerJobTracePayload;
}

function isHexadecimal(value: string, length: number) {
  return value.length === length && /^[0-9a-f]+$/i.test(value);
}

export function createWorkerJobTraceContext(job: Job): AtlasWorkerJobTraceContext {
  const tracePayload = readTracePayload(job);
  const requestedTraceId = typeof tracePayload?.traceId === "string" ? tracePayload.traceId.trim().toLowerCase() : null;
  const requestedParentSpanId =
    typeof tracePayload?.parentSpanId === "string" ? tracePayload.parentSpanId.trim().toLowerCase() : null;

  return {
    traceId: requestedTraceId && isHexadecimal(requestedTraceId, 32) ? requestedTraceId : createHexId(16),
    spanId: createHexId(8),
    parentSpanId:
      requestedParentSpanId && isHexadecimal(requestedParentSpanId, 16) ? requestedParentSpanId : null,
    requestId: typeof tracePayload?.requestId === "string" && tracePayload.requestId.trim().length > 0 ? tracePayload.requestId : null
  };
}
