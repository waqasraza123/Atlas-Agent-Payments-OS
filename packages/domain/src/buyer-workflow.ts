import { z } from "zod";
import { approvalStatuses, spendRequestStatuses, type AgentStatus, type ApprovalStatus, type PolicyStatus, type SpendRequestStatus } from "@atlas/types";

const trimmedString = z.string().trim().min(1);

export const atlasBuyerPolicyRulesSchema = z.object({
  maxAmountMinor: z.number().int().positive().nullable().default(null),
  autoApprovalThresholdMinor: z.number().int().nonnegative().nullable().default(null),
  escalationThresholdMinor: z.number().int().nonnegative().nullable().default(null),
  sellerAllowlist: z.array(trimmedString).default([]),
  serviceAllowlist: z.array(trimmedString).default([]),
  serviceCategories: z.array(trimmedString).default([]),
  emergencyStop: z.boolean().default(false)
});

export type AtlasBuyerPolicyRules = z.infer<typeof atlasBuyerPolicyRulesSchema>;

export const atlasBuyerAgentCreateSchema = z.object({
  name: trimmedString.min(3).max(80),
  externalRef: z.string().trim().max(80).optional().nullable(),
  purpose: z.string().trim().min(8).max(280),
  policyId: z.string().trim().min(1).optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "DISABLED"]).default("DRAFT")
});

export const atlasBuyerAgentUpdateSchema = z.object({
  name: z.string().trim().min(3).max(80).optional(),
  externalRef: z.string().trim().max(80).optional().nullable(),
  purpose: z.string().trim().min(8).max(280).optional(),
  policyId: z.string().trim().min(1).optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "DISABLED"]).optional()
});

export type AtlasBuyerAgentCreateInput = z.infer<typeof atlasBuyerAgentCreateSchema>;
export type AtlasBuyerAgentUpdateInput = z.infer<typeof atlasBuyerAgentUpdateSchema>;

export const atlasBuyerPolicyCreateSchema = z.object({
  name: trimmedString.min(3).max(80),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
  rules: atlasBuyerPolicyRulesSchema
});

export const atlasBuyerPolicyUpdateSchema = z.object({
  name: z.string().trim().min(3).max(80).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  rules: atlasBuyerPolicyRulesSchema.optional()
});

export type AtlasBuyerPolicyCreateInput = z.infer<typeof atlasBuyerPolicyCreateSchema>;
export type AtlasBuyerPolicyUpdateInput = z.infer<typeof atlasBuyerPolicyUpdateSchema>;

export const atlasBuyerRequestCreateSchema = z.object({
  agentId: trimmedString,
  policyId: z.string().trim().min(1).optional().nullable(),
  sellerOrganizationId: z.string().trim().min(1).optional().nullable(),
  title: trimmedString.min(3).max(120),
  purpose: z.string().trim().min(12).max(400),
  amountMinor: z.number().int().positive().max(10_000_000),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  serviceCategory: trimmedString.min(2).max(80),
  serviceKey: z.string().trim().min(2).max(120).optional().nullable(),
  idempotencyKey: z.string().trim().min(8).max(120).optional().nullable()
});

export type AtlasBuyerRequestCreateInput = z.infer<typeof atlasBuyerRequestCreateSchema>;

export const atlasBuyerApprovalDecisionSchema = z.object({
  decision: z.enum(["approve", "deny"]),
  decisionReason: z.string().trim().min(8).max(280)
});

export type AtlasBuyerApprovalDecisionInput = z.infer<typeof atlasBuyerApprovalDecisionSchema>;

export type AtlasPolicyEvaluationOutcome =
  | "allow_auto_approved"
  | "allow_requires_approval"
  | "deny_amount_exceeded"
  | "deny_seller_not_allowed"
  | "deny_service_not_allowed"
  | "deny_service_category_not_allowed"
  | "deny_emergency_stop"
  | "deny_agent_inactive";

export const atlasPolicyEvaluationOutcomeSchema = z.enum([
  "allow_auto_approved",
  "allow_requires_approval",
  "deny_amount_exceeded",
  "deny_seller_not_allowed",
  "deny_service_not_allowed",
  "deny_service_category_not_allowed",
  "deny_emergency_stop",
  "deny_agent_inactive"
]);

export const atlasPolicyEvaluationResultSchema = z.object({
  outcome: atlasPolicyEvaluationOutcomeSchema,
  status: z.enum(spendRequestStatuses),
  approvalStatus: z.enum(approvalStatuses).nullable(),
  matchedPolicyId: z.string().trim().min(1).nullable(),
  matchedPolicyVersion: z.number().int().positive().nullable(),
  reasons: z.array(trimmedString).default([]),
  requiresApproval: z.boolean(),
  autoApproved: z.boolean()
});

export type AtlasPolicyEvaluationResult = z.infer<typeof atlasPolicyEvaluationResultSchema>;

