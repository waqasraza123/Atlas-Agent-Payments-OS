import { atlasLocalSessionProfileList } from "@atlas/auth";
import { demoScenarioKey } from "@atlas/domain";
import type { Prisma } from "./generated/client/index.js";
import type {
  ApprovalStatus,
  AuditActorType,
  MembershipRole,
  OrganizationKind,
  PaymentStatus,
  PolicyStatus,
  ReceiptStatus,
  SpendRequestStatus
} from "@atlas/types";

export const atlasSeedScenarioKey = `${demoScenarioKey}-foundation`;

type AtlasSeedJsonValue = Prisma.InputJsonValue;

export type AtlasSeedOrganizationDefinition = {
  slug: string;
  name: string;
  kind: OrganizationKind;
};

export type AtlasSeedUserDefinition = {
  email: string;
  name: string;
};

export type AtlasSeedMembershipDefinition = {
  userEmail: string;
  organizationSlug: string;
  role: MembershipRole;
};

export type AtlasSeedPolicyDefinition = {
  id: string;
  organizationSlug: string;
  name: string;
  status: PolicyStatus;
  rules: AtlasSeedJsonValue;
};

export type AtlasSeedAgentDefinition = {
  id: string;
  organizationSlug: string;
  name: string;
  externalRef: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "DISABLED";
  policyId: string | null;
  metadata: AtlasSeedJsonValue;
};

export type AtlasSeedSpendRequestDefinition = {
  id: string;
  organizationSlug: string;
  sellerOrganizationSlug: string | null;
  agentId: string;
  policyId: string | null;
  title: string;
  amountMinor: number;
  currency: string;
  serviceCategory: string;
  status: SpendRequestStatus;
  requestPayload: AtlasSeedJsonValue;
  metadata: AtlasSeedJsonValue;
};

export type AtlasSeedApprovalDefinition = {
  requestId: string;
  approverEmail: string | null;
  status: ApprovalStatus;
  decisionReason: string | null;
};

export type AtlasSeedPaymentDefinition = {
  requestId: string;
  organizationSlug: string;
  sellerOrganizationSlug: string | null;
  provider: string;
  reference: string | null;
  status: PaymentStatus;
  amountMinor: number;
  currency: string;
  metadata: AtlasSeedJsonValue;
};

export type AtlasSeedReceiptDefinition = {
  requestId: string;
  organizationSlug: string;
  storageKey: string | null;
  contentType: string | null;
  status: ReceiptStatus;
  metadata: AtlasSeedJsonValue;
};

export type AtlasSeedAuditEventDefinition = {
  id: string;
  organizationSlug: string | null;
  userEmail: string | null;
  agentId: string | null;
  requestId: string | null;
  actorType: AuditActorType;
  eventType: string;
  targetType: string;
  targetId: string;
  payload: AtlasSeedJsonValue;
  occurredAt: string;
};

export const atlasSeedOrganizations: AtlasSeedOrganizationDefinition[] = [
  {
    slug: "atlas-demo-buyer",
    name: "Atlas Demo Buyer",
    kind: "BUYER"
  },
  {
    slug: "atlas-demo-seller",
    name: "Atlas Demo Seller",
    kind: "SELLER"
  },
  {
    slug: "atlas-demo-operator",
    name: "Atlas Demo Operator",
    kind: "OPERATOR"
  },
  {
    slug: "northstar-research",
    name: "Northstar Research",
    kind: "BUYER"
  },
  {
    slug: "lighthouse-data",
    name: "Lighthouse Data",
    kind: "SELLER"
  }
];

export const atlasSeedUsers: AtlasSeedUserDefinition[] = [
  {
    email: "owner@atlas.local",
    name: "Buyer Owner"
  },
  {
    email: "finance@atlas.local",
    name: "Buyer Finance"
  },
  {
    email: "seller@atlas.local",
    name: "Seller Admin"
  },
  {
    email: "operator@atlas.local",
    name: "Operator"
  },
  {
    email: "reviewer@atlas.local",
    name: "Buyer Reviewer"
  },
  {
    email: "buyer-admin@atlas.local",
    name: "Buyer Admin"
  },
  {
    email: "northstar-owner@atlas.local",
    name: "Northstar Owner"
  }
];

