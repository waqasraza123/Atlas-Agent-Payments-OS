import {
  organizationKinds,
  spendRequestStatuses,
  type MembershipRole,
  type OrganizationKind,
  type SpendRequestStatus
} from "@atlas/types";
export {
  atlasAnalyticsFiltersSchema,
  createAtlasCsv,
  formatAtlasPercentLabel,
  formatAtlasTimelineLabel,
  matchesAtlasAnalyticsTextFilter,
  parseAtlasAnalyticsFilters,
  type AtlasActivityAnalyticsRecord,
  type AtlasAnalyticsBreakdownRecord,
  type AtlasAnalyticsFilters,
  type AtlasAnalyticsRiskLevel,
  type AtlasAnalyticsTimelinePoint,
  type AtlasBuyerAnalyticsRecord,
  type AtlasBuyerRequestAnalyticsRecord,
  type AtlasCsvColumn,
  type AtlasOrganizationHealthRecord,
  type AtlasPlatformAnalyticsRecord,
  type AtlasPlatformTransactionRecord,
  type AtlasSellerRevenueAnalyticsRecord,
  type AtlasSellerRequestAnalyticsRecord
} from "./analytics-reporting";
export {
  atlasBuyerAgentCreateSchema,
  atlasBuyerAgentUpdateSchema,
  atlasBuyerApprovalDecisionSchema,
  atlasBuyerPolicyCreateSchema,
  atlasBuyerPolicyRulesSchema,
  atlasBuyerPolicyUpdateSchema,
  atlasBuyerRequestCreateSchema,
  atlasPolicyEvaluationOutcomeSchema,
  atlasPolicyEvaluationResultSchema,
  createAtlasPolicyEvaluationResult,
  evaluateAtlasBuyerSpendRequest,
  formatAtlasPolicyEvaluationOutcomeLabel,
  formatAtlasPolicyStatusLabel,
  normalizeAtlasBuyerPolicyRules,
  parseAtlasPolicyEvaluationResult,
  summarizeAtlasPolicyEvaluation,
  type AtlasBuyerAgentCreateInput,
  type AtlasBuyerAgentUpdateInput,
  type AtlasBuyerApprovalDecisionInput,
  type AtlasBuyerPolicyCreateInput,
  type AtlasBuyerPolicyRules,
  type AtlasBuyerPolicyUpdateInput,
  type AtlasBuyerRequestCreateInput,
  type AtlasPolicyEvaluationInput,
  type AtlasPolicyEvaluationOutcome,
  type AtlasPolicyEvaluationResult
} from "./buyer-workflow";
export {
  atlasOperatorAuditFiltersSchema,
  atlasOperatorCaseActionSchema,
  atlasOperatorCaseFiltersSchema,
  buildAtlasOperatorCaseKey,
  classifyAtlasOperatorException,
  deriveAtlasOperatorAvailableActions,
  deriveAtlasOperatorReconciliationState,
  formatAtlasNotificationStatusLabel,
  formatAtlasOperatorActionTypeLabel,
  formatAtlasOperatorCaseCategoryLabel,
  formatAtlasOperatorCaseSeverityLabel,
  formatAtlasOperatorCaseStatusLabel,
  isAtlasOperatorActionAllowed,
  matchesAtlasOperatorTextFilter,
  type AtlasOperatorActionRecord,
  type AtlasOperatorAuditEventRecord,
  type AtlasOperatorCaseActionInput,
  type AtlasOperatorCaseClassification,
  type AtlasOperatorCaseFilters,
  type AtlasOperatorCaseRecord,
  type AtlasOperatorAuditFilters,
  type AtlasOperatorExceptionSignal,
  type AtlasOperatorNotificationRecord,
  type AtlasOperatorOverviewRecord
} from "./operator-workflow";
export {
  atlasPaymentMaximumAttemptCount,
  atlasPaymentExecutionSchema,
  atlasPaymentReconciliationStates,
  atlasStripePaymentIntentStatuses,
  deriveAtlasPaymentReconciliationState,
  determineAtlasSimulatedPaymentScenario,
  extractAtlasProgrammableSettlementEvidence,
  formatAtlasPaymentRailLabel,
  formatAtlasPaymentReconciliationStateLabel,
  formatAtlasPaymentStatusLabel,
  formatAtlasReceiptStatusLabel,
  isAtlasPaymentAttemptLimitReached,
  isAtlasPaymentExecutionEligible,
  isAtlasPaymentRetryEligible,
  isAtlasPaymentStatus,
  isAtlasPaymentTerminalStatus,
  isAtlasReceiptStatus,
  isAtlasStripePaymentIntentStatus,
  normalizeAtlasStripePaymentStatus,
  resolveAtlasReceiptStatus,
  summarizeAtlasReceiptEvidence,
  type AtlasPaymentAttemptRecord,
  type AtlasPaymentExecutionInput,
  type AtlasPaymentIntentRecord,
  type AtlasPaymentReconciliationState,
  type AtlasReceiptRecord,
  type AtlasSimulatedPaymentOutcome,
  type AtlasSimulatedPaymentScenario,
  type AtlasStripePaymentIntentStatus
} from "./payments-workflow";
export {
  atlasProgrammableSettlementSettingsSchema,
  atlasProgrammableWalletCreateSchema,
  atlasProgrammableWalletVerificationSchema,
  createAtlasProgrammableSettlementEvidenceSummary,
  createAtlasProgrammableSettlementSettings,
  deriveAtlasProgrammableSettlementReadiness,
  formatAtlasProgrammableChainLabel,
  formatAtlasWalletVerificationStatusLabel,
  normalizeAtlasWalletAddress,
  type AtlasOrganizationProgrammableSettlementRecord,
  type AtlasOrganizationWalletRecord,
  type AtlasProgrammableChainRecord,
  type AtlasProgrammableSettlementReadiness,
  type AtlasProgrammableSettlementSettings,
  type AtlasProgrammableWalletCreateInput,
  type AtlasProgrammableWalletVerificationInput
} from "./programmable-settlement";
export {
  atlasSellerFulfillmentStatuses,
  atlasSellerRequestFulfillmentSchema,
  atlasSellerServiceCreateSchema,
  atlasSellerServiceUpdateSchema,
  formatAtlasSellerFulfillmentStatusLabel,
  formatAtlasServicePricingModelLabel,
  formatAtlasServiceStatusLabel,
  formatAtlasServiceVisibilityLabel,
  isAtlasSellerPendingFulfillmentStatus,
  isAtlasSellerRequestFulfillmentAllowed,
  isAtlasSellerTerminalRequestStatus,
  isAtlasSpendRequestStatus,
  type AtlasSellerAnalyticsBuyerRecord,
  type AtlasSellerAnalyticsRecord,
  type AtlasSellerAnalyticsServiceRecord,
  type AtlasSellerFulfillmentStatus,
  type AtlasSellerProfileRecord,
  type AtlasSellerRequestFulfillmentInput,
  type AtlasSellerRequestFulfillmentRecord,
  type AtlasSellerRequestRecord,
  type AtlasSellerServiceCreateInput,
  type AtlasSellerServiceRecord,
  type AtlasSellerServiceUpdateInput,
  type AtlasSellerTeamMemberRecord
} from "./seller-workflow";

