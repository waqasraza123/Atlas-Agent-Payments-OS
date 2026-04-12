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

export const policyStatuses = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type PolicyStatus = (typeof policyStatuses)[number];

export const serviceStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type ServiceStatus = (typeof serviceStatuses)[number];

export const serviceVisibilityModes = ["PRIVATE", "TRUSTED_BUYERS", "PUBLIC"] as const;
export type ServiceVisibilityMode = (typeof serviceVisibilityModes)[number];

export const servicePricingModels = ["FIXED"] as const;
export type ServicePricingModel = (typeof servicePricingModels)[number];

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

export const approvalStatuses = ["PENDING", "APPROVED", "REJECTED", "EXPIRED"] as const;
export type ApprovalStatus = (typeof approvalStatuses)[number];

export const paymentStatuses = ["PENDING", "AUTHORIZED", "CAPTURED", "FAILED", "VOIDED"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export const paymentRails = ["INTERNAL_SIMULATED", "STRIPE", "PROGRAMMABLE_USDC"] as const;
export type PaymentRail = (typeof paymentRails)[number];

export const receiptStatuses = ["PENDING", "AVAILABLE", "FAILED"] as const;
export type ReceiptStatus = (typeof receiptStatuses)[number];

export const programmableSettlementChains = ["BASE_SEPOLIA", "BASE_MAINNET"] as const;
export type ProgrammableSettlementChain = (typeof programmableSettlementChains)[number];
export const programmableSettlementChainLabels: Record<ProgrammableSettlementChain, string> = {
  BASE_SEPOLIA: "Base Sepolia",
  BASE_MAINNET: "Base Mainnet"
};

export const walletVerificationStatuses = ["PENDING", "VERIFIED", "REVOKED"] as const;
export type WalletVerificationStatus = (typeof walletVerificationStatuses)[number];

export const auditActorTypes = ["HUMAN", "AGENT", "SYSTEM"] as const;
export type AuditActorType = (typeof auditActorTypes)[number];

export const operatorCaseCategories = [
  "PAYMENT_FAILURE",
  "PAYMENT_RETRY_EXHAUSTED",
  "SETTLEMENT_DELAY",
  "SELLER_CONFIRMATION_DELAY",
  "RECEIPT_FAILURE",
  "RECEIPT_PENDING",
  "REQUEST_PAUSED"
] as const;
export type OperatorCaseCategory = (typeof operatorCaseCategories)[number];

export const operatorCaseSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type OperatorCaseSeverity = (typeof operatorCaseSeverities)[number];

export const operatorCaseStatuses = ["OPEN", "INVESTIGATING", "ACTION_REQUIRED", "RESOLVED", "CLOSED"] as const;
export type OperatorCaseStatus = (typeof operatorCaseStatuses)[number];

export const operatorActionTypes = [
  "PAUSE_REQUEST",
  "RELEASE_REQUEST",
  "REQUEUE_PAYMENT",
  "ANNOTATE_CASE",
  "RESOLVE_CASE"
] as const;
export type OperatorActionType = (typeof operatorActionTypes)[number];

export const notificationStatuses = ["UNREAD", "READ"] as const;
export type NotificationStatus = (typeof notificationStatuses)[number];

export function isOrganizationKind(value: string): value is OrganizationKind {
  return organizationKinds.includes(value as OrganizationKind);
}

export function isMembershipRole(value: string): value is MembershipRole {
  return membershipRoles.includes(value as MembershipRole);
}

export function isSpendRequestStatus(value: string): value is SpendRequestStatus {
  return spendRequestStatuses.includes(value as SpendRequestStatus);
}

export function isServiceStatus(value: string): value is ServiceStatus {
  return serviceStatuses.includes(value as ServiceStatus);
}

export function isServiceVisibilityMode(value: string): value is ServiceVisibilityMode {
  return serviceVisibilityModes.includes(value as ServiceVisibilityMode);
}

export function isServicePricingModel(value: string): value is ServicePricingModel {
  return servicePricingModels.includes(value as ServicePricingModel);
}

export function isApprovalStatus(value: string): value is ApprovalStatus {
  return approvalStatuses.includes(value as ApprovalStatus);
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return paymentStatuses.includes(value as PaymentStatus);
}

export function isPaymentRail(value: string): value is PaymentRail {
  return paymentRails.includes(value as PaymentRail);
}

export function isReceiptStatus(value: string): value is ReceiptStatus {
  return receiptStatuses.includes(value as ReceiptStatus);
}

export function isProgrammableSettlementChain(value: string): value is ProgrammableSettlementChain {
  return programmableSettlementChains.includes(value as ProgrammableSettlementChain);
}

export function isWalletVerificationStatus(value: string): value is WalletVerificationStatus {
  return walletVerificationStatuses.includes(value as WalletVerificationStatus);
}

export function isOperatorCaseCategory(value: string): value is OperatorCaseCategory {
  return operatorCaseCategories.includes(value as OperatorCaseCategory);
}

export function isOperatorCaseSeverity(value: string): value is OperatorCaseSeverity {
  return operatorCaseSeverities.includes(value as OperatorCaseSeverity);
}

export function isOperatorCaseStatus(value: string): value is OperatorCaseStatus {
  return operatorCaseStatuses.includes(value as OperatorCaseStatus);
}

export function isOperatorActionType(value: string): value is OperatorActionType {
  return operatorActionTypes.includes(value as OperatorActionType);
}

export function isNotificationStatus(value: string): value is NotificationStatus {
  return notificationStatuses.includes(value as NotificationStatus);
}
