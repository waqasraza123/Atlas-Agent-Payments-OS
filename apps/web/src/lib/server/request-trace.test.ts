import { describe, expect, it } from "vitest";
import {
  createAtlasChildTraceContext,
  createAtlasServerTraceSession,
  createAtlasStandaloneTraceContext
} from "./request-trace";

describe("request trace helpers", () => {
  it("creates correlated child trace headers from a server trace session", () => {
    const session = createAtlasServerTraceSession("web");
    const firstChild = createAtlasChildTraceContext(session);
    const secondChild = createAtlasChildTraceContext(session);

    expect(firstChild.trace.traceId).toBe(session.traceId);
    expect(firstChild.trace.parentSpanId).toBe(session.rootSpanId);
    expect(firstChild.headers["x-atlas-trace-id"]).toBe(session.traceId);
    expect(firstChild.headers["x-atlas-span-id"]).toBe(firstChild.trace.spanId);
    expect(firstChild.headers.traceparent).toBe(firstChild.trace.traceparent);
    expect(firstChild.headers["x-atlas-origin-service"]).toBe("web");
    expect(secondChild.trace.traceId).toBe(session.traceId);
    expect(secondChild.trace.spanId).not.toBe(firstChild.trace.spanId);
  });

  it("creates standalone trace contexts for command-backed actions", () => {
    const trace = createAtlasStandaloneTraceContext("web");

    expect(trace.parentSpanId).toBeNull();
    expect(trace.sourceService).toBe("web");
    expect(trace.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(trace.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(trace.traceparent).toBe(`00-${trace.traceId}-${trace.spanId}-01`);
  });
});