export const atlasSeedMemberships: AtlasSeedMembershipDefinition[] = [
  {
    userEmail: "owner@atlas.local",
    organizationSlug: "atlas-demo-buyer",
    role: "OWNER"
  },
  {
    userEmail: "finance@atlas.local",
    organizationSlug: "atlas-demo-buyer",
    role: "FINANCE"
  },
  {
    userEmail: "reviewer@atlas.local",
    organizationSlug: "atlas-demo-buyer",
    role: "REVIEWER"
  },
  {
    userEmail: "buyer-admin@atlas.local",
    organizationSlug: "atlas-demo-buyer",
    role: "ADMIN"
  },
  {
    userEmail: "seller@atlas.local",
    organizationSlug: "atlas-demo-seller",
    role: "ADMIN"
  },
  {
    userEmail: "operator@atlas.local",
    organizationSlug: "atlas-demo-operator",
    role: "OPERATOR"
  },
  {
    userEmail: "northstar-owner@atlas.local",
    organizationSlug: "northstar-research",
    role: "OWNER"
  }
];

export const atlasSeedPolicies: AtlasSeedPolicyDefinition[] = [
  {
    id: "phase-0-low-risk-policy",
    organizationSlug: "atlas-demo-buyer",
    name: "Low Risk API Access",
    status: "ACTIVE",
    rules: {
      maxAmountMinor: 5000,
      serviceCategories: ["api-access"],
      sellerAllowlist: ["atlas-demo-seller"]
    }
  },
  {
    id: "phase-0-finance-policy",
    organizationSlug: "atlas-demo-buyer",
    name: "Finance Review Required",
    status: "ACTIVE",
    rules: {
      autoApprovalThresholdMinor: 2500,
      escalationThresholdMinor: 10000,
      serviceCategories: ["api-access", "digital-service"]
    }
  },
  {
    id: "phase-0-restricted-policy",
    organizationSlug: "atlas-demo-buyer",
    name: "Restricted Vendor Policy",
    status: "ARCHIVED",
    rules: {
      sellerAllowlist: ["atlas-demo-seller"],
      blockedCategories: ["regulated-report"]
    }
  }
];

export const atlasSeedAgents: AtlasSeedAgentDefinition[] = [
  {
    id: "phase-0-procurement-agent",
    organizationSlug: "atlas-demo-buyer",
    name: "Procurement Agent",
    externalRef: "agent://atlas/procurement",
    status: "ACTIVE",
    policyId: "phase-0-low-risk-policy",
    metadata: {
      ownerTeam: "Procurement",
      criticality: "medium"
    }
  },
  {
    id: "phase-0-finance-review-agent",
    organizationSlug: "atlas-demo-buyer",
    name: "Finance Review Agent",
    externalRef: "agent://atlas/finance-review",
    status: "PAUSED",
    policyId: "phase-0-finance-policy",
    metadata: {
      ownerTeam: "Finance",
      criticality: "high"
    }
  },
  {
    id: "phase-0-market-intel-agent",
    organizationSlug: "atlas-demo-buyer",
    name: "Market Intelligence Agent",
    externalRef: "agent://atlas/market-intel",
    status: "ACTIVE",
    policyId: "phase-0-finance-policy",
    metadata: {
      ownerTeam: "Strategy",
      criticality: "medium"
    }
  },
  {
    id: "phase-0-disabled-agent",
    organizationSlug: "atlas-demo-buyer",
    name: "Disabled Agent",
    externalRef: "agent://atlas/disabled",
    status: "DISABLED",
    policyId: "phase-0-restricted-policy",
    metadata: {
      ownerTeam: "Operations",
      criticality: "low"
    }
  },
  {
    id: "phase-0-northstar-agent",
    organizationSlug: "northstar-research",
    name: "Northstar Research Agent",
    externalRef: "agent://northstar/research",
    status: "ACTIVE",
    policyId: null,
    metadata: {
      ownerTeam: "Research",
      criticality: "medium"
    }
  }
];

