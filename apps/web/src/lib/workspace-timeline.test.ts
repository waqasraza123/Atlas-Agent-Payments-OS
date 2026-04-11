import { describe, expect, it } from "vitest";
import { buildAtlasLifecycleTimeline } from "./workspace-timeline";

describe("buildAtlasLifecycleTimeline", () => {
  it("includes request, approval, payment, receipt, and audit events in chronological order", () => {
    const timeline = buildAtlasLifecycleTimeline({
      request: {
        id: "request-1",
        title: "Request 1",
        status: "SUBMITTED",
        amountMinor: 1900,
        currency: "USD",
        serviceCategory: "api-access",
        createdAt: "2026-04-11T08:00:00.000Z",
        updatedAt: "2026-04-11T08:00:00.000Z"
      },
      approval: {
        id: "approval-1",
        status: "APPROVED",
        decisionReason: "Within threshold",
        approverLabel: "Buyer Owner",
        updatedAt: "2026-04-11T08:05:00.000Z"
      },
      payment: {
        id: "payment-1",
        status: "CAPTURED",
        provider: "simulated",
        reference: "sim-pay-001",
        amountMinor: 1900,
        currency: "USD",
        updatedAt: "2026-04-11T08:06:00.000Z"
      },
      receipt: {
        id: "receipt-1",
        status: "AVAILABLE",
        storageKey: "receipts/request-1.json",
        contentType: "application/json",
        updatedAt: "2026-04-11T08:07:00.000Z"
      },
      auditEvents: [
        {
          id: "audit-1",
          eventType: "receipt.finalized",
          actorType: "HUMAN",
          targetType: "Receipt",
          targetId: "receipt-1",
          occurredAt: "2026-04-11T08:08:00.000Z"
        }
      ]
    });

    expect(timeline).toHaveLength(5);
    expect(timeline.map((entry) => entry.label)).toEqual(["Request", "Approval", "Payment", "Receipt", "Audit"]);
    expect(timeline.at(-1)?.title).toBe("Receipt Finalized");
  });

  it("handles missing optional records and marks failures as critical", () => {
    const timeline = buildAtlasLifecycleTimeline({
      request: {
        id: "request-2",
        title: "Request 2",
        status: "FAILED",
        amountMinor: 4200,
        currency: "USD",
        serviceCategory: "digital-service",
        createdAt: "2026-04-11T08:00:00.000Z",
        updatedAt: "2026-04-11T08:00:00.000Z"
      },
      auditEvents: []
    });

    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.tone).toBe("critical");
    expect(timeline[0]?.statusLabel).toBe("Failed");
  });
});
