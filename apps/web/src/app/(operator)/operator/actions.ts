"use server";

import {
  atlasLocalSessionCookieName,
  createAtlasSupportAccessRecord,
  type AtlasSupportAccessTargetWorkspace
} from "@atlas/auth";
import { createAtlasSupportSessionToken } from "@atlas/auth/server";
import { appRuntime, authRuntime } from "@atlas/config";
import {
  activateSupportAccessGrant,
  createSupportAccessReviewCampaign,
  performOperatorCaseAction,
  revokeIdentityProviderSession,
  issueSupportAccessGrant,
  recertifySupportAccessGrant,
  resolveSupportAccessReviewCampaignItem,
  reviewSupportAccessGrant,
  revokeSupportAccessGrant,
  AtlasOperatorWorkflowError,
  AtlasSupportAccessWorkflowError
} from "@atlas/database";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { buildWorkflowFeedbackHref, type WorkflowFeedbackTone } from "@/lib/workflow-feedback";

function toTextValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function redirectWithFeedback(path: string, title: string, description: string, tone: WorkflowFeedbackTone = "default"): never {
  redirect(buildWorkflowFeedbackHref(path, title, description, tone));
}

async function requireOperatorActor() {
  const resolution = await resolveWorkspaceActor("OPERATOR");

  if (resolution.status !== "ready") {
    redirectWithFeedback(
      "/operator",
      "Operator session required",
      "Switch to a seeded operator session before performing platform actions.",
      "warning"
    );
  }

  return resolution.actor;
}

function normalizeActionError(error: unknown) {
  if (error instanceof AtlasOperatorWorkflowError || error instanceof AtlasSupportAccessWorkflowError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Atlas could not complete the requested operator action.";
}

function isSupportTargetWorkspace(value: string): value is AtlasSupportAccessTargetWorkspace {
  return value === "BUYER" || value === "SELLER";
}

export async function performOperatorCaseActionAction(caseId: string, formData: FormData) {
  const actor = await requireOperatorActor();

  try {
    await performOperatorCaseAction(actor, caseId, {
      actionType: toTextValue(formData.get("actionType")),
      reason: toTextValue(formData.get("reason"))
    });
    revalidatePath("/operator");
    revalidatePath("/operator/exceptions");
    revalidatePath(`/operator/exceptions/${caseId}`);
    revalidatePath("/operator/audit");
    revalidatePath("/buyer");
    revalidatePath("/buyer/requests");
    revalidatePath("/seller");
    revalidatePath("/seller/requests");
    redirectWithFeedback(
      `/operator/exceptions/${caseId}`,
      "Operator action recorded",
      "Atlas captured the action, refreshed the exception case, and updated the investigation trail."
    );
  } catch (error) {
    redirectWithFeedback(
      `/operator/exceptions/${caseId}`,
      "Operator action failed",
      normalizeActionError(error),
      "error"
    );
  }
}

export async function createSupportAccessSessionAction(formData: FormData) {
  const actor = await requireOperatorActor();
  const grantId = toTextValue(formData.get("grantId"));

  if (grantId) {
    let grant;

    try {
      grant = await activateSupportAccessGrant(actor, grantId);
    } catch (error) {
      redirectWithFeedback("/operator/support-access", "Support scope rejected", normalizeActionError(error), "error");
    }

    const supportAccess = createAtlasSupportAccessRecord({
      grantId: grant.id,
      targetOrganizationSlug: grant.targetOrganizationSlug,
      targetWorkspace: grant.targetWorkspace,
      reason: grant.reason,
      grantedByUserEmail: actor.user.email
    });
    const token = createAtlasSupportSessionToken(
      authRuntime.sessionSigningSecret,
      {
        profileKey: actor.membership.role === "ADMIN" ? "operator-admin" : "operator-operator",
        workspace: "OPERATOR",
        userEmail: actor.user.email,
        organizationSlug: actor.organization.slug,
        role: actor.membership.role,
        agentId: null
      },
      supportAccess,
      {
        expiresAt: grant.expiresAt
      }
    );

    const cookieStore = await cookies();
    cookieStore.set(atlasLocalSessionCookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: appRuntime.appEnv !== "local",
      maxAge: authRuntime.supportAccessTtlMinutes * 60,
      path: "/"
    });

    redirectWithFeedback(
      grant.targetWorkspace === "BUYER" ? "/buyer" : "/seller",
      "Support session issued",
      `Atlas entered read-only support mode for ${grant.targetOrganizationName}.`
    );
  }

  const targetOrganizationSlug = toTextValue(formData.get("targetOrganizationSlug"));
  const targetWorkspace = toTextValue(formData.get("targetWorkspace"));
  const reason = toTextValue(formData.get("reason"));

  if (!isSupportTargetWorkspace(targetWorkspace)) {
    redirectWithFeedback(
      "/operator/support-access",
      "Support scope rejected",
      "Select a buyer or seller workspace before issuing a support-access session.",
      "warning"
    );
  }

  if (appRuntime.appEnv === "production") {
    if (authRuntime.providerMode !== "identity-bridge" && authRuntime.providerMode !== "external-oidc") {
      redirectWithFeedback(
        "/operator/support-access",
        "Support scope rejected",
        "Production support-access issuance requires an external or bridged identity-provider mode so operator identity is not derived from local session profiles.",
        "error"
      );
    }
  }

  if (reason.length < 12) {
    redirectWithFeedback(
      "/operator/support-access",
      "Support scope rejected",
      "Provide a concrete support reason with enough detail for later audit review.",
      "warning"
    );
  }

  if (
    authRuntime.supportAccessAllowedEmails.length > 0 &&
    !authRuntime.supportAccessAllowedEmails.includes(actor.user.email.toLowerCase())
  ) {
    redirectWithFeedback(
      "/operator/support-access",
      "Support scope rejected",
      "This operator identity is not allowed to issue support-access sessions in the current environment.",
      "error"
    );
  }

  const expiresAt = new Date(Date.now() + authRuntime.supportAccessTtlMinutes * 60 * 1000).toISOString();

  try {
    const grant = await issueSupportAccessGrant(actor, {
      targetOrganizationSlug,
      targetWorkspace,
      reason,
      expiresAt
    });

    revalidatePath("/operator/support-access");
    redirectWithFeedback(
      "/operator/support-access",
      "Support scope requested",
      `Atlas recorded the request for ${grant.targetOrganizationName} and is waiting for operator review.`
    );
  } catch (error) {
    redirectWithFeedback("/operator/support-access", "Support scope rejected", normalizeActionError(error), "error");
  }
}