export const demoScenarioKey = "phase-0";

export type AtlasWorkspaceSurfaceKey =
  | "overview"
  | "agents"
  | "policies"
  | "requests"
  | "approvals"
  | "receipts"
  | "activity"
  | "wallets"
  | "services"
  | "payments"
  | "customers"
  | "webhooks"
  | "organizations"
  | "transactions"
  | "exceptions"
  | "audit";

export type AtlasWorkspaceSurfaceDefinition = {
  key: AtlasWorkspaceSurfaceKey;
  label: string;
  title: string;
  description: string;
  detail: string;
  href: string;
  status: "available" | "planned";
};

export type AtlasWorkspaceDefinition = {
  workspace: OrganizationKind;
  title: string;
  subtitle: string;
  description: string;
  rootHref: string;
  surfaces: AtlasWorkspaceSurfaceDefinition[];
};

export type AtlasApiDomainKey =
  | "identity"
  | "organizations"
  | "agents"
  | "policies"
  | "requests"
  | "approvals"
  | "audit"
  | "sellers"
  | "services"
  | "payments"
  | "receipts"
  | "programmable-settlement"
  | "analytics"
  | "operator-controls";

export type AtlasApiDomainDefinition = {
  key: AtlasApiDomainKey;
  title: string;
  description: string;
  routePrefix: string;
  ownerWorkspaces: OrganizationKind[];
  category: "identity" | "buyer" | "seller" | "operator" | "shared";
  nextPhase: string;
  readiness: "skeleton" | "planned";
};

