import { organizationKinds, spendRequestStatuses, type OrganizationKind, type SpendRequestStatus } from "@atlas/types";

export const demoScenarioKey = "phase-0";

export function isOrganizationKind(value: string): value is OrganizationKind {
  return organizationKinds.includes(value as OrganizationKind);
}

export function isTerminalSpendRequestStatus(value: SpendRequestStatus) {
  return ["COMPLETED", "FAILED", "CANCELED", "REJECTED"].includes(value);
}

export function isKnownSpendRequestStatus(value: string): value is SpendRequestStatus {
  return spendRequestStatuses.includes(value as SpendRequestStatus);
}