export async function reviewSupportAccessGrantAction(grantId: string, formData: FormData) {
  const actor = await requireOperatorActor();

  try {
    const grant = await reviewSupportAccessGrant(actor, grantId, {
      decision: toTextValue(formData.get("decision")) === "REJECTED" ? "REJECTED" : "APPROVED",
      reviewReason: toTextValue(formData.get("reviewReason"))
    });
    revalidatePath("/operator/support-access");
    redirectWithFeedback(
      "/operator/support-access",
      "Support review recorded",
      `Atlas updated ${grant.targetOrganizationName} to ${grant.status.toLowerCase().replaceAll("_", " ")}.`
    );
  } catch (error) {
    redirectWithFeedback("/operator/support-access", "Support review failed", normalizeActionError(error), "error");
  }
}

export async function revokeSupportAccessGrantAction(grantId: string, formData: FormData) {
  const actor = await requireOperatorActor();

  try {
    const grant = await revokeSupportAccessGrant(actor, grantId, {
      revokeReason: toTextValue(formData.get("revokeReason"))
    });
    revalidatePath("/operator/support-access");
    redirectWithFeedback(
      "/operator/support-access",
      "Support grant revoked",
      `Atlas revoked support scope for ${grant.targetOrganizationName}.`
    );
  } catch (error) {
    redirectWithFeedback("/operator/support-access", "Support revoke failed", normalizeActionError(error), "error");
  }
}

export async function recertifySupportAccessGrantAction(grantId: string, formData: FormData) {
  const actor = await requireOperatorActor();

  try {
    const grant = await recertifySupportAccessGrant(actor, grantId, {
      reviewReason: toTextValue(formData.get("reviewReason"))
    });
    revalidatePath("/operator/support-access");
    redirectWithFeedback(
      "/operator/support-access",
      "Support grant recertified",
      `Atlas extended review coverage for ${grant.targetOrganizationName}.`
    );
  } catch (error) {
    redirectWithFeedback("/operator/support-access", "Support recertification failed", normalizeActionError(error), "error");
  }
}

export async function createSupportAccessReviewCampaignAction(formData: FormData) {
  const actor = await requireOperatorActor();

  try {
    const campaign = await createSupportAccessReviewCampaign(actor, {
      title: toTextValue(formData.get("title")),
      reason: toTextValue(formData.get("reason"))
    });
    revalidatePath("/operator/support-access");
    redirectWithFeedback(
      "/operator/support-access",
      "Access review campaign created",
      `Atlas opened ${campaign.pendingItemCount} review items for operator follow-up.`
    );
  } catch (error) {
    redirectWithFeedback("/operator/support-access", "Access review campaign failed", normalizeActionError(error), "error");
  }
}

export async function resolveSupportAccessReviewCampaignItemAction(
  campaignId: string,
  itemId: string,
  formData: FormData
) {
  const actor = await requireOperatorActor();

  try {
    const result = await resolveSupportAccessReviewCampaignItem(actor, campaignId, itemId, {
      action: toTextValue(formData.get("action")) === "REVOKE" ? "REVOKE" : "RECERTIFY",
      reason: toTextValue(formData.get("reason"))
    });
    revalidatePath("/operator/support-access");
    redirectWithFeedback(
      "/operator/support-access",
      "Campaign item resolved",
      `Atlas updated ${result.targetOrganizationName} to ${result.itemStatus.toLowerCase()}.`
    );
  } catch (error) {
    redirectWithFeedback("/operator/support-access", "Campaign action failed", normalizeActionError(error), "error");
  }
}

export async function revokeIdentityProviderSessionAction(sessionId: string, formData: FormData) {
  const actor = await requireOperatorActor();

  try {
    const session = await revokeIdentityProviderSession(actor, sessionId, {
      reason: toTextValue(formData.get("reason"))
    });
    revalidatePath("/operator/support-access");
    redirectWithFeedback(
      "/operator/support-access",
      "Identity session revoked",
      `Atlas revoked ${session.userEmail} for ${session.organizationName}.`
    );
  } catch (error) {
    redirectWithFeedback("/operator/support-access", "Identity session revoke failed", normalizeActionError(error), "error");
  }
}