export const atlasSeedSpendRequests: AtlasSeedSpendRequestDefinition[] = [
  {
    id: "phase-0-request-draft",
    organizationSlug: "atlas-demo-buyer",
    sellerOrganizationSlug: "atlas-demo-seller",
    agentId: "phase-0-procurement-agent",
    policyId: "phase-0-low-risk-policy",
    title: "Draft benchmark API session",
    amountMinor: 900,
    currency: "USD",
    serviceCategory: "api-access",
    status: "DRAFT",
    requestPayload: {
      service: "benchmark-api",
      plan: "developer"
    },
    metadata: {
      scenarioKey: "draft",
      scenarioLabel: "Draft request before submission"
    }
  },
  {
    id: "phase-0-request-submitted",
    organizationSlug: "atlas-demo-buyer",
    sellerOrganizationSlug: "atlas-demo-seller",
    agentId: "phase-0-market-intel-agent",
    policyId: "phase-0-finance-policy",
    title: "Premium dataset unlock",
    amountMinor: 8900,
    currency: "USD",
    serviceCategory: "digital-service",
    status: "SUBMITTED",
    requestPayload: {
      service: "global-dataset-access",
      dataset: "global-procurement"
    },
    metadata: {
      scenarioKey: "awaiting-approval",
      scenarioLabel: "Pending buyer approval"
    }
  },
  {
    id: "phase-0-request-approved",
    organizationSlug: "atlas-demo-buyer",
    sellerOrganizationSlug: "atlas-demo-seller",
    agentId: "phase-0-procurement-agent",
    policyId: "phase-0-low-risk-policy",
    title: "Compliance API bundle",
    amountMinor: 2400,
    currency: "USD",
    serviceCategory: "api-access",
    status: "APPROVED",
    requestPayload: {
      service: "compliance-api-bundle",
      plan: "team"
    },
    metadata: {
      scenarioKey: "approved-awaiting-execution",
      scenarioLabel: "Approved and ready for payment"
    }
  },
  {
    id: "phase-0-request-executing",
    organizationSlug: "atlas-demo-buyer",
    sellerOrganizationSlug: "atlas-demo-seller",
    agentId: "phase-0-market-intel-agent",
    policyId: "phase-0-finance-policy",
    title: "Vendor intelligence report",
    amountMinor: 6200,
    currency: "USD",
    serviceCategory: "digital-service",
    status: "EXECUTING",
    requestPayload: {
      service: "vendor-intelligence-report",
      reportType: "vendor-risk"
    },
    metadata: {
      scenarioKey: "executing-with-seller-confirmation-pending",
      scenarioLabel: "Payment authorized, delivery pending"
    }
  },
  {
    id: "phase-0-request-completed",
    organizationSlug: "atlas-demo-buyer",
    sellerOrganizationSlug: "atlas-demo-seller",
    agentId: "phase-0-procurement-agent",
    policyId: "phase-0-low-risk-policy",
    title: "Demo paid API access",
    amountMinor: 1900,
    currency: "USD",
    serviceCategory: "api-access",
    status: "COMPLETED",
    requestPayload: {
      service: "seller-demo-api",
      plan: "team"
    },
    metadata: {
      scenarioKey: "completed-success",
      scenarioLabel: "Happy-path paid action"
    }
  },
  {
    id: "phase-0-request-failed",
    organizationSlug: "atlas-demo-buyer",
    sellerOrganizationSlug: "atlas-demo-seller",
    agentId: "phase-0-market-intel-agent",
    policyId: "phase-0-finance-policy",
    title: "Specialized report generation",
    amountMinor: 4200,
    currency: "USD",
    serviceCategory: "digital-service",
    status: "FAILED",
    requestPayload: {
      service: "seller-report-generator",
      reportType: "vendor-risk"
    },
    metadata: {
      scenarioKey: "payment-failed",
      scenarioLabel: "Approved request with payment failure"
    }
  },
  {
    id: "phase-0-request-canceled",
    organizationSlug: "atlas-demo-buyer",
    sellerOrganizationSlug: "lighthouse-data",
    agentId: "phase-0-finance-review-agent",
    policyId: "phase-0-finance-policy",
    title: "Canceled regulatory dataset",
    amountMinor: 11200,
    currency: "USD",
    serviceCategory: "digital-service",
    status: "CANCELED",
    requestPayload: {
      service: "regulatory-dataset",
      region: "EU"
    },
    metadata: {
      scenarioKey: "approval-expired",
      scenarioLabel: "Approval expired before execution"
    }
  },
  {
    id: "phase-0-request-rejected",
    organizationSlug: "atlas-demo-buyer",
    sellerOrganizationSlug: "lighthouse-data",
    agentId: "phase-0-disabled-agent",
    policyId: "phase-0-restricted-policy",
    title: "Restricted supplier intelligence",
    amountMinor: 5700,
    currency: "USD",
    serviceCategory: "regulated-report",
    status: "REJECTED",
    requestPayload: {
      service: "supplier-intelligence",
      classification: "restricted"
    },
    metadata: {
      scenarioKey: "manual-rejection",
      scenarioLabel: "Rejected by policy and reviewer"
    }
  },
  {
    id: "phase-0-request-northstar-completed",
    organizationSlug: "northstar-research",
    sellerOrganizationSlug: "atlas-demo-seller",
    agentId: "phase-0-northstar-agent",
    policyId: null,
    title: "Northstar dataset refresh",
    amountMinor: 3600,
    currency: "USD",
    serviceCategory: "api-access",
    status: "COMPLETED",
    requestPayload: {
      service: "northstar-refresh",
      plan: "research"
    },
    metadata: {
      scenarioKey: "secondary-buyer-success",
      scenarioLabel: "Second buyer organization in seller history"
    }
  }
];

