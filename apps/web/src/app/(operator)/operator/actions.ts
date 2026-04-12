"use server";

import {
  atlasLocalSessionCookieName,
  createAtlasSupportAccessRecord,
  type AtlasSupportAccessTargetWorkspace
} from "@atlas/auth";
import { createAtlasSupportSessionToken } from "@atlas/auth/server";
import { appRuntime, authRuntime } from "@atlas/config";
import { performOperatorCaseAction, AtlasOperatorWorkflowError } from "@atlas/database";
import { prisma } from "@atlas/database";
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
  if (error instanceof AtlasOperatorWorkflowError) {
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
    redirectWithFeedback(
      "/operator/support-access",
      "Support scope rejected",
      "Support-access session issuance remains disabled in production until a real auth provider replaces local operator identities.",
      "error"
    );
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

  const targetOrganization = await prisma.organization.findFirst({
    where: {
      slug: targetOrganizationSlug,
      kind: targetWorkspace
    }
  });

  if (!targetOrganization) {
    redirectWithFeedback(
      "/operator/support-access",
      "Support scope rejected",
      "The selected target organization could not be resolved for that workspace.",
      "error"
    );
  }

  const supportAccess = createAtlasSupportAccessRecord({
    targetOrganizationSlug: targetOrganization.slug,
    targetWorkspace,
    reason,
    grantedByUserEmail: actor.user.email
  });
  const expiresAt = new Date(Date.now() + authRuntime.supportAccessTtlMinutes * 60 * 1000).toISOString();
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
      expiresAt
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
    targetWorkspace === "BUYER" ? "/buyer" : "/seller",
    "Support session issued",
    `Atlas entered read-only support mode for ${targetOrganization.name}.`
  );
}
