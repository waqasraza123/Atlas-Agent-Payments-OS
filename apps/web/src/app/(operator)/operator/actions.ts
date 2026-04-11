"use server";

import { performOperatorCaseAction, AtlasOperatorWorkflowError } from "@atlas/database";
import { revalidatePath } from "next/cache";
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