export const atlasSeedApprovals: AtlasSeedApprovalDefinition[] = [
  {
    requestId: "phase-0-request-submitted",
    approverEmail: "finance@atlas.local",
    status: "PENDING",
    decisionReason: null
  },
  {
    requestId: "phase-0-request-approved",
    approverEmail: "owner@atlas.local",
    status: "APPROVED",
    decisionReason: "Within buyer approval threshold"
  },
  {
    requestId: "phase-0-request-completed",
    approverEmail: "owner@atlas.local",
    status: "APPROVED",
    decisionReason: "Foundation demo seed"
  },
  {
    requestId: "phase-0-request-failed",
    approverEmail: "finance@atlas.local",
    status: "APPROVED",
    decisionReason: "Approved despite elevated risk for demo coverage"
  },
  {
    requestId: "phase-0-request-canceled",
    approverEmail: "finance@atlas.local",
    status: "EXPIRED",
    decisionReason: "Request expired before decision"
  },
  {
    requestId: "phase-0-request-rejected",
    approverEmail: "reviewer@atlas.local",
    status: "REJECTED",
    decisionReason: "Seller and service category are not permitted"
  },
  {
    requestId: "phase-0-request-northstar-completed",
    approverEmail: "northstar-owner@atlas.local",
    status: "APPROVED",
    decisionReason: "Northstar approved managed refresh"
  }
];

export const atlasSeedPayments: AtlasSeedPaymentDefinition[] = [
  {
    requestId: "phase-0-request-approved",
    organizationSlug: "atlas-demo-buyer",
    sellerOrganizationSlug: "atlas-demo-seller",
    provider: "simulated",
    reference: "sim-pay-0001",
    status: "PENDING",
    amountMinor: 2400,
    currency: "USD",
    metadata: {
      scenarioKey: "approved-awaiting-execution"
    }
  },
  {
    requestId: "phase-0-request-executing",
    organizationSlug: "atlas-demo-buyer",
    sellerOrganizationSlug: "atlas-demo-seller",
    provider: "simulated",
    reference: "sim-pay-0002",
    status: "AUTHORIZED",
    amountMinor: 6200,
    currency: "USD",
    metadata: {
      scenarioKey: "executing-with-seller-confirmation-pending"
    }
  },
  {
    requestId: "phase-0-request-completed",
    organizationSlug: "atlas-demo-buyer",
    sellerOrganizationSlug: "atlas-demo-seller",
    provider: "simulated",
    reference: "sim-pay-0003",
    status: "CAPTURED",
    amountMinor: 1900,
    currency: "USD",
    metadata: {
      scenarioKey: "completed-success"
    }
  },
  {
    requestId: "phase-0-request-failed",
    organizationSlug: "atlas-demo-buyer",
    sellerOrganizationSlug: "atlas-demo-seller",
    provider: "simulated",
    reference: "sim-pay-0004",
    status: "FAILED",
    amountMinor: 4200,
    currency: "USD",
    metadata: {
      scenarioKey: "payment-failed"
    }
  },
  {
    requestId: "phase-0-request-canceled",
    organizationSlug: "atlas-demo-buyer",
    sellerOrganizationSlug: "lighthouse-data",
    provider: "simulated",
    reference: "sim-pay-0005",
    status: "VOIDED",
    amountMinor: 11200,
    currency: "USD",
    metadata: {
      scenarioKey: "approval-expired"
    }
  },
  {
    requestId: "phase-0-request-northstar-completed",
    organizationSlug: "northstar-research",
    sellerOrganizationSlug: "atlas-demo-seller",
    provider: "simulated",
    reference: "sim-pay-0006",
    status: "CAPTURED",
    amountMinor: 3600,
    currency: "USD",
    metadata: {
      scenarioKey: "secondary-buyer-success"
    }
  }
];