export type AtlasQueueFamilyKey =
  | "approvals"
  | "notifications"
  | "payments"
  | "seller-webhooks"
  | "audit-projections";

export type AtlasQueueKey =
  | "approvals-routing"
  | "approvals-reminders"
  | "notifications-dispatch"
  | "payments-execution"
  | "seller-webhooks-delivery"
  | "audit-projections-refresh";

export type AtlasQueueDefinition = {
  key: AtlasQueueKey;
  family: AtlasQueueFamilyKey;
  name: string;
  title: string;
  description: string;
  ownerWorkspaces: OrganizationKind[];
  nextPhase: string;
  readiness: "placeholder" | "baseline" | "planned";
  defaultAttempts: number;
  backoffDelayMs: number;
};

const buyerWorkspaceDefinition: AtlasWorkspaceDefinition = {
  workspace: "BUYER",
  title: "Buyer workspace",
  subtitle: "Controlled autonomy",
  description:
    "Buyer teams define bounded spend authority, review request flow, and keep agent-driven money movement legible.",
  rootHref: "/buyer",
  surfaces: [
    {
      key: "overview",
      label: "Overview",
      title: "Buyer overview",
      description: "Track the current spending posture, approval pressure, and seeded request activity for the buyer org.",
      detail: "High-signal command view for policies, agents, and approvals.",
      href: "/buyer",
      status: "available"
    },
    {
      key: "agents",
      label: "Agents",
      title: "Agent inventory",
      description: "Review accountable software actors, their current policy links, and recent request behavior.",
      detail: "Foundation shell for later agent management workflows.",
      href: "/buyer/agents",
      status: "available"
    },
    {
      key: "policies",
      label: "Policies",
      title: "Policy controls",
      description: "Inspect the bounded-authority layer that will govern request evaluation and approval thresholds.",
      detail: "Phase 2 will turn this shell into a real policy management surface.",
      href: "/buyer/policies",
      status: "available"
    },
    {
      key: "requests",
      label: "Requests",
      title: "Spend requests",
      description: "View seeded spend requests by lifecycle state before real request creation ships.",
      detail: "This shell defines the durable layout for request detail and filtering later.",
      href: "/buyer/requests",
      status: "available"
    },
    {
      key: "approvals",
      label: "Approvals",
      title: "Approval queue",
      description: "Review the decision surface that will later hold real request approval and escalation actions.",
      detail: "The current shell focuses on triage posture and seeded approval state.",
      href: "/buyer/approvals",
      status: "available"
    },
    {
      key: "receipts",
      label: "Receipts",
      title: "Receipt records",
      description: "Inspect the durable evidence records that tie request, payment, and seller delivery into one buyer-facing artifact.",
      detail: "Phase 4 turns this into the buyer evidence surface.",
      href: "/buyer/receipts",
      status: "available"
    },
    {
      key: "activity",
      label: "Activity",
      title: "Buyer activity",
      description: "Inspect the timeline-heavy history that will anchor auditability for the buyer organization.",
      detail: "This becomes the request and receipt activity lens in later phases.",
      href: "/buyer/activity",
      status: "available"
    },
    {
      key: "wallets",
      label: "Settlement",
      title: "Programmable settlement",
      description: "Register organization wallets, govern allowed rails, and inspect readiness for programmable USDC settlement.",
      detail: "Phase 7 extends the payment abstraction without changing the off-chain product wedge.",
      href: "/buyer/wallets",
      status: "available"
    }
  ]
};

