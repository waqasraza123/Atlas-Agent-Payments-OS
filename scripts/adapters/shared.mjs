import { createHash } from "node:crypto";

export function readAtlasOperationPayload() {
  const raw = process.env.ATLAS_OPERATION_PAYLOAD?.trim() ?? "";

  if (!raw) {
    throw new Error("ATLAS_OPERATION_PAYLOAD is required.");
  }

  return JSON.parse(raw);
}

export function requireText(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

export function readOptionalText(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function readTraceContext(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const trace = payload.trace;

  if (!trace || typeof trace !== "object" || Array.isArray(trace)) {
    return null;
  }

  const traceId = readOptionalText(trace.traceId);
  const spanId = readOptionalText(trace.spanId);
  const traceparent = readOptionalText(trace.traceparent);
  const sourceService = readOptionalText(trace.sourceService);

  if (!traceId || !spanId || !traceparent) {
    return null;
  }

  return {
    traceId,
    spanId,
    traceparent,
    sourceService
  };
}

export function withTraceHeaders(init = {}, trace) {
  if (!trace) {
    return init;
  }

  return {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      "x-atlas-trace-id": trace.traceId,
      "x-atlas-span-id": trace.spanId,
      traceparent: trace.traceparent,
      ...(trace.sourceService ? { "x-atlas-origin-service": trace.sourceService } : {})
    }
  };
}

export function shouldSimulateExternalExecution() {
  return process.env.ATLAS_SIMULATE_EXTERNAL_EXECUTION === "true" || process.env.NODE_ENV === "test";
}

export function createOperationId(provider, payload) {
  const hash = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 12);

  return `${provider}-${hash}`;
}

export function writeAdapterResult(result) {
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
