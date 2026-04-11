export const organizationKinds = ["BUYER", "SELLER", "OPERATOR"] as const;
export type OrganizationKind = (typeof organizationKinds)[number];
export const organizationKindLabels: Record<OrganizationKind, string> = {
  BUYER: "Buyer",
  SELLER: "Seller",
  OPERATOR: "Operator"
};

export const membershipRoles = ["OWNER", "ADMIN", "OPERATOR", "REVIEWER", "FINANCE"] as const;
export type MembershipRole = (typeof membershipRoles)[number];
export const membershipRoleLabels: Record<MembershipRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  OPERATOR: "Operator",
  REVIEWER: "Reviewer",
  FINANCE: "Finance"
};

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

export function isOrganizationKind(value: string): value is OrganizationKind {
  return organizationKinds.includes(value as OrganizationKind);
}

export function isMembershipRole(value: string): value is MembershipRole {
  return membershipRoles.includes(value as MembershipRole);
}
