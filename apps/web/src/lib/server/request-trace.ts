import { randomBytes } from "node:crypto";
import type { AtlasOwnedExecutionTraceContext } from "@atlas/database";

type AtlasServerTraceSession = {
  traceId: string;
  rootSpanId: string;
  sourceService: AtlasOwnedExecutionTraceContext["sourceService"];
};

function createHexId(byteLength: number) {
  return randomBytes(byteLength).toString("hex");
}

function createAtlasTraceparentHeader(traceId: string, spanId: string) {
  return `00-${traceId}-${spanId}-01`;
}

export function createAtlasServerTraceSession(
  sourceService: AtlasServerTraceSession["sourceService"] = "web"
): AtlasServerTraceSession {
  return {
    traceId: createHexId(16),
    rootSpanId: createHexId(8),
    sourceService
  };
}

export function createAtlasChildTraceContext(session: AtlasServerTraceSession) {
  const spanId = createHexId(8);
  const traceparent = createAtlasTraceparentHeader(session.traceId, spanId);

  return {
    trace: {
      traceId: session.traceId,
      spanId,
      parentSpanId: session.rootSpanId,
      traceparent,
      sourceService: session.sourceService
    } satisfies AtlasOwnedExecutionTraceContext,
    headers: {
      "x-atlas-trace-id": session.traceId,
      "x-atlas-span-id": spanId,
      traceparent,
      "x-atlas-origin-service": session.sourceService
    }
  };
}

export function createAtlasStandaloneTraceContext(
  sourceService: AtlasOwnedExecutionTraceContext["sourceService"] = "web"
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