export const atlasSeedReceipts: AtlasSeedReceiptDefinition[] = [
  {
    requestId: "phase-0-request-executing",
    organizationSlug: "atlas-demo-buyer",
    storageKey: "receipts/phase-0-request-executing.json",
    contentType: "application/json",
    status: "PENDING",
    metadata: {
      scenarioKey: "executing-with-seller-confirmation-pending"
    }
  },
  {
    requestId: "phase-0-request-completed",
    organizationSlug: "atlas-demo-buyer",
    storageKey: "receipts/phase-0-request-completed.json",
    contentType: "application/json",
    status: "AVAILABLE",
    metadata: {
      scenarioKey: "completed-success"
    }
  },
  {
    requestId: "phase-0-request-failed",
    organizationSlug: "atlas-demo-buyer",
    storageKey: "receipts/phase-0-request-failed.json",
    contentType: "application/json",
    status: "FAILED",
    metadata: {
      scenarioKey: "payment-failed"
    }
  },
  {
    requestId: "phase-0-request-northstar-completed",
    organizationSlug: "northstar-research",
    storageKey: "receipts/phase-0-request-northstar-completed.json",
    contentType: "application/json",
    status: "AVAILABLE",
    metadata: {
      scenarioKey: "secondary-buyer-success"
    }
  }
];

export const atlasSeedAuditEvents: AtlasSeedAuditEventDefinition[] = [
  {
    id: "phase-0-audit-request-submitted-created",
    organizationSlug: "atlas-demo-buyer",
    userEmail: "finance@atlas.local",
    agentId: "phase-0-market-intel-agent",
    requestId: "phase-0-request-submitted",
    actorType: "HUMAN",
    eventType: "request.created",
    targetType: "SpendRequest",
    targetId: "phase-0-request-submitted",
    payload: {
      scenarioKey: "awaiting-approval"
    },
    occurredAt: "2026-04-11T08:00:00.000Z"
  },
  {
    id: "phase-0-audit-request-submitted-pending",
    organizationSlug: "atlas-demo-buyer",
    userEmail: "finance@atlas.local",
    agentId: "phase-0-market-intel-agent",
    requestId: "phase-0-request-submitted",
    actorType: "HUMAN",
    eventType: "approval.pending",
    targetType: "Approval",
    targetId: "phase-0-request-submitted",
    payload: {
      scenarioKey: "awaiting-approval"
    },
    occurredAt: "2026-04-11T08:03:00.000Z"
  },
  {
    id: "phase-0-audit-request-approved",
    organizationSlug: "atlas-demo-buyer",
    userEmail: "owner@atlas.local",
    agentId: "phase-0-procurement-agent",
    requestId: "phase-0-request-approved",
    actorType: "HUMAN",
    eventType: "approval.approved",
    targetType: "Approval",
    targetId: "phase-0-request-approved",
    payload: {
      scenarioKey: "approved-awaiting-execution"
    },
    occurredAt: "2026-04-11T08:06:00.000Z"
  },
  {
    id: "phase-0-audit-payment-pending",
    organizationSlug: "atlas-demo-buyer",
    userEmail: "owner@atlas.local",
    agentId: "phase-0-procurement-agent",
    requestId: "phase-0-request-approved",
    actorType: "HUMAN",
    eventType: "payment.intent_created",
    targetType: "Payment",
    targetId: "phase-0-request-approved",
    payload: {
      scenarioKey: "approved-awaiting-execution"
    },
    occurredAt: "2026-04-11T08:07:00.000Z"
  },
  {
    id: "phase-0-audit-payment-authorized",
    organizationSlug: "atlas-demo-buyer",
    userEmail: "finance@atlas.local",
    agentId: "phase-0-market-intel-agent",
    requestId: "phase-0-request-executing",
    actorType: "HUMAN",
    eventType: "payment.authorized",
    targetType: "Payment",
    targetId: "phase-0-request-executing",
    payload: {
      scenarioKey: "executing-with-seller-confirmation-pending"
    },
    occurredAt: "2026-04-11T08:10:00.000Z"
  },
  {
    id: "phase-0-audit-request-completed",
    organizationSlug: "atlas-demo-buyer",
    userEmail: "owner@atlas.local",
    agentId: "phase-0-procurement-agent",
    requestId: "phase-0-request-completed",
    actorType: "HUMAN",
    eventType: "receipt.finalized",
    targetType: "Receipt",
    targetId: "phase-0-request-completed",
    payload: {
      scenarioKey: "completed-success"
    },
    occurredAt: "2026-04-11T08:12:00.000Z"
  },
  {
    id: "phase-0-audit-request-failed",
    organizationSlug: "atlas-demo-buyer",
    userEmail: "finance@atlas.local",
    agentId: "phase-0-market-intel-agent",
    requestId: "phase-0-request-failed",
    actorType: "HUMAN",
    eventType: "payment.failed",
    targetType: "Payment",
    targetId: "phase-0-request-failed",
    payload: {
      scenarioKey: "payment-failed",
      reason: "Seller settlement rejected"
    },
    occurredAt: "2026-04-11T08:14:00.000Z"
  },
  {
    id: "phase-0-audit-request-canceled",
    organizationSlug: "atlas-demo-buyer",
    userEmail: "finance@atlas.local",
    agentId: "phase-0-finance-review-agent",
    requestId: "phase-0-request-canceled",
    actorType: "HUMAN",
    eventType: "approval.expired",
    targetType: "Approval",
    targetId: "phase-0-request-canceled",
    payload: {
      scenarioKey: "approval-expired"
    },
    occurredAt: "2026-04-11T08:17:00.000Z"
  },
  {
    id: "phase-0-audit-request-rejected",
    organizationSlug: "atlas-demo-buyer",
    userEmail: "reviewer@atlas.local",
    agentId: "phase-0-disabled-agent",
    requestId: "phase-0-request-rejected",
    actorType: "HUMAN",
    eventType: "approval.rejected",
    targetType: "Approval",
    targetId: "phase-0-request-rejected",
    payload: {
      scenarioKey: "manual-rejection"
    },
    occurredAt: "2026-04-11T08:20:00.000Z"
  },
  {
    id: "phase-0-audit-secondary-buyer-success",
    organizationSlug: "northstar-research",
    userEmail: "northstar-owner@atlas.local",
    agentId: "phase-0-northstar-agent",
    requestId: "phase-0-request-northstar-completed",
    actorType: "HUMAN",
    eventType: "receipt.finalized",
    targetType: "Receipt",
    targetId: "phase-0-request-northstar-completed",
    payload: {
      scenarioKey: "secondary-buyer-success"
    },
    occurredAt: "2026-04-11T08:24:00.000Z"
  },
  {
    id: "phase-0-audit-operator-review",
    organizationSlug: "atlas-demo-operator",
    userEmail: "operator@atlas.local",
    agentId: null,
    requestId: "phase-0-request-failed",
    actorType: "HUMAN",
    eventType: "operator.reviewed_failure",
    targetType: "SpendRequest",
    targetId: "phase-0-request-failed",
    payload: {
      scenarioKey: "payment-failed",
      action: "triage"
    },
    occurredAt: "2026-04-11T08:28:00.000Z"
  }
];

