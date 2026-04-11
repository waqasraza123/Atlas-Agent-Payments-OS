import { describe, expect, it } from "vitest";
import {
  approvalStatuses,
  isApprovalStatus,
  isMembershipRole,
  isNotificationStatus,
  isOperatorActionType,
  isOperatorCaseCategory,
  isOperatorCaseSeverity,
  isOperatorCaseStatus,
  isPaymentRail,
  isOrganizationKind,
  isPaymentStatus,
  isReceiptStatus,
  isSpendRequestStatus,
  membershipRoleLabels,
  notificationStatuses,
  operatorActionTypes,
  operatorCaseCategories,
  operatorCaseSeverities,
  operatorCaseStatuses,
  organizationKindLabels,
  paymentRails,
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
    expect(paymentRails.every((rail) => isPaymentRail(rail))).toBe(true);
    expect(receiptStatuses.every((status) => isReceiptStatus(status))).toBe(true);
    expect(operatorCaseCategories.every((category) => isOperatorCaseCategory(category))).toBe(true);
    expect(operatorCaseSeverities.every((severity) => isOperatorCaseSeverity(severity))).toBe(true);
    expect(operatorCaseStatuses.every((status) => isOperatorCaseStatus(status))).toBe(true);
    expect(operatorActionTypes.every((action) => isOperatorActionType(action))).toBe(true);
    expect(notificationStatuses.every((status) => isNotificationStatus(status))).toBe(true);
    expect(isPaymentStatus("SETTLED")).toBe(false);
    expect(isPaymentRail("BTC")).toBe(false);
  });

  it("keeps display labels aligned to durable kinds and roles", () => {
    expect(organizationKindLabels.BUYER).toBe("Buyer");
    expect(membershipRoleLabels.ADMIN).toBe("Admin");
  });
});
