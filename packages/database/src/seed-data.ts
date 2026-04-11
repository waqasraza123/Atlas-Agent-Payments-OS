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
  ServicePricingModel,
  ServiceStatus,
  ServiceVisibilityMode,
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
  version: number;
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
  serviceKey: string | null;
  idempotencyKey: string | null;
  title: string;
  purpose: string;
  amountMinor: number;
  currency: string;
  serviceCategory: string;
  status: SpendRequestStatus;
  evaluationResult: AtlasSeedJsonValue | null;
  requestPayload: AtlasSeedJsonValue;
  metadata: AtlasSeedJsonValue;
};

export type AtlasSeedServiceDefinition = {
  id: string;
  organizationSlug: string;
  key: string;
  name: string;
  description: string;
  category: string;
  status: ServiceStatus;
  visibility: ServiceVisibilityMode;
  pricingModel: ServicePricingModel;
  priceMinor: number;
  currency: string;
  metadata: AtlasSeedJsonValue | null;
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

export type AtlasSeedScenarioSummary = {
  key: string;
  label: string;
  requestId: string;
  title: string;
  amountMinor: number;
  currency: string;
  requestStatus: SpendRequestStatus;
  approvalStatus: ApprovalStatus | null;
  paymentStatus: PaymentStatus | null;
  receiptStatus: ReceiptStatus | null;
  serviceCategory: string;
  sellerOrganizationSlug: string | null;
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
    version: 1,
    rules: {
      maxAmountMinor: 5000,
      autoApprovalThresholdMinor: 2500,
      serviceCategories: ["api-access"],
      sellerAllowlist: ["atlas-demo-seller"],
      emergencyStop: false
    }
  },
  {
    id: "phase-0-finance-policy",
    organizationSlug: "atlas-demo-buyer",
    name: "Finance Review Required",
    status: "ACTIVE",
    version: 1,
    rules: {
      autoApprovalThresholdMinor: 2500,
      escalationThresholdMinor: 10000,
      serviceCategories: ["api-access", "digital-service"],
      emergencyStop: false
    }
  },
  {
    id: "phase-0-restricted-policy",
    organizationSlug: "atlas-demo-buyer",
    name: "Restricted Vendor Policy",
    status: "ARCHIVED",
    version: 2,
    rules: {
      sellerAllowlist: ["atlas-demo-seller"],
      serviceCategories: ["api-access"],
      emergencyStop: true
    }
  }
];