function createSortedUniqueValues<T extends string>(values: T[]) {
  return [...new Set(values)].sort();
}

export function createAtlasSeedManifest() {
  return {
    scenarioKey: atlasSeedScenarioKey,
    organizations: atlasSeedOrganizations.length,
    users: atlasSeedUsers.length,
    memberships: atlasSeedMemberships.length,
    policies: atlasSeedPolicies.length,
    agents: atlasSeedAgents.length,
    requests: atlasSeedSpendRequests.length,
    approvals: atlasSeedApprovals.length,
    payments: atlasSeedPayments.length,
    receipts: atlasSeedReceipts.length,
    auditEvents: atlasSeedAuditEvents.length,
    requestStatusesCovered: createSortedUniqueValues(atlasSeedSpendRequests.map((request) => request.status)),
    approvalStatusesCovered: createSortedUniqueValues(atlasSeedApprovals.map((approval) => approval.status)),
    paymentStatusesCovered: createSortedUniqueValues(atlasSeedPayments.map((payment) => payment.status)),
    receiptStatusesCovered: createSortedUniqueValues(atlasSeedReceipts.map((receipt) => receipt.status)),
    localSessionProfileCoverage: atlasLocalSessionProfileList.map((profile) => ({
      profileKey: profile.key,
      covered: atlasSeedMemberships.some(
        (membership) =>
          membership.userEmail === profile.userEmail &&
          membership.organizationSlug === profile.organizationSlug &&
          membership.role === profile.role
      )
    }))
  };
}
