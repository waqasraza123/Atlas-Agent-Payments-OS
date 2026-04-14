import { describe, expect, it } from "vitest";
import { createOperatorNotificationItems } from "./operator-data";

describe("operator data", () => {
  it("links observability notifications to the operator alerts surface", () => {
    const items = createOperatorNotificationItems([
      {
        id: "notification-1",
        dedupeKey: "observability-remediation:staging",
        caseId: null,
        category: "observability-remediation",
        title: "Telemetry remediation requires operator follow-up",
        description: "Atlas needs an operator to acknowledge the current telemetry issue.",
        status: "UNREAD",
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:05:00.000Z"
      }
    ]);

    expect(items).toEqual([
      expect.objectContaining({
        href: "/operator/alerts",
        statusLabel: "Unread"
      })
    ]);
  });

  it("keeps case-backed notifications pointed at the case detail route", () => {
    const items = createOperatorNotificationItems([
      {
        id: "notification-2",
        dedupeKey: "operator-case:case-1",
        caseId: "case-1",
        category: "operator-case",
        title: "Payment failure",
        description: "Case detail needs direct operator review.",
        status: "UNREAD",
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:05:00.000Z"
      }
    ]);

    expect(items).toEqual([
      expect.objectContaining({
        href: "/operator/exceptions/case-1"
      })
    ]);
  });
});
