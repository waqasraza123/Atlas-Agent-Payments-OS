import { describe, expect, it } from "vitest";
import {
  atlasBuyerAgentCreateSchema,
  atlasBuyerPolicyCreateSchema,
  atlasBuyerRequestCreateSchema,
  evaluateAtlasBuyerSpendRequest,
  normalizeAtlasBuyerPolicyRules,
  parseAtlasPolicyEvaluationResult,
  summarizeAtlasPolicyEvaluation
} from "./buyer-workflow";

describe("atlas buyer workflow contracts", () => {
  it("normalizes policy rules and preserves empty lists", () => {
    const rules = normalizeAtlasBuyerPolicyRules({
      maxAmountMinor: 2500,
      autoApprovalThresholdMinor: null,
      escalationThresholdMinor: null,
      sellerAllowlist: [" seller-a ", ""],
      serviceAllowlist: [],
      serviceCategories: ["api-access"],
      emergencyStop: false
    });

    expect(rules).toMatchObject({
      maxAmountMinor: 2500,
      sellerAllowlist: ["seller-a"],
      serviceCategories: ["api-access"]
    });
  });

  it("validates buyer create payloads", () => {
    expect(() =>
      atlasBuyerAgentCreateSchema.parse({
        name: "Agent",
        purpose: "Handle premium dataset purchases for research.",
        status: "ACTIVE"
      })
    ).not.toThrow();

    expect(() =>
      atlasBuyerPolicyCreateSchema.parse({
        name: "Policy",
        rules: {
          maxAmountMinor: 5000,
          sellerAllowlist: ["seller-a"]
        }
      })
    ).not.toThrow();

    expect(() =>
      atlasBuyerRequestCreateSchema.parse({
        agentId: "agent-1",
        title: "Dataset access",
        purpose: "Acquire a paid dataset for the buyer research task.",
        amountMinor: 1200,
        currency: "usd",
        serviceCategory: "api-access"
      })
    ).not.toThrow();
  });

  it("auto-approves requests within threshold", () => {
    const evaluation = evaluateAtlasBuyerSpendRequest({
      agentStatus: "ACTIVE",
      amountMinor: 1200,
      sellerOrganizationId: "seller-a",
      serviceCategory: "api-access",
      serviceKey: "dataset-basic",
      policyId: "policy-1",
      policyVersion: 1,
      rules: {
        maxAmountMinor: 5000,
        autoApprovalThresholdMinor: 1500,
        escalationThresholdMinor: null,
        sellerAllowlist: ["seller-a"],
        serviceAllowlist: ["dataset-basic"],
        serviceCategories: ["api-access"],
        emergencyStop: false
      }
    });

    expect(evaluation.outcome).toBe("allow_auto_approved");
    expect(evaluation.status).toBe("APPROVED");
    expect(evaluation.approvalStatus).toBe("APPROVED");
  });

  it("requires approval above the threshold but within policy bounds", () => {
    const evaluation = evaluateAtlasBuyerSpendRequest({
      agentStatus: "ACTIVE",
      amountMinor: 2600,
      sellerOrganizationId: "seller-a",
      serviceCategory: "api-access",
      serviceKey: "dataset-basic",
      policyId: "policy-1",
      policyVersion: 1,
      rules: {
        maxAmountMinor: 5000,
        autoApprovalThresholdMinor: 1500,
        escalationThresholdMinor: 4000,
        sellerAllowlist: ["seller-a"],
        serviceAllowlist: ["dataset-basic"],
        serviceCategories: ["api-access"],
        emergencyStop: false
      }
    });

    expect(evaluation.outcome).toBe("allow_requires_approval");
    expect(evaluation.approvalStatus).toBe("PENDING");
  });

  it("rejects requests outside seller allowlists and inactive agents", () => {
    const sellerDenied = evaluateAtlasBuyerSpendRequest({
      agentStatus: "ACTIVE",
      amountMinor: 800,
      sellerOrganizationId: "seller-b",
      serviceCategory: "api-access",
      serviceKey: null,
      policyId: "policy-1",
      policyVersion: 1,
      rules: {
        maxAmountMinor: 5000,
        autoApprovalThresholdMinor: 1500,
        escalationThresholdMinor: null,
        sellerAllowlist: ["seller-a"],
        serviceAllowlist: [],
        serviceCategories: [],
        emergencyStop: false
      }
    });
    const inactiveDenied = evaluateAtlasBuyerSpendRequest({
      agentStatus: "PAUSED",
      amountMinor: 800,
      sellerOrganizationId: "seller-a",
      serviceCategory: "api-access",
      serviceKey: null,
      policyId: "policy-1",
      policyVersion: 1,
      rules: {
        maxAmountMinor: 5000,
        autoApprovalThresholdMinor: null,
        escalationThresholdMinor: null,
        sellerAllowlist: [],
        serviceAllowlist: [],
        serviceCategories: [],
        emergencyStop: false
      }
    });

    expect(sellerDenied.outcome).toBe("deny_seller_not_allowed");
    expect(inactiveDenied.outcome).toBe("deny_agent_inactive");
  });

  it("parses persisted policy evaluation results and summarizes reasons", () => {
    const parsed = parseAtlasPolicyEvaluationResult({
      outcome: "allow_requires_approval",
      status: "SUBMITTED",
      approvalStatus: "PENDING",
      matchedPolicyId: "policy-1",
      matchedPolicyVersion: 3,
      reasons: ["The request is allowed but requires a human approval before execution."],
      requiresApproval: true,
      autoApproved: false
    });

    expect(parsed?.matchedPolicyVersion).toBe(3);
    expect(parsed ? summarizeAtlasPolicyEvaluation(parsed) : null).toBe(
      "The request is allowed but requires a human approval before execution."
    );
    expect(parseAtlasPolicyEvaluationResult({ outcome: "unknown" })).toBeNull();
  });
});