const sellerWorkspaceDefinition: AtlasWorkspaceDefinition = {
  workspace: "SELLER",
  title: "Seller workspace",
  subtitle: "Programmable services",
  description:
    "Seller teams expose paid digital capabilities, monitor inbound demand, and confirm delivery with durable evidence.",
  rootHref: "/seller",
  surfaces: [
    {
      key: "overview",
      label: "Overview",
      title: "Seller overview",
      description: "Track inbound request flow, captured payments, and recent customer activity.",
      detail: "High-signal shell for the supply side of Atlas.",
      href: "/seller",
      status: "available"
    },
    {
      key: "services",
      label: "Services",
      title: "Service catalog",
      description: "Review the seller-side service shell that later phases will turn into a publishable catalog.",
      detail: "This lays out the durable navigation for service creation and pricing.",
      href: "/seller/services",
      status: "available"
    },
    {
      key: "requests",
      label: "Requests",
      title: "Inbound requests",
      description: "Inspect incoming buyer-side demand before fulfillment and webhook flow are implemented.",
      detail: "This surface becomes the seller request queue in Phase 3.",
      href: "/seller/requests",
      status: "available"
    },
    {
      key: "payments",
      label: "Payments",
      title: "Settlement view",
      description: "Review the shell that will later surface captured payment state and payout readiness.",
      detail: "Payment execution arrives in Phase 4, but the seller-side shell is now durable.",
      href: "/seller/payments",
      status: "available"
    },
    {
      key: "customers",
      label: "Customers",
      title: "Buyer relationships",
      description: "Track the buyer organizations already visible in seeded request flow.",
      detail: "This becomes the seller customer surface in later phases.",
      href: "/seller/customers",
      status: "available"
    },
    {
      key: "webhooks",
      label: "Webhooks",
      title: "Webhook contracts",
      description: "Review the delivery boundary that will later carry seller fulfillment and reconciliation signals.",
      detail: "Phase 3 and 4 will turn this shell into a real webhook surface.",
      href: "/seller/webhooks",
      status: "available"
    },
    {
      key: "wallets",
      label: "Settlement",
      title: "Programmable settlement",
      description: "Register seller settlement wallets, govern programmable-rail readiness, and expose chain-aware payout posture.",
      detail: "Phase 7 keeps programmable settlement governed instead of making it the product identity.",
      href: "/seller/wallets",
      status: "available"
    }
  ]
};

const operatorWorkspaceDefinition: AtlasWorkspaceDefinition = {
  workspace: "OPERATOR",
  title: "Operator workspace",
  subtitle: "Trust and oversight",
  description:
    "Operator teams inspect platform-wide activity, review audit signals, and prepare for support-safe actions and exception handling.",
  rootHref: "/operator",
  surfaces: [
    {
      key: "overview",
      label: "Overview",
      title: "Operator overview",
      description: "Track organization count, failure posture, and the highest-pressure signals across the control plane.",
      detail: "High-signal shell for risk and support posture.",
      href: "/operator",
      status: "available"
    },
    {
      key: "organizations",
      label: "Organizations",
      title: "Organization directory",
      description: "Review buyer and seller org boundaries before the support and incident model deepens.",
      detail: "This surface later becomes the entry point for platform investigations.",
      href: "/operator/organizations",
      status: "available"
    },
    {
      key: "transactions",
      label: "Transactions",
      title: "Transaction review",
      description: "Inspect the shell that will later unify requests, approvals, payments, and receipts for operator review.",
      detail: "The current shell keeps the route and content structure durable.",
      href: "/operator/transactions",
      status: "available"
    },
    {
      key: "receipts",
      label: "Receipts",
      title: "Receipt review",
      description: "Inspect durable evidence records across organizations so operator review can move from request posture into receipt truth.",
      detail: "This becomes the operator receipt investigation surface in Phase 4.",
      href: "/operator/receipts",
      status: "available"
    },
    {
      key: "approvals",
      label: "Approvals",
      title: "Approval pressure",
      description: "Review the platform-wide approval queue lens before exceptions and escalations are implemented.",
      detail: "This becomes part of the operator trust center in Phase 5.",
      href: "/operator/approvals",
      status: "available"
    },
    {
      key: "exceptions",
      label: "Exceptions",
      title: "Exception queue",
      description: "Track seeded failure posture and the future shape of investigation-ready exception handling.",
      detail: "Operator cases remain deferred, but the shell and route are now durable.",
      href: "/operator/exceptions",
      status: "available"
    },
    {
      key: "audit",
      label: "Audit",
      title: "Audit explorer",
      description: "Inspect the timeline-oriented surface that will later expose cross-entity event causality and exports.",
      detail: "This anchors the operator audit direction for later phases.",
      href: "/operator/audit",
      status: "available"
    }
  ]
};

