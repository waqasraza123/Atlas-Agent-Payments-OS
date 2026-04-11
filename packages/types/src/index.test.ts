import { describe, expect, it } from "vitest";
import {
  approvalStatuses,
  isApprovalStatus,
  isMembershipRole,
  isOrganizationKind,
  isPaymentStatus,
  isReceiptStatus,
  isSpendRequestStatus,
  membershipRoleLabels,
  organizationKindLabels,
  paymentStatuses,
  receiptStatuses,
  spendRequestStatuses
} from "./index";

describe("atlas shared types", () => {
  it("guards organization kinds and membership roles", () => {
    expect(isOrganizationKind("BUYER")).toBe(true);
    expect(isOrganizationKind("INVALID")).toBe(false);
    expect(isMembershipRole("FINANCE")).toBe(true);
    expect(isMembershipRole("INVALID")).toBe(false);
  });

  it("guards lifecycle status values", () => {
    expect(spendRequestStatuses.every((status) => isSpendRequestStatus(status))).toBe(true);
    expect(approvalStatuses.every((status) => isApprovalStatus(status))).toBe(true);
    expect(paymentStatuses.every((status) => isPaymentStatus(status))).toBe(true);
    expect(receiptStatuses.every((status) => isReceiptStatus(status))).toBe(true);
    expect(isPaymentStatus("SETTLED")).toBe(false);
  });

  it("keeps display labels aligned to durable kinds and roles", () => {
    expect(organizationKindLabels.BUYER).toBe("Buyer");
    expect(membershipRoleLabels.ADMIN).toBe("Admin");
  });
});
