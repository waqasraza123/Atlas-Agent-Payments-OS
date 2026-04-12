"use server";

import { canAtlasActorMutate } from "@atlas/auth";
import {
  createBuyerAgent,
  createBuyerPolicy,
  createBuyerRequest,
  createOrganizationWallet,
  decideBuyerApproval,
  executeBuyerPayment,
  updateOrganizationProgrammableSettlementSettings,
  updateBuyerAgent,
  updateBuyerPolicy,
  AtlasBuyerWorkflowError,
  AtlasPaymentsWorkflowError,
  AtlasProgrammableSettlementError
} from "@atlas/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAtlasWorkspaceDetailHref } from "@/lib/detail-hrefs";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { buildWorkflowFeedbackHref, type WorkflowFeedbackTone } from "@/lib/workflow-feedback";

function toTextValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function toNullableTextValue(value: FormDataEntryValue | null) {
  const text = toTextValue(value);
  return text.length > 0 ? text : null;
}

function toIntegerValue(value: FormDataEntryValue | null) {
  const parsed = Number.parseInt(toTextValue(value), 10);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function toNullableIntegerValue(value: FormDataEntryValue | null) {
  const parsed = toIntegerValue(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function toBooleanValue(value: FormDataEntryValue | null) {
  return value === "on";
}

function redirectWithFeedback(path: string, title: string, description: string, tone: WorkflowFeedbackTone = "default"): never {
  redirect(buildWorkflowFeedbackHref(path, title, description, tone));
}

async function requireBuyerActor() {
  const resolution = await resolveWorkspaceActor("BUYER");

  if (resolution.status !== "ready") {
    redirectWithFeedback(
      "/buyer",
      "Buyer session required",
      "Switch to a seeded buyer session before submitting buyer workflow actions.",
      "warning"
    );
  }

  if (!canAtlasActorMutate(resolution.actor)) {
    redirectWithFeedback(
      "/buyer",
      "Buyer mutations blocked",
      "Support-access sessions are read-only and cannot submit buyer workflow changes.",
      "warning"
    );
  }

  return resolution.actor;
}

function normalizeActionError(error: unknown) {
  if (
    error instanceof AtlasBuyerWorkflowError ||
    error instanceof AtlasPaymentsWorkflowError ||
    error instanceof AtlasProgrammableSettlementError
  ) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Atlas could not complete the requested workflow action.";
}

export async function createBuyerAgentAction(formData: FormData) {
  const actor = await requireBuyerActor();

  try {
    await createBuyerAgent(actor, {
      name: toTextValue(formData.get("name")),
      externalRef: toNullableTextValue(formData.get("externalRef")),
      purpose: toTextValue(formData.get("purpose")),
      policyId: toNullableTextValue(formData.get("policyId")),
      status: toTextValue(formData.get("status")) || "DRAFT"
    });
    revalidatePath("/buyer");
    revalidatePath("/buyer/agents");
    redirectWithFeedback("/buyer/agents", "Agent created", "The buyer agent is now available for request routing.");
  } catch (error) {
    redirectWithFeedback("/buyer/agents", "Agent creation failed", normalizeActionError(error), "error");
  }
}

export async function updateBuyerAgentAction(agentId: string, formData: FormData) {
  const actor = await requireBuyerActor();

  try {
    await updateBuyerAgent(actor, agentId, {
      name: toTextValue(formData.get("name")),
      externalRef: toNullableTextValue(formData.get("externalRef")),
      purpose: toTextValue(formData.get("purpose")),
      policyId: toNullableTextValue(formData.get("policyId")),
      status: toTextValue(formData.get("status"))
    });
    revalidatePath("/buyer");
    revalidatePath("/buyer/agents");
    redirectWithFeedback("/buyer/agents", "Agent updated", "The buyer agent controls were updated successfully.");
  } catch (error) {
    redirectWithFeedback("/buyer/agents", "Agent update failed", normalizeActionError(error), "error");
  }
}

export async function createBuyerPolicyAction(formData: FormData) {
  const actor = await requireBuyerActor();

  try {
    await createBuyerPolicy(actor, {
      name: toTextValue(formData.get("name")),
      status: toTextValue(formData.get("status")) || "DRAFT",
      rules: {
        maxAmountMinor: toNullableIntegerValue(formData.get("maxAmountMinor")),
        autoApprovalThresholdMinor: toNullableIntegerValue(formData.get("autoApprovalThresholdMinor")),
        escalationThresholdMinor: toNullableIntegerValue(formData.get("escalationThresholdMinor")),
        sellerAllowlist: toTextValue(formData.get("sellerAllowlist"))
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        serviceAllowlist: toTextValue(formData.get("serviceAllowlist"))
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        serviceCategories: toTextValue(formData.get("serviceCategories"))
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        emergencyStop: toBooleanValue(formData.get("emergencyStop"))
      }
    });
    revalidatePath("/buyer");
    revalidatePath("/buyer/policies");
    redirectWithFeedback("/buyer/policies", "Policy created", "The buyer policy is now available for agent linking.");
  } catch (error) {
    redirectWithFeedback("/buyer/policies", "Policy creation failed", normalizeActionError(error), "error");
  }
}

export async function updateBuyerPolicyAction(policyId: string, formData: FormData) {
  const actor = await requireBuyerActor();

  try {
    await updateBuyerPolicy(actor, policyId, {
      name: toTextValue(formData.get("name")),
      status: toTextValue(formData.get("status")),
      rules: {
        maxAmountMinor: toNullableIntegerValue(formData.get("maxAmountMinor")),
        autoApprovalThresholdMinor: toNullableIntegerValue(formData.get("autoApprovalThresholdMinor")),
        escalationThresholdMinor: toNullableIntegerValue(formData.get("escalationThresholdMinor")),
        sellerAllowlist: toTextValue(formData.get("sellerAllowlist"))
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        serviceAllowlist: toTextValue(formData.get("serviceAllowlist"))
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        serviceCategories: toTextValue(formData.get("serviceCategories"))
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        emergencyStop: toBooleanValue(formData.get("emergencyStop"))
      }
    });
    revalidatePath("/buyer");
    revalidatePath("/buyer/policies");
    redirectWithFeedback("/buyer/policies", "Policy updated", "The policy rules and rollout posture were updated.");
  } catch (error) {
    redirectWithFeedback("/buyer/policies", "Policy update failed", normalizeActionError(error), "error");
  }
}

export async function createBuyerRequestAction(formData: FormData) {
  const actor = await requireBuyerActor();

  try {
    const request = await createBuyerRequest(actor, {
      agentId: toTextValue(formData.get("agentId")),
      policyId: toNullableTextValue(formData.get("policyId")),
      sellerOrganizationId: toNullableTextValue(formData.get("sellerOrganizationId")),
      title: toTextValue(formData.get("title")),
      purpose: toTextValue(formData.get("purpose")),
      amountMinor: toIntegerValue(formData.get("amountMinor")),
      currency: toTextValue(formData.get("currency")) || "USD",
      serviceCategory: toTextValue(formData.get("serviceCategory")),
      serviceKey: toNullableTextValue(formData.get("serviceKey")),
      idempotencyKey: toNullableTextValue(formData.get("idempotencyKey"))
    });
    revalidatePath("/buyer");
    revalidatePath("/buyer/requests");
    revalidatePath("/buyer/approvals");
    redirectWithFeedback(
      getAtlasWorkspaceDetailHref("BUYER", "requests", request.id) ?? "/buyer/requests",
      "Request submitted",
      "Atlas evaluated the request and recorded the next lifecycle state."
    );
  } catch (error) {
    redirectWithFeedback("/buyer/requests", "Request submission failed", normalizeActionError(error), "error");
  }
}

export async function decideBuyerApprovalAction(approvalId: string, formData: FormData) {
  const actor = await requireBuyerActor();

  try {
    const approval = await decideBuyerApproval(actor, approvalId, {
      decision: toTextValue(formData.get("decision")),
      decisionReason: toTextValue(formData.get("decisionReason"))
    });
    revalidatePath("/buyer");
    revalidatePath("/buyer/requests");
    revalidatePath("/buyer/approvals");
    redirectWithFeedback(
      getAtlasWorkspaceDetailHref("BUYER", "requests", approval.requestId) ?? "/buyer/requests",
      "Approval decision recorded",
      "The request lifecycle has advanced to its next state."
    );
  } catch (error) {
    redirectWithFeedback("/buyer/approvals", "Approval decision failed", normalizeActionError(error), "error");
  }
}

export async function executeBuyerPaymentAction(requestId: string, formData: FormData) {
  const actor = await requireBuyerActor();

  try {
    await executeBuyerPayment(actor, requestId, {
      rail: toTextValue(formData.get("rail")) || "INTERNAL_SIMULATED"
    });
    revalidatePath("/buyer");
    revalidatePath("/buyer/requests");
    revalidatePath("/seller");
    revalidatePath("/seller/requests");
    revalidatePath("/seller/payments");
    redirectWithFeedback(
      getAtlasWorkspaceDetailHref("BUYER", "requests", requestId) ?? "/buyer/requests",
      "Payment executed",
      "Atlas recorded a new immutable payment attempt and refreshed receipt truth from the latest lifecycle state.",
      "default"
    );
  } catch (error) {
    redirectWithFeedback(
      getAtlasWorkspaceDetailHref("BUYER", "requests", requestId) ?? "/buyer/requests",
      "Payment execution failed",
      normalizeActionError(error),
      "error"
    );
  }
}

export async function createBuyerProgrammableWalletAction(formData: FormData) {
  const actor = await requireBuyerActor();

  try {
    await createOrganizationWallet(actor, {
      label: toTextValue(formData.get("label")),
      address: toTextValue(formData.get("address")),
      ownershipLabel: toTextValue(formData.get("ownershipLabel")),
      chain: toTextValue(formData.get("chain")),
      isDefault: toBooleanValue(formData.get("isDefault"))
    });
    revalidatePath("/buyer");
    revalidatePath("/buyer/wallets");
    redirectWithFeedback(
      "/buyer/wallets",
      "Wallet registered",
      "The wallet entry is now part of the buyer programmable-settlement registry and awaits verification."
    );
  } catch (error) {
    redirectWithFeedback("/buyer/wallets", "Wallet registration failed", normalizeActionError(error), "error");
  }
}

export async function updateBuyerProgrammableSettlementSettingsAction(formData: FormData) {
  const actor = await requireBuyerActor();

  try {
    const allowedRails = [
      toBooleanValue(formData.get("allowInternalSimulated")) ? "INTERNAL_SIMULATED" : null,
      toBooleanValue(formData.get("allowStripe")) ? "STRIPE" : null,
      toBooleanValue(formData.get("allowProgrammableUsdc")) ? "PROGRAMMABLE_USDC" : null
    ].filter((value): value is "INTERNAL_SIMULATED" | "STRIPE" | "PROGRAMMABLE_USDC" => Boolean(value));

    await updateOrganizationProgrammableSettlementSettings(actor, {
      allowedRails,
      preferredRail: toNullableTextValue(formData.get("preferredRail"))
    });
    revalidatePath("/buyer");
    revalidatePath("/buyer/wallets");
    redirectWithFeedback(
      "/buyer/wallets",
      "Settlement settings updated",
      "Buyer rail governance now reflects the latest programmable-settlement policy."
    );
  } catch (error) {
    redirectWithFeedback("/buyer/wallets", "Settlement settings failed", normalizeActionError(error), "error");
  }
}