export function parseAtlasPolicyEvaluationResult(value: unknown) {
  const parsed = atlasPolicyEvaluationResultSchema.safeParse(value);

  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export function formatAtlasPolicyEvaluationOutcomeLabel(value: AtlasPolicyEvaluationOutcome) {
  return value
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

export function summarizeAtlasPolicyEvaluation(result: AtlasPolicyEvaluationResult) {
  return result.reasons[0] ?? formatAtlasPolicyEvaluationOutcomeLabel(result.outcome);
}

export type AtlasPolicyEvaluationInput = {
  agentStatus: AgentStatus;
  amountMinor: number;
  sellerOrganizationId: string | null;
  serviceCategory: string;
  serviceKey: string | null;
  policyId: string | null;
  policyVersion: number | null;
  rules: AtlasBuyerPolicyRules;
};

export function createAtlasPolicyEvaluationResult(input: AtlasPolicyEvaluationResult): AtlasPolicyEvaluationResult {
  return atlasPolicyEvaluationResultSchema.parse(input);
}

function normalizeTextList(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

export function normalizeAtlasBuyerPolicyRules(input: AtlasBuyerPolicyRules): AtlasBuyerPolicyRules {
  return {
    maxAmountMinor: input.maxAmountMinor ?? null,
    autoApprovalThresholdMinor: input.autoApprovalThresholdMinor ?? null,
    escalationThresholdMinor: input.escalationThresholdMinor ?? null,
    sellerAllowlist: normalizeTextList(input.sellerAllowlist),
    serviceAllowlist: normalizeTextList(input.serviceAllowlist),
    serviceCategories: normalizeTextList(input.serviceCategories),
    emergencyStop: input.emergencyStop
  };
}

export function evaluateAtlasBuyerSpendRequest(input: AtlasPolicyEvaluationInput): AtlasPolicyEvaluationResult {
  const rules = normalizeAtlasBuyerPolicyRules(input.rules);
  const maxAmountMinor = rules.maxAmountMinor ?? null;
  const autoApprovalThresholdMinor = rules.autoApprovalThresholdMinor ?? null;

  if (rules.emergencyStop) {
    return createAtlasPolicyEvaluationResult({
      outcome: "deny_emergency_stop",
      status: "REJECTED",
      approvalStatus: null,
      matchedPolicyId: input.policyId,
      matchedPolicyVersion: input.policyVersion,
      reasons: ["The matched policy currently has an emergency stop enabled."],
      requiresApproval: false,
      autoApproved: false
    });
  }

  if (input.agentStatus !== "ACTIVE") {
    return createAtlasPolicyEvaluationResult({
      outcome: "deny_agent_inactive",
      status: "REJECTED",
      approvalStatus: null,
      matchedPolicyId: input.policyId,
      matchedPolicyVersion: input.policyVersion,
      reasons: ["The selected agent is not active and cannot create spend requests."],
      requiresApproval: false,
      autoApproved: false
    });
  }

  if (maxAmountMinor !== null && input.amountMinor > maxAmountMinor) {
    return createAtlasPolicyEvaluationResult({
      outcome: "deny_amount_exceeded",
      status: "REJECTED",
      approvalStatus: null,
      matchedPolicyId: input.policyId,
      matchedPolicyVersion: input.policyVersion,
      reasons: [`The request amount exceeds the per-action maximum of ${maxAmountMinor} minor units.`],
      requiresApproval: false,
      autoApproved: false
    });
  }

  if (rules.sellerAllowlist.length > 0) {
    if (!input.sellerOrganizationId || !rules.sellerAllowlist.includes(input.sellerOrganizationId)) {
      return createAtlasPolicyEvaluationResult({
        outcome: "deny_seller_not_allowed",
        status: "REJECTED",
        approvalStatus: null,
        matchedPolicyId: input.policyId,
        matchedPolicyVersion: input.policyVersion,
        reasons: ["The selected seller is not in the policy allowlist."],
        requiresApproval: false,
        autoApproved: false
      });
    }
  }

  if (rules.serviceAllowlist.length > 0) {
    if (!input.serviceKey || !rules.serviceAllowlist.includes(input.serviceKey)) {
      return createAtlasPolicyEvaluationResult({
        outcome: "deny_service_not_allowed",
        status: "REJECTED",
        approvalStatus: null,
        matchedPolicyId: input.policyId,
        matchedPolicyVersion: input.policyVersion,
        reasons: ["The selected service key is not in the policy allowlist."],
        requiresApproval: false,
        autoApproved: false
      });
    }
  }

  if (rules.serviceCategories.length > 0 && !rules.serviceCategories.includes(input.serviceCategory)) {
    return createAtlasPolicyEvaluationResult({
      outcome: "deny_service_category_not_allowed",
      status: "REJECTED",
      approvalStatus: null,
      matchedPolicyId: input.policyId,
      matchedPolicyVersion: input.policyVersion,
      reasons: ["The selected service category is not allowed by the policy."],
      requiresApproval: false,
      autoApproved: false
    });
  }

  if (autoApprovalThresholdMinor !== null && input.amountMinor <= autoApprovalThresholdMinor) {
    return createAtlasPolicyEvaluationResult({
      outcome: "allow_auto_approved",
      status: "APPROVED",
      approvalStatus: "APPROVED",
      matchedPolicyId: input.policyId,
      matchedPolicyVersion: input.policyVersion,
      reasons: ["The request amount is within the policy auto-approval threshold."],
      requiresApproval: false,
      autoApproved: true
    });
  }

  return createAtlasPolicyEvaluationResult({
    outcome: "allow_requires_approval",
    status: "SUBMITTED",
    approvalStatus: "PENDING",
    matchedPolicyId: input.policyId,
    matchedPolicyVersion: input.policyVersion,
    reasons: ["The request is allowed but requires a human approval before execution."],
    requiresApproval: true,
    autoApproved: false
  });
}

export function formatAtlasPolicyStatusLabel(status: PolicyStatus) {
  return status.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\w/g, (character) => character.toUpperCase());
}
