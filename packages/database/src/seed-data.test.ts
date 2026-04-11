import { atlasLocalSessionProfileList } from "@atlas/auth";
import { approvalStatuses, paymentStatuses, receiptStatuses, spendRequestStatuses } from "@atlas/types";
import { describe, expect, it } from "vitest";
import {
  atlasSeedApprovals,
  atlasSeedAuditEvents,
  atlasSeedMemberships,
  atlasSeedPaymentAttempts,
  atlasSeedPayments,
  atlasSeedReceipts,
  atlasSeedScenarioKey,
  atlasSeedSpendRequests,
  createAtlasSeedManifest,
  listAtlasSeedScenarioSummaries
} from "./seed-data";

describe("atlas seed data", () => {
  it("covers every request lifecycle state in the phase 0 manifest", () => {
    const manifest = createAtlasSeedManifest();

    expect(manifest.scenarioKey).toBe(atlasSeedScenarioKey);
    expect(manifest.requestStatusesCovered).toEqual([...spendRequestStatuses].sort());
    expect(manifest.approvalStatusesCovered).toEqual([...approvalStatuses].sort());
    expect(manifest.paymentStatusesCovered).toEqual([...paymentStatuses].sort());
    expect(manifest.paymentAttemptStatusesCovered).toEqual([...paymentStatuses].sort());
    expect(manifest.receiptStatusesCovered).toEqual([...receiptStatuses].sort());
  });

  it("covers every local session profile with a real membership", () => {
    const coverageByKey = new Map(
      createAtlasSeedManifest().localSessionProfileCoverage.map((entry) => [entry.profileKey, entry.covered])
    );

    expect(coverageByKey.size).toBe(atlasLocalSessionProfileList.length);
    expect([...coverageByKey.values()]).toEqual(expect.not.arrayContaining([false]));

    expect(
      atlasSeedMemberships.some(
        (membership) =>
          membership.userEmail === "seller@atlas.local" &&
          membership.organizationSlug === "atlas-demo-seller" &&
          membership.role === "ADMIN"
      )
    ).toBe(true);
  });

  it("keeps payment, approval, and receipt records aligned to seeded requests", () => {
    const requestIds = new Set(atlasSeedSpendRequests.map((request) => request.id));

    expect(atlasSeedApprovals.every((approval) => requestIds.has(approval.requestId))).toBe(true);
    expect(atlasSeedPayments.every((payment) => requestIds.has(payment.requestId))).toBe(true);
    expect(atlasSeedPaymentAttempts.every((attempt) => requestIds.has(attempt.requestId))).toBe(true);
    expect(atlasSeedReceipts.every((receipt) => requestIds.has(receipt.requestId))).toBe(true);
    expect(
      atlasSeedPaymentAttempts.every((attempt) =>
        atlasSeedPayments.some((payment) => payment.requestId === attempt.requestId && payment.rail === attempt.rail)
      )
    ).toBe(true);
  });

  it("keeps audit history tied to scenario-driven request lifecycles", () => {
    const requestIds = new Set(atlasSeedSpendRequests.map((request) => request.id));

    expect(atlasSeedAuditEvents.length).toBeGreaterThanOrEqual(10);
    expect(
      atlasSeedAuditEvents.every((event) => event.requestId === null || requestIds.has(event.requestId))
    ).toBe(true);
    expect(
      atlasSeedAuditEvents.some(
        (event) => event.eventType === "operator.reviewed_failure" && event.organizationSlug === "atlas-demo-operator"
      )
    ).toBe(true);
  });

  it("builds scenario summaries that stay aligned to seeded lifecycle records", () => {
    const scenarios = listAtlasSeedScenarioSummaries();
    const scenarioByKey = new Map(scenarios.map((scenario) => [scenario.key, scenario]));

    expect(scenarios).toHaveLength(atlasSeedSpendRequests.length);
    expect(scenarioByKey.get("completed-success")?.receiptStatus).toBe("AVAILABLE");
    expect(scenarioByKey.get("awaiting-approval")?.approvalStatus).toBe("PENDING");
    expect(scenarioByKey.get("payment-failed")?.paymentStatus).toBe("FAILED");
  });
});
