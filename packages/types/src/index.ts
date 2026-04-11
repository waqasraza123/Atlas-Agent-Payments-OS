export const organizationKinds = ["BUYER", "SELLER", "OPERATOR"] as const;
export type OrganizationKind = (typeof organizationKinds)[number];

export const membershipRoles = ["OWNER", "ADMIN", "OPERATOR", "REVIEWER", "FINANCE"] as const;
export type MembershipRole = (typeof membershipRoles)[number];

export const agentStatuses = ["DRAFT", "ACTIVE", "PAUSED", "DISABLED"] as const;
export type AgentStatus = (typeof agentStatuses)[number];

export const spendRequestStatuses = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "EXECUTING",
  "COMPLETED",
  "FAILED",
  "CANCELED"
] as const;
export type SpendRequestStatus = (typeof spendRequestStatuses)[number];

export const paymentStatuses = ["PENDING", "AUTHORIZED", "CAPTURED", "FAILED", "VOIDED"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];
