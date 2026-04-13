import { randomBytes } from "node:crypto";

export type AtlasOwnedExecutionTraceContext = {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  traceparent: string;
  sourceService: "api" | "web" | "worker";
};

function createHexId(byteLength: number) {
  return randomBytes(byteLength).toString("hex");
}

function createAtlasTraceparentHeader(traceId: string, spanId: string) {
  return `00-${traceId}-${spanId}-01`;
}

export function createOwnedExecutionTraceContext(
  sourceService: AtlasOwnedExecutionTraceContext["sourceService"]
): AtlasOwnedExecutionTraceContext {
  const traceId = createHexId(16);
  const spanId = createHexId(8);

  return {
    traceId,
    spanId,
    parentSpanId: null,
    traceparent: createAtlasTraceparentHeader(traceId, spanId),
    sourceService
  };
}