export const atlasWorkspaceDefinitions: Record<OrganizationKind, AtlasWorkspaceDefinition> = {
  BUYER: buyerWorkspaceDefinition,
  SELLER: sellerWorkspaceDefinition,
  OPERATOR: operatorWorkspaceDefinition
};

export const atlasApiDomainDefinitions: Record<AtlasApiDomainKey, AtlasApiDomainDefinition> = {
  identity: {
    key: "identity",
    title: "Identity",
    description: "Actor and membership context boundary used across web, API, and worker paths.",
    routePrefix: "/identity",
    ownerWorkspaces: ["BUYER", "SELLER", "OPERATOR"],
    category: "identity",
    nextPhase: "Phase 0.4",
    readiness: "skeleton"
  },
  organizations: {
    key: "organizations",
    title: "Organizations",
    description: "Tenant boundary and organization directory surface for platform visibility and support-safe review.",
    routePrefix: "/organizations",
    ownerWorkspaces: ["OPERATOR"],
    category: "operator",
    nextPhase: "Phase 0.4",
    readiness: "skeleton"
  },
  agents: {
    key: "agents",
    title: "Agents",
    description: "Accountable software actors operating under buyer-side policy boundaries.",
    routePrefix: "/agents",
    ownerWorkspaces: ["BUYER"],
    category: "buyer",
    nextPhase: "Phase 2",
    readiness: "skeleton"
  },
  policies: {
    key: "policies",
    title: "Policies",
    description: "Spend-governance boundaries controlling auto-approval, denial, and escalation posture.",
    routePrefix: "/policies",
    ownerWorkspaces: ["BUYER"],
    category: "buyer",
    nextPhase: "Phase 2",
    readiness: "skeleton"
  },
  requests: {
    key: "requests",
    title: "Requests",
    description: "Spend request lifecycle boundary connecting agents, policies, sellers, and later payments.",
    routePrefix: "/requests",
    ownerWorkspaces: ["BUYER", "SELLER", "OPERATOR"],
    category: "shared",
    nextPhase: "Phase 2",
    readiness: "skeleton"
  },
  approvals: {
    key: "approvals",
    title: "Approvals",
    description: "Approval queue and decision routing boundary for human control over spend.",
    routePrefix: "/approvals",
    ownerWorkspaces: ["BUYER", "OPERATOR"],
    category: "shared",
    nextPhase: "Phase 2",
    readiness: "skeleton"
  },
  audit: {
    key: "audit",
    title: "Audit",
    description: "Timeline and causality boundary for legible request, approval, payment, and operator activity.",
    routePrefix: "/audit",
    ownerWorkspaces: ["BUYER", "OPERATOR"],
    category: "shared",
    nextPhase: "Phase 5",
    readiness: "skeleton"
  },
  sellers: {
    key: "sellers",
    title: "Sellers",
    description: "Seller-side relationship and trust boundary for payable digital-service providers.",
    routePrefix: "/sellers",
    ownerWorkspaces: ["BUYER", "OPERATOR"],
    category: "shared",
    nextPhase: "Phase 3",
    readiness: "skeleton"
  },
  services: {
    key: "services",
    title: "Services",
    description: "Seller-published digital capabilities and the route into a programmable service catalog.",
    routePrefix: "/services",
    ownerWorkspaces: ["SELLER", "BUYER"],
    category: "shared",
    nextPhase: "Phase 3",
    readiness: "skeleton"
  },
  payments: {
    key: "payments",
    title: "Payments",
    description: "Payment execution boundary spanning buyer intent, seller settlement, and operator review.",
    routePrefix: "/payments",
    ownerWorkspaces: ["BUYER", "SELLER", "OPERATOR"],
    category: "shared",
    nextPhase: "Phase 4",
    readiness: "skeleton"
  },
  "programmable-settlement": {
    key: "programmable-settlement",
    title: "Programmable settlement",
    description: "Governed wallet registry and programmable-rail control boundary for on-chain evidence and rail restrictions.",
    routePrefix: "/programmable-settlement",
    ownerWorkspaces: ["BUYER", "SELLER", "OPERATOR"],
    category: "shared",
    nextPhase: "Phase 7",
    readiness: "skeleton"
  },
  receipts: {
    key: "receipts",
    title: "Receipts",
    description: "Durable evidence boundary tying request, approval, payment, and delivery into one record.",
    routePrefix: "/receipts",
    ownerWorkspaces: ["BUYER", "SELLER", "OPERATOR"],
    category: "shared",
    nextPhase: "Phase 4",
    readiness: "skeleton"
  },
  analytics: {
    key: "analytics",
    title: "Analytics",
    description: "Reporting, export, and cross-entity filtering boundary for buyer, seller, and operator decision support.",
    routePrefix: "/analytics",
    ownerWorkspaces: ["BUYER", "SELLER", "OPERATOR"],
    category: "shared",
    nextPhase: "Phase 6",
    readiness: "skeleton"
  },
  "operator-controls": {
    key: "operator-controls",
    title: "Operator controls",
    description: "Support-safe and risk-aware platform actions that require explicit reason capture and later case handling.",
    routePrefix: "/operator-controls",
    ownerWorkspaces: ["OPERATOR"],
    category: "operator",
    nextPhase: "Phase 5",
    readiness: "skeleton"
  }
};

