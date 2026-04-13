import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes, randomUUID } from "node:crypto";

export type AtlasApiRequestTraceContext = {
  requestId: string;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  method: string;
  path: string;
  startedAt: string;
};

const apiRequestTraceStorage = new AsyncLocalStorage<AtlasApiRequestTraceContext>();

function createHexId(byteLength: number) {
  return randomBytes(byteLength).toString("hex");
}

function isHexadecimal(value: string, length: number) {
  return value.length === length && /^[0-9a-f]+$/i.test(value);
}

function readRequestHeader(headers: Record<string, string | string[] | undefined>, name: string) {
  const value = headers[name];

  return typeof value === "string" ? value : null;
}

export function parseAtlasTraceparentHeader(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  const parts = normalized.split("-");

  if (parts.length !== 4) {
    return null;
  }

  const [, traceId, parentSpanId] = parts;

  if (!isHexadecimal(traceId, 32) || !isHexadecimal(parentSpanId, 16)) {
    return null;
  }

  return {
    traceId: traceId.toLowerCase(),
    parentSpanId: parentSpanId.toLowerCase()
  };
}

export function createAtlasTraceparentHeader(traceId: string, spanId: string) {
  return `00-${traceId}-${spanId}-01`;
}

export function createApiRequestTraceContext(input: {
  headers: Record<string, string | string[] | undefined>;
  method: string;
  path: string;
}) {
  const requestId = readRequestHeader(input.headers, "x-atlas-request-id") ?? randomUUID();
  const traceparent = parseAtlasTraceparentHeader(readRequestHeader(input.headers, "traceparent"));
  const requestedTraceId = readRequestHeader(input.headers, "x-atlas-trace-id");
  const traceId =
    traceparent?.traceId ??
    (requestedTraceId && isHexadecimal(requestedTraceId, 32) ? requestedTraceId.toLowerCase() : createHexId(16));

  return {
    requestId,
    traceId,
    spanId: createHexId(8),
    parentSpanId: traceparent?.parentSpanId ?? null,
    method: input.method.toUpperCase(),
    path: input.path,
    startedAt: new Date().toISOString()
  } satisfies AtlasApiRequestTraceContext;
}

export function runWithApiRequestTraceContext<T>(context: AtlasApiRequestTraceContext, callback: () => T) {
  return apiRequestTraceStorage.run(context, callback);
}

export function getApiRequestTraceContext() {
  return apiRequestTraceStorage.getStore() ?? null;
}