export const atlasSeedServices: AtlasSeedServiceDefinition[] = [
  {
    id: "seller-service-benchmark-api",
    organizationSlug: "atlas-demo-seller",
    key: "benchmark-api",
    name: "Benchmark API Session",
    description: "Provide a controlled benchmark API session for buyer-side testing, evaluation, and demo flows.",
    category: "api-access",
    status: "DRAFT",
    visibility: "TRUSTED_BUYERS",
    pricingModel: "FIXED",
    priceMinor: 900,
    currency: "USD",
    metadata: {
      deliveryMode: "immediate"
    }
  },
  {
    id: "seller-service-global-dataset",
    organizationSlug: "atlas-demo-seller",
    key: "global-dataset-access",
    name: "Global Dataset Access",
    description: "Unlock a premium procurement dataset for market intelligence and agent-driven research workflows.",
    category: "digital-service",
    status: "PUBLISHED",
    visibility: "TRUSTED_BUYERS",
    pricingModel: "FIXED",
    priceMinor: 8900,
    currency: "USD",
    metadata: {
      deliveryMode: "managed"
    }
  },
  {
    id: "seller-service-compliance-api",
    organizationSlug: "atlas-demo-seller",
    key: "compliance-api-bundle",
    name: "Compliance API Bundle",
    description: "Expose a paid API bundle for automated compliance and vendor screening workflows.",
    category: "api-access",
    status: "PUBLISHED",
    visibility: "TRUSTED_BUYERS",
    pricingModel: "FIXED",
    priceMinor: 2400,
    currency: "USD",
    metadata: {
      deliveryMode: "immediate"
    }
  },
  {
    id: "seller-service-vendor-report",
    organizationSlug: "atlas-demo-seller",
    key: "vendor-intelligence-report",
    name: "Vendor Intelligence Report",
    description: "Generate a premium vendor intelligence report with delivery confirmation from the seller workflow.",
    category: "digital-service",
    status: "PUBLISHED",
    visibility: "TRUSTED_BUYERS",
    pricingModel: "FIXED",
    priceMinor: 6200,
    currency: "USD",
    metadata: {
      deliveryMode: "delayed"
    }
  },
  {
    id: "seller-service-demo-api",
    organizationSlug: "atlas-demo-seller",
    key: "seller-demo-api",
    name: "Seller Demo API",
    description: "Provide the canonical happy-path paid API used throughout the Atlas buyer and seller demo.",
    category: "api-access",
    status: "PUBLISHED",
    visibility: "PUBLIC",
    pricingModel: "FIXED",
    priceMinor: 1900,
    currency: "USD",
    metadata: {
      deliveryMode: "immediate"
    }
  },
  {
    id: "seller-service-report-generator",
    organizationSlug: "atlas-demo-seller",
    key: "seller-report-generator",
    name: "Specialized Report Generator",
    description: "Create a specialized paid report workflow used to exercise failure and escalation scenarios.",
    category: "digital-service",
    status: "PUBLISHED",
    visibility: "TRUSTED_BUYERS",
    pricingModel: "FIXED",
    priceMinor: 4200,
    currency: "USD",
    metadata: {
      deliveryMode: "managed"
    }
  },
  {
    id: "seller-service-northstar-refresh",
    organizationSlug: "atlas-demo-seller",
    key: "northstar-refresh",
    name: "Northstar Dataset Refresh",
    description: "Support a second buyer organization with a paid dataset refresh service for seller-side history.",
    category: "api-access",
    status: "PUBLISHED",
    visibility: "TRUSTED_BUYERS",
    pricingModel: "FIXED",
    priceMinor: 3600,
    currency: "USD",
    metadata: {
      deliveryMode: "immediate"
    }
  },
  {
    id: "seller-service-regulatory-dataset",
    organizationSlug: "lighthouse-data",
    key: "regulatory-dataset",
    name: "Regulatory Dataset",
    description: "Deliver a premium regulatory dataset package for controlled buyer-side compliance research flows.",
    category: "digital-service",
    status: "PUBLISHED",
    visibility: "TRUSTED_BUYERS",
    pricingModel: "FIXED",
    priceMinor: 11200,
    currency: "USD",
    metadata: {
      deliveryMode: "managed"
    }
  },
  {
    id: "seller-service-supplier-intelligence",
    organizationSlug: "lighthouse-data",
    key: "supplier-intelligence",
    name: "Supplier Intelligence Pack",
    description: "Provide a restricted supplier intelligence package used to exercise seller-side policy denials.",
    category: "regulated-report",
    status: "ARCHIVED",
    visibility: "PRIVATE",
    pricingModel: "FIXED",
    priceMinor: 5700,
    currency: "USD",
    metadata: {
      deliveryMode: "managed"
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
    serviceKey: "benchmark-api",
    idempotencyKey: "seed-draft-benchmark-session",
    title: "Draft benchmark API session",
    purpose: "Prepare a benchmark API session request before formal submission.",
    amountMinor: 900,
    currency: "USD",
    serviceCategory: "api-access",
    status: "DRAFT",
    evaluationResult: null,
    requestPayload: {
      service: "benchmark-api",
      serviceKey: "benchmark-api",
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
    serviceKey: "global-dataset-access",
    idempotencyKey: "seed-premium-dataset-unlock",
    title: "Premium dataset unlock",
    purpose: "Unlock a premium dataset needed for market intelligence analysis.",
    amountMinor: 8900,
    currency: "USD",
    serviceCategory: "digital-service",
    status: "SUBMITTED",
    evaluationResult: {
      outcome: "allow_requires_approval",
      status: "SUBMITTED",
      approvalStatus: "PENDING",
      matchedPolicyId: "phase-0-finance-policy",
      matchedPolicyVersion: 1,
      reasons: ["The request is allowed but requires a human approval before execution."],
      requiresApproval: true,
      autoApproved: false
    },
    requestPayload: {
      service: "global-dataset-access",
      serviceKey: "global-dataset-access",
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
    serviceKey: "compliance-api-bundle",
    idempotencyKey: "seed-compliance-api-bundle",
    title: "Compliance API bundle",
    purpose: "Purchase an approved compliance API bundle for automated vendor checks.",
    amountMinor: 2400,
    currency: "USD",
    serviceCategory: "api-access",
    status: "APPROVED",
    evaluationResult: {
      outcome: "allow_auto_approved",
      status: "APPROVED",
      approvalStatus: "APPROVED",
      matchedPolicyId: "phase-0-low-risk-policy",
      matchedPolicyVersion: 1,
      reasons: ["The request amount is within the policy auto-approval threshold."],
      requiresApproval: false,
      autoApproved: true
    },
    requestPayload: {
      service: "compliance-api-bundle",
      serviceKey: "compliance-api-bundle",
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
    serviceKey: "vendor-intelligence-report",
    idempotencyKey: "seed-vendor-intelligence-report",
    title: "Vendor intelligence report",
    purpose: "Generate a paid vendor intelligence report for internal buyer review.",
    amountMinor: 6200,
    currency: "USD",
    serviceCategory: "digital-service",
    status: "EXECUTING",
    evaluationResult: {
      outcome: "allow_requires_approval",
      status: "SUBMITTED",
      approvalStatus: "PENDING",
      matchedPolicyId: "phase-0-finance-policy",
      matchedPolicyVersion: 1,
      reasons: ["The request is allowed but requires a human approval before execution."],
      requiresApproval: true,
      autoApproved: false
    },
    requestPayload: {
      service: "vendor-intelligence-report",
      serviceKey: "vendor-intelligence-report",
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
    serviceKey: "seller-demo-api",
    idempotencyKey: "seed-demo-paid-api-access",
    title: "Demo paid API access",
    purpose: "Complete the canonical happy-path paid API flow for the buyer demo.",
    amountMinor: 1900,
    currency: "USD",
    serviceCategory: "api-access",
    status: "COMPLETED",
    evaluationResult: {
      outcome: "allow_auto_approved",
      status: "APPROVED",
      approvalStatus: "APPROVED",
      matchedPolicyId: "phase-0-low-risk-policy",
      matchedPolicyVersion: 1,
      reasons: ["The request amount is within the policy auto-approval threshold."],
      requiresApproval: false,
      autoApproved: true
    },
    requestPayload: {
      service: "seller-demo-api",
      serviceKey: "seller-demo-api",
      plan: "team"
    },
    metadata: {
      scenarioKey: "completed-success",
      scenarioLabel: "Happy-path paid action",
      sellerFulfillment: {
        fulfillmentStatus: "DELIVERED",
        note: "Seller delivered the API access and finalized the happy-path workflow.",
        recordedAt: "2026-04-11T08:11:00.000Z"
      }
    }
  },
  {
    id: "phase-0-request-failed",
    organizationSlug: "atlas-demo-buyer",
    sellerOrganizationSlug: "atlas-demo-seller",
    agentId: "phase-0-market-intel-agent",
    policyId: "phase-0-finance-policy",
    serviceKey: "seller-report-generator",
    idempotencyKey: "seed-specialized-report-generation",
    title: "Specialized report generation",
    purpose: "Request a specialized report that will fail after approval and payment attempt.",
    amountMinor: 4200,
    currency: "USD",
    serviceCategory: "digital-service",
    status: "FAILED",
    evaluationResult: {
      outcome: "allow_requires_approval",
      status: "SUBMITTED",
      approvalStatus: "PENDING",
      matchedPolicyId: "phase-0-finance-policy",
      matchedPolicyVersion: 1,
      reasons: ["The request is allowed but requires a human approval before execution."],
      requiresApproval: true,
      autoApproved: false
    },
    requestPayload: {
      service: "seller-report-generator",
      serviceKey: "seller-report-generator",
      reportType: "vendor-risk"
    },
    metadata: {
      scenarioKey: "payment-failed",
      scenarioLabel: "Approved request with payment failure",
      sellerFulfillment: {
        fulfillmentStatus: "FAILED",
        note: "Seller rejected fulfillment after the downstream execution path failed.",
        recordedAt: "2026-04-11T08:13:00.000Z"
      }
    }
  },
  {
    id: "phase-0-request-canceled",
    organizationSlug: "atlas-demo-buyer",
    sellerOrganizationSlug: "lighthouse-data",
    agentId: "phase-0-finance-review-agent",
    policyId: "phase-0-finance-policy",
    serviceKey: "regulatory-dataset",
    idempotencyKey: "seed-canceled-regulatory-dataset",
    title: "Canceled regulatory dataset",
    purpose: "Create a request that expires before its approval is completed.",
    amountMinor: 11200,
    currency: "USD",
    serviceCategory: "digital-service",
    status: "CANCELED",
    evaluationResult: {
      outcome: "allow_requires_approval",
      status: "SUBMITTED",
      approvalStatus: "PENDING",
      matchedPolicyId: "phase-0-finance-policy",
      matchedPolicyVersion: 1,
      reasons: ["The request is allowed but requires a human approval before execution."],
      requiresApproval: true,
      autoApproved: false
    },
    requestPayload: {
      service: "regulatory-dataset",
      serviceKey: "regulatory-dataset",
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
    serviceKey: "supplier-intelligence",
    idempotencyKey: "seed-restricted-supplier-intelligence",
    title: "Restricted supplier intelligence",
    purpose: "Attempt a restricted request that should be denied under buyer controls.",
    amountMinor: 5700,
    currency: "USD",
    serviceCategory: "regulated-report",
    status: "REJECTED",
    evaluationResult: {
      outcome: "deny_agent_inactive",
      status: "REJECTED",
      approvalStatus: null,
      matchedPolicyId: "phase-0-restricted-policy",
      matchedPolicyVersion: 2,
      reasons: ["The selected agent is not active and cannot create spend requests."],
      requiresApproval: false,
      autoApproved: false
    },
    requestPayload: {
      service: "supplier-intelligence",
      serviceKey: "supplier-intelligence",
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
    serviceKey: "northstar-refresh",
    idempotencyKey: "seed-northstar-dataset-refresh",
    title: "Northstar dataset refresh",
    purpose: "Refresh a second buyer organization dataset to enrich seller-side history.",
    amountMinor: 3600,
    currency: "USD",
    serviceCategory: "api-access",
    status: "COMPLETED",
    evaluationResult: null,
    requestPayload: {
      service: "northstar-refresh",
      serviceKey: "northstar-refresh",
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
    id: "phase-0-audit-seller-delivery-confirmed",
    organizationSlug: "atlas-demo-seller",
    userEmail: "seller@atlas.local",
    agentId: null,
    requestId: "phase-0-request-completed",
    actorType: "HUMAN",
    eventType: "seller_delivery_confirmed",
    targetType: "SpendRequest",
    targetId: "phase-0-request-completed",
    payload: {
      scenarioKey: "completed-success",
      serviceKey: "seller-demo-api"
    },
    occurredAt: "2026-04-11T08:11:00.000Z"
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
    id: "phase-0-audit-seller-delivery-failed",
    organizationSlug: "atlas-demo-seller",
    userEmail: "seller@atlas.local",
    agentId: null,
    requestId: "phase-0-request-failed",
    actorType: "HUMAN",
    eventType: "seller_delivery_failed",
    targetType: "SpendRequest",
    targetId: "phase-0-request-failed",
    payload: {
      scenarioKey: "payment-failed",
      serviceKey: "seller-report-generator"
    },
    occurredAt: "2026-04-11T08:13:00.000Z"
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

export function listAtlasSeedScenarioSummaries(): AtlasSeedScenarioSummary[] {
  const approvalsByRequestId = new Map(atlasSeedApprovals.map((approval) => [approval.requestId, approval]));
  const paymentsByRequestId = new Map(atlasSeedPayments.map((payment) => [payment.requestId, payment]));
  const receiptsByRequestId = new Map(atlasSeedReceipts.map((receipt) => [receipt.requestId, receipt]));

  return atlasSeedSpendRequests.map((request) => {
    const metadata = typeof request.metadata === "object" && request.metadata !== null ? request.metadata : null;
    const scenarioKey =
      metadata && "scenarioKey" in metadata && typeof metadata.scenarioKey === "string"
        ? metadata.scenarioKey
        : request.id;
    const scenarioLabel =
      metadata && "scenarioLabel" in metadata && typeof metadata.scenarioLabel === "string"
        ? metadata.scenarioLabel
        : request.title;

    return {
      key: scenarioKey,
      label: scenarioLabel,
      requestId: request.id,
      title: request.title,
      amountMinor: request.amountMinor,
      currency: request.currency,
      requestStatus: request.status,
      approvalStatus: approvalsByRequestId.get(request.id)?.status ?? null,
      paymentStatus: paymentsByRequestId.get(request.id)?.status ?? null,
      receiptStatus: receiptsByRequestId.get(request.id)?.status ?? null,
      serviceCategory: request.serviceCategory,
      sellerOrganizationSlug: request.sellerOrganizationSlug
    };
  });
}