export const atlasQueueDefinitions: Record<AtlasQueueKey, AtlasQueueDefinition> = {
  "approvals-routing": {
    key: "approvals-routing",
    family: "approvals",
    name: `atlas-${demoScenarioKey}-approvals-routing`,
    title: "Approval routing",
    description: "Routes approval-required requests into the correct buyer-side decision path.",
    ownerWorkspaces: ["BUYER", "OPERATOR"],
    nextPhase: "Phase 2",
    readiness: "baseline",
    defaultAttempts: 5,
    backoffDelayMs: 5000
  },
  "approvals-reminders": {
    key: "approvals-reminders",
    family: "approvals",
    name: `atlas-${demoScenarioKey}-approvals-reminders`,
    title: "Approval reminders",
    description: "Sends reminder and expiration signals for pending approvals.",
    ownerWorkspaces: ["BUYER", "OPERATOR"],
    nextPhase: "Phase 2",
    readiness: "baseline",
    defaultAttempts: 5,
    backoffDelayMs: 15000
  },
  "notifications-dispatch": {
    key: "notifications-dispatch",
    family: "notifications",
    name: `atlas-${demoScenarioKey}-notifications-dispatch`,
    title: "Notification dispatch",
    description: "Delivers in-app and future out-of-band notifications for request, approval, and operator events.",
    ownerWorkspaces: ["BUYER", "SELLER", "OPERATOR"],
    nextPhase: "Phase 5",
    readiness: "baseline",
    defaultAttempts: 8,
    backoffDelayMs: 10000
  },
  "payments-execution": {
    key: "payments-execution",
    family: "payments",
    name: `atlas-${demoScenarioKey}-payments-execution`,
    title: "Payment execution",
    description: "Executes, retries, and reconciles payment attempts once Phase 4 turns the payment rail real.",
    ownerWorkspaces: ["BUYER", "SELLER", "OPERATOR"],
    nextPhase: "Phase 4",
    readiness: "baseline",
    defaultAttempts: 6,
    backoffDelayMs: 20000
  },
  "seller-webhooks-delivery": {
    key: "seller-webhooks-delivery",
    family: "seller-webhooks",
    name: `atlas-${demoScenarioKey}-seller-webhooks-delivery`,
    title: "Seller webhook delivery",
    description: "Handles seller-facing delivery callbacks, retries, and delivery evidence fanout.",
    ownerWorkspaces: ["SELLER", "OPERATOR"],
    nextPhase: "Phase 3",
    readiness: "baseline",
    defaultAttempts: 8,
    backoffDelayMs: 30000
  },
  "audit-projections-refresh": {
    key: "audit-projections-refresh",
    family: "audit-projections",
    name: `atlas-${demoScenarioKey}-audit-projections-refresh`,
    title: "Audit projection refresh",
    description: "Maintains timeline and analytics projections that later power operator, buyer, and seller activity views.",
    ownerWorkspaces: ["BUYER", "SELLER", "OPERATOR"],
    nextPhase: "Phase 5",
    readiness: "baseline",
    defaultAttempts: 4,
    backoffDelayMs: 10000
  }
};

export type AtlasApiDomainSnapshot = {
  key: AtlasApiDomainKey;
  title: string;
  description: string;
  routePrefix: string;
  ownerWorkspaces: OrganizationKind[];
  nextPhase: string;
  readiness: "skeleton" | "planned";
};

export type AtlasQueueSnapshot = {
  key: AtlasQueueKey;
  family: AtlasQueueFamilyKey;
  name: string;
  title: string;
  description: string;
  ownerWorkspaces: OrganizationKind[];
  nextPhase: string;
  readiness: "placeholder" | "baseline" | "planned";
  defaultAttempts: number;
  backoffDelayMs: number;
};

export function isOrganizationKind(value: string): value is OrganizationKind {
  return organizationKinds.includes(value as OrganizationKind);
}

export function isTerminalSpendRequestStatus(value: SpendRequestStatus) {
  return ["COMPLETED", "FAILED", "CANCELED", "REJECTED"].includes(value);
}

export function isKnownSpendRequestStatus(value: string): value is SpendRequestStatus {
  return spendRequestStatuses.includes(value as SpendRequestStatus);
}

export function listAtlasWorkspaceDefinitions() {
  return Object.values(atlasWorkspaceDefinitions);
}

export function getAtlasWorkspaceDefinition(workspace: OrganizationKind) {
  return atlasWorkspaceDefinitions[workspace];
}

export function listAtlasWorkspaceSurfaces(workspace: OrganizationKind) {
  return atlasWorkspaceDefinitions[workspace].surfaces;
}

export function getAtlasWorkspaceSurfaceByHref(workspace: OrganizationKind, href: string) {
  return atlasWorkspaceDefinitions[workspace].surfaces.find((surface) => surface.href === href) ?? null;
}

export function getAtlasWorkspaceSurfaceByKey(workspace: OrganizationKind, key: AtlasWorkspaceSurfaceKey) {
  return atlasWorkspaceDefinitions[workspace].surfaces.find((surface) => surface.key === key) ?? null;
}

export function listAtlasApiDomainDefinitions() {
  return Object.values(atlasApiDomainDefinitions);
}

export function getAtlasApiDomainDefinition(key: AtlasApiDomainKey) {
  return atlasApiDomainDefinitions[key];
}

export function listAtlasApiDomainDefinitionsForWorkspace(workspace: OrganizationKind) {
  return listAtlasApiDomainDefinitions().filter((definition) => definition.ownerWorkspaces.includes(workspace));
}

export function listAtlasQueueDefinitions() {
  return Object.values(atlasQueueDefinitions);
}

export function getAtlasQueueDefinition(key: AtlasQueueKey) {
  return atlasQueueDefinitions[key];
}

export function listAtlasQueueDefinitionsForWorkspace(workspace: OrganizationKind) {
  return listAtlasQueueDefinitions().filter((definition) => definition.ownerWorkspaces.includes(workspace));
}

export function listAtlasQueueDefinitionsForFamily(family: AtlasQueueFamilyKey) {
  return listAtlasQueueDefinitions().filter((definition) => definition.family === family);
}

export function createAtlasApiDomainSnapshot(
  key: AtlasApiDomainKey,
  options?: {
    actorRole?: MembershipRole;
    workspace?: OrganizationKind;
  }
): AtlasApiDomainSnapshot & {
  actorRole: MembershipRole | null;
  workspace: OrganizationKind | null;
} {
  const definition = getAtlasApiDomainDefinition(key);
  return {
    key: definition.key,
    title: definition.title,
    description: definition.description,
    routePrefix: definition.routePrefix,
    ownerWorkspaces: definition.ownerWorkspaces,
    nextPhase: definition.nextPhase,
    readiness: definition.readiness,
    actorRole: options?.actorRole ?? null,
    workspace: options?.workspace ?? null
  };
}

export function createAtlasQueueSnapshot(key: AtlasQueueKey): AtlasQueueSnapshot {
  const definition = getAtlasQueueDefinition(key);
  return {
    key: definition.key,
    family: definition.family,
    name: definition.name,
    title: definition.title,
    description: definition.description,
    ownerWorkspaces: definition.ownerWorkspaces,
    nextPhase: definition.nextPhase,
    readiness: definition.readiness,
    defaultAttempts: definition.defaultAttempts,
    backoffDelayMs: definition.backoffDelayMs
  };
}
