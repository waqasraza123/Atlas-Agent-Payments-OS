"use server";

import {
  atlasLocalSessionCookieName,
  createAtlasSupportAccessRecord,
  type AtlasActorContext,
  type AtlasSupportAccessTargetWorkspace
} from "@atlas/auth";
import { createAtlasSupportSessionToken } from "@atlas/auth/server";
import { appRuntime, authRuntime } from "@atlas/config";
import {
  createAtlasPromotionBundle,
  dispatchObservabilityAlerts,
  executeObservabilityAutomation,
  executeAtlasUpstreamIdentityLifecycle,
  executeAtlasPromotionAutomation,
  executeAtlasRestoreDrill,
  executeAtlasSecretRotation,
  findLatestAtlasRestoreDrillReport,
  findLatestAtlasSecretRotationExecutionReport,
  recoverObservabilityTelemetryOwnership,
  activateSupportAccessGrant,
  createSupportAccessReviewCampaign,
  parseAtlasEnvFile,
  provisionExternalIdentityAssignment,
  performOperatorCaseAction,
  registerOperationalIntegration,
  assertAtlasOperatorSessionGovernance,
  updateIdentityProviderLinkLifecycle,
  updateOperationalIntegrationLifecycle,
  updateOperationalIntegrationVerification,
  updateExternalIdentityAssignmentLifecycle,
  revokeIdentityProviderSession,
  issueSupportAccessGrant,
  persistObservabilitySnapshot,
  recertifySupportAccessGrant,
  resolveSupportAccessReviewCampaignItem,
  reviewSupportAccessGrant,
  revokeSupportAccessGrant,
  AtlasOperationalIntegrationWorkflowError,
  AtlasObservabilityOperationsError,
  AtlasOperatorWorkflowError,
  AtlasRolloutAutomationError,
  AtlasSupportAccessWorkflowError
} from "@atlas/database";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { loadOperatorObservabilityData } from "@/lib/server/operator-observability";
import { createAtlasStandaloneTraceContext } from "@/lib/server/request-trace";
import { buildWorkflowFeedbackHref, type WorkflowFeedbackTone } from "@/lib/workflow-feedback";

function toTextValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function assertOperatorGovernanceActor(actor: AtlasActorContext, surface: string) {
  assertAtlasOperatorSessionGovernance(actor, {
    surface,
    createError: (message) => new Error(message)
  });
}

function redirectWithFeedback(path: string, title: string, description: string, tone: WorkflowFeedbackTone = "default"): never {
  redirect(buildWorkflowFeedbackHref(path, title, description, tone));
}

async function requireOperatorResolution(surface = "Operator governance actions") {
  const resolution = await resolveWorkspaceActor("OPERATOR");

  if (resolution.status !== "ready") {
    redirectWithFeedback(
      "/operator",
      "Operator session required",
      "Switch to a seeded operator session before performing platform actions.",
      "warning"
    );
  }

  assertOperatorGovernanceActor(resolution.actor, surface);

  return resolution;
}

async function requireOperatorActor(surface = "Operator governance actions") {
  const resolution = await requireOperatorResolution(surface);
  return resolution.actor;
}

function normalizeActionError(error: unknown) {
  if (
    error instanceof AtlasOperationalIntegrationWorkflowError ||
    error instanceof AtlasObservabilityOperationsError ||
    error instanceof AtlasOperatorWorkflowError ||
    error instanceof AtlasSupportAccessWorkflowError ||
    error instanceof AtlasRolloutAutomationError
  ) {
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

function toBooleanValue(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function toCommaSeparatedValues(value: FormDataEntryValue | null) {
  return typeof value === "string"
    ? value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : [];
}

function toPromotionServices(value: FormDataEntryValue | null) {
  const values = toCommaSeparatedValues(value);

  if (values.length === 0 || values.includes("all")) {
    return ["api", "web", "worker"] as const;
  }

  return values.filter((entry): entry is "api" | "web" | "worker" => entry === "api" || entry === "web" || entry === "worker");
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

export async function captureObservabilitySnapshotAction(formData: FormData) {
  const resolution = await requireOperatorResolution();

  try {
    const observability = await loadOperatorObservabilityData(resolution.actor, resolution.selection);

    if (!observability.metrics || !observability.incidentReadiness) {
      redirectWithFeedback(
        "/operator/alerts",
        "Telemetry snapshot failed",
        "Atlas could not load observability data for retention.",
        "error"
      );
    }

    await persistObservabilitySnapshot({
      actor: resolution.actor,
      metrics: observability.metrics,
      alerts: observability.alerts,
      incidentReadiness: observability.incidentReadiness,
      reason: toTextValue(formData.get("reason"))
    });
    revalidatePath("/operator/alerts");
    redirectWithFeedback(
      "/operator/alerts",
      "Telemetry snapshot stored",
      "Atlas retained the current observability posture for later incident review."
    );
  } catch (error) {
    redirectWithFeedback("/operator/alerts", "Telemetry snapshot failed", normalizeActionError(error), "error");
  }
}

export async function dispatchObservabilityAlertsAction(formData: FormData) {
  const resolution = await requireOperatorResolution();
  const minimumSeverity = toTextValue(formData.get("minimumSeverity"));

  try {
    const observability = await loadOperatorObservabilityData(resolution.actor, resolution.selection);

    if (!observability.metrics || !observability.incidentReadiness) {
      redirectWithFeedback(
        "/operator/alerts",
        "Alert dispatch failed",
        "Atlas could not load observability data for dispatch.",
        "error"
      );
    }

    const dispatch = await dispatchObservabilityAlerts({
      actor: resolution.actor,
      minimumSeverity:
        minimumSeverity === "critical" || minimumSeverity === "warning" ? minimumSeverity : "info",
      reason: toTextValue(formData.get("reason")),
      alerts: observability.alerts,
      metrics: observability.metrics,
      incidentReadiness: observability.incidentReadiness,
      trace: createAtlasStandaloneTraceContext("web")
    });
    revalidatePath("/operator/alerts");
    revalidatePath("/operator/rollout");
    redirectWithFeedback(
      "/operator/alerts",
      "Alert dispatch recorded",
      `Atlas recorded ${dispatch.dispatchedAlertCount} dispatched alerts through ${dispatch.provider}.`
    );
  } catch (error) {
    redirectWithFeedback("/operator/alerts", "Alert dispatch failed", normalizeActionError(error), "error");
  }
}

export async function runObservabilityAutomationAction(formData: FormData) {
  const actor = await requireOperatorActor();
  const minimumSeverity = toTextValue(formData.get("minimumSeverity"));

  try {
    const result = await executeObservabilityAutomation({
      actorUserEmail: actor.user.email,
      reason: toTextValue(formData.get("reason")),
      minimumSeverity:
        minimumSeverity === "critical" || minimumSeverity === "warning" ? minimumSeverity : "info",
      dispatchAlerts: toBooleanValue(formData.get("dispatchAlerts")),
      triggerIncidents: toBooleanValue(formData.get("triggerIncidents")),
      trace: createAtlasStandaloneTraceContext("web")
    });
    revalidatePath("/operator/alerts");
    revalidatePath("/operator/rollout");
    redirectWithFeedback(
      "/operator/alerts",
      "Observability automation completed",
      result.dispatch
        ? `Atlas captured telemetry, ${result.incidentTriggers ? `synced ${result.incidentTriggers.activeCount} active incidents, ` : ""}and dispatched ${result.dispatch.dispatchedAlertCount} alerts automatically.`
        : result.incidentTriggers
          ? `Atlas captured telemetry and synced ${result.incidentTriggers.activeCount} active incidents without external dispatch.`
          : "Atlas captured telemetry without external dispatch or incident syncing."
    );
  } catch (error) {
    redirectWithFeedback("/operator/alerts", "Observability automation failed", normalizeActionError(error), "error");
  }
}

export async function recoverTelemetryOwnershipAction(formData: FormData) {
  const actor = await requireOperatorActor();
  const minimumSeverity = toTextValue(formData.get("minimumSeverity"));

  try {
    const result = await recoverObservabilityTelemetryOwnership({
      actorUserEmail: actor.user.email,
      reason: toTextValue(formData.get("reason")),
      minimumSeverity:
        minimumSeverity === "critical" || minimumSeverity === "warning" ? minimumSeverity : "info",
      dispatchAlerts: toBooleanValue(formData.get("dispatchAlerts")),
      trace: createAtlasStandaloneTraceContext("web")
    });
    revalidatePath("/operator/alerts");
    revalidatePath("/operator/rollout");

    if (result.status === "no_action") {
      redirectWithFeedback(
        "/operator/alerts",
        "Telemetry ownership already healthy",
        "Atlas did not need to run a recovery cycle because the current ownership signals are already healthy."
      );
    }

    const remainingLabels = result.afterOwnership
      .filter((item) => result.remainingKeys.includes(item.key))
      .map((item) => item.label);

    redirectWithFeedback(
      "/operator/alerts",
      result.status === "recovered"
        ? "Telemetry ownership recovered"
        : result.status === "partial"
          ? "Telemetry ownership partially recovered"
          : "Telemetry ownership still degraded",
      result.status === "recovered"
        ? `Atlas recovered ${result.recoveredKeys.length} ownership signal${result.recoveredKeys.length === 1 ? "" : "s"} and captured a fresh automation run.`
        : result.status === "partial"
          ? `Atlas recovered ${result.recoveredKeys.length} ownership signal${result.recoveredKeys.length === 1 ? "" : "s"}, but ${remainingLabels.join(", ")} still need attention.`
          : `Atlas ran a recovery cycle, but ${remainingLabels.join(", ")} still need attention.`,
      result.status === "recovered" ? "default" : "warning"
    );
  } catch (error) {
    redirectWithFeedback("/operator/alerts", "Telemetry ownership recovery failed", normalizeActionError(error), "error");
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

export async function updateIdentityProviderLinkLifecycleAction(linkId: string, formData: FormData) {
  const actor = await requireOperatorActor();

  try {
    const result = await updateIdentityProviderLinkLifecycle(actor, linkId, {
      action:
        toTextValue(formData.get("action")) === "REVOKE"
          ? "REVOKE"
          : toTextValue(formData.get("action")) === "REACTIVATE"
            ? "REACTIVATE"
            : "SUSPEND",
      reason: toTextValue(formData.get("reason"))
    });
    revalidatePath("/operator/support-access");
    redirectWithFeedback(
      "/operator/support-access",
      "Identity provider updated",
      `Atlas set ${result.link.userEmail} to ${result.link.status.toLowerCase()} and revoked ${result.revokedSessionCount} active sessions.`
    );
  } catch (error) {
    redirectWithFeedback("/operator/support-access", "Identity provider update failed", normalizeActionError(error), "error");
  }
}

export async function provisionExternalIdentityAssignmentAction(formData: FormData) {
  const actor = await requireOperatorActor();

  try {
    const assignment = await provisionExternalIdentityAssignment(actor, {
      provider: toTextValue(formData.get("provider")),
      externalEmail: toTextValue(formData.get("externalEmail")),
      targetOrganizationSlug: toTextValue(formData.get("targetOrganizationSlug")),
      targetRole:
        toTextValue(formData.get("targetRole")) === "OWNER"
          ? "OWNER"
          : toTextValue(formData.get("targetRole")) === "OPERATOR"
            ? "OPERATOR"
            : toTextValue(formData.get("targetRole")) === "REVIEWER"
              ? "REVIEWER"
              : toTextValue(formData.get("targetRole")) === "FINANCE"
                ? "FINANCE"
                : "ADMIN",
      userName: toTextValue(formData.get("userName")) || null,
      reason: toTextValue(formData.get("reason"))
    });

    if (toBooleanValue(formData.get("syncUpstream"))) {
      await executeAtlasUpstreamIdentityLifecycle({
        actor,
        assignment,
        action: "PROVISION",
        reason: toTextValue(formData.get("reason"))
      });
    }

    revalidatePath("/operator/identity-access");
    redirectWithFeedback(
      "/operator/identity-access",
      "External identity provisioned",
      `Atlas provisioned ${assignment.externalEmail} for ${assignment.organizationName} as ${assignment.role.toLowerCase()}.`
    );
  } catch (error) {
    redirectWithFeedback("/operator/identity-access", "External identity update failed", normalizeActionError(error), "error");
  }
}

export async function updateExternalIdentityAssignmentLifecycleAction(assignmentId: string, formData: FormData) {
  const actor = await requireOperatorActor();

  try {
    const result = await updateExternalIdentityAssignmentLifecycle(actor, assignmentId, {
      action:
        toTextValue(formData.get("action")) === "REVOKE"
          ? "REVOKE"
          : toTextValue(formData.get("action")) === "REACTIVATE"
            ? "REACTIVATE"
            : "SUSPEND",
      reason: toTextValue(formData.get("reason"))
    });

    if (toBooleanValue(formData.get("syncUpstream"))) {
      await executeAtlasUpstreamIdentityLifecycle({
        actor,
        assignment: result.assignment,
        action:
          toTextValue(formData.get("action")) === "REVOKE"
            ? "REVOKE"
            : toTextValue(formData.get("action")) === "REACTIVATE"
              ? "REACTIVATE"
              : "SUSPEND",
        reason: toTextValue(formData.get("reason"))
      });
    }

    revalidatePath("/operator/identity-access");
    redirectWithFeedback(
      "/operator/identity-access",
      "External identity lifecycle updated",
      `Atlas set ${result.assignment.externalEmail} to ${result.assignment.status.toLowerCase()} and revoked ${result.revokedSessionCount} active sessions.`
    );
  } catch (error) {
    redirectWithFeedback("/operator/identity-access", "External identity update failed", normalizeActionError(error), "error");
  }
}

export async function executeRestoreDrillAction(formData: FormData) {
  const actor = await requireOperatorActor();

  try {
    const result = await executeAtlasRestoreDrill({
      backupPath: toTextValue(formData.get("backupPath")) || "scripts/fixtures/restore-drill.sql",
      targetEnvironment: toTextValue(formData.get("targetEnvironment")),
      targetLabel: toTextValue(formData.get("targetLabel")),
      targetHost: toTextValue(formData.get("targetHost")) || null,
      executeRestore: toBooleanValue(formData.get("executeRestore")),
      actorUserEmail: actor.user.email
    });
    revalidatePath("/operator/rollout");
    redirectWithFeedback(
      "/operator/rollout",
      "Restore drill recorded",
      `${actor.user.email} stored restore proof for ${result.report.targetEnvironment} at ${result.reportPath}.`
    );
  } catch (error) {
    redirectWithFeedback("/operator/rollout", "Restore drill failed", normalizeActionError(error), "error");
  }
}

export async function executeSecretRotationAction(formData: FormData) {
  const actor = await requireOperatorActor();

  try {
    const result = await executeAtlasSecretRotation({
      environment: toTextValue(formData.get("environment")),
      rotatedBy: actor.user.email,
      reason: toTextValue(formData.get("reason")),
      secretKeys: toCommaSeparatedValues(formData.get("secretKeys"))
    });
    revalidatePath("/operator/rollout");
    redirectWithFeedback(
      "/operator/rollout",
      "Secret rotation proof recorded",
      `${actor.user.email} stored rotation proof for ${result.report.environment} at ${result.reportPath}.`
    );
  } catch (error) {
    redirectWithFeedback("/operator/rollout", "Secret rotation failed", normalizeActionError(error), "error");
  }
}

export async function executePromotionAutomationAction(formData: FormData) {
  const actor = await requireOperatorActor();

  try {
    const fromEnv = toTextValue(formData.get("fromEnv"));
    const toEnv = toTextValue(formData.get("toEnv"));
    const envFile = toTextValue(formData.get("envFile"));
    const services = toPromotionServices(formData.get("services"));

    if (
      fromEnv !== "development" &&
      fromEnv !== "staging"
    ) {
      redirectWithFeedback("/operator/rollout", "Promotion execution failed", "Promotion source must be development or staging.", "error");
    }

    if (
      toEnv !== "staging" &&
      toEnv !== "production"
    ) {
      redirectWithFeedback("/operator/rollout", "Promotion execution failed", "Promotion target must be staging or production.", "error");
    }

    const restoreDrillReport = findLatestAtlasRestoreDrillReport(toEnv);
    const secretRotationExecutionReport = findLatestAtlasSecretRotationExecutionReport(toEnv);

    if (!restoreDrillReport) {
      redirectWithFeedback(
        "/operator/rollout",
        "Promotion execution failed",
        `No restore drill proof exists yet for ${toEnv}.`,
        "error"
      );
    }

    if (!secretRotationExecutionReport) {
      redirectWithFeedback(
        "/operator/rollout",
        "Promotion execution failed",
        `No secret rotation proof exists yet for ${toEnv}.`,
        "error"
      );
    }

    if (!restoreDrillReport.proofArtifactPath) {
      redirectWithFeedback(
        "/operator/rollout",
        "Promotion execution failed",
        `The latest restore drill for ${toEnv} is missing a proof artifact path.`,
        "error"
      );
    }

    const environment = {
      ...process.env,
      ...parseAtlasEnvFile(envFile),
      APP_ENV: toEnv
    };
    const bundle = createAtlasPromotionBundle({
      fromEnv,
      toEnv,
      services: [...services],
      envFile,
      environment,
      restoreReportPath: restoreDrillReport.proofArtifactPath,
      restoreDrillReport,
      secretRotationExecutionReportPath: secretRotationExecutionReport.reportPath,
      secretRotationExecutionReport,
      secretRotationManifestPath: secretRotationExecutionReport.manifestPath,
      secretRotationManifest: secretRotationExecutionReport.manifest
    });

    const execution = await executeAtlasPromotionAutomation({
      fromEnv,
      toEnv,
      services: [...services],
      restoreDrillReport,
      secretRotationExecutionReport,
      secretRotationManifest: secretRotationExecutionReport.manifest,
      environment,
      bundlePath: bundle.promotionBundlePath,
      actorUserEmail: actor.user.email
    });

    revalidatePath("/operator/rollout");
    redirectWithFeedback(
      "/operator/rollout",
      "Promotion execution recorded",
      `Atlas stored promotion execution proof for ${fromEnv} to ${toEnv} at ${execution.reportPath}.`
    );
  } catch (error) {
    redirectWithFeedback("/operator/rollout", "Promotion execution failed", normalizeActionError(error), "error");
  }
}

export async function registerOperationalIntegrationAction(formData: FormData) {
  const actor = await requireOperatorActor();

  try {
    const integration = await registerOperationalIntegration(actor, {
      kind: toTextValue(formData.get("kind")),
      targetEnvironment: toTextValue(formData.get("targetEnvironment")),
      provider: toTextValue(formData.get("provider")),
      label: toTextValue(formData.get("label")),
      ownerEmail: toTextValue(formData.get("ownerEmail")),
      endpointReference: toTextValue(formData.get("endpointReference")) || null,
      secretReference: toTextValue(formData.get("secretReference")) || null,
      configReference: toTextValue(formData.get("configReference")) || null
    });
    revalidatePath("/operator/rollout");
    redirectWithFeedback(
      "/operator/rollout",
      "Operational integration registered",
      `Atlas registered ${integration.label} for ${integration.targetEnvironment.toLowerCase()}.`
    );
  } catch (error) {
    redirectWithFeedback("/operator/rollout", "Operational integration failed", normalizeActionError(error), "error");
  }
}

export async function updateOperationalIntegrationVerificationAction(integrationId: string, formData: FormData) {
  const actor = await requireOperatorActor();

  try {
    const integration = await updateOperationalIntegrationVerification(actor, integrationId, {
      verificationStatus: toTextValue(formData.get("verificationStatus")),
      verificationReason: toTextValue(formData.get("verificationReason"))
    });
    revalidatePath("/operator/rollout");
    redirectWithFeedback(
      "/operator/rollout",
      "Operational integration updated",
      `Atlas marked ${integration.label} as ${integration.verificationStatus.toLowerCase()}.`
    );
  } catch (error) {
    redirectWithFeedback("/operator/rollout", "Operational integration failed", normalizeActionError(error), "error");
  }
}

export async function updateOperationalIntegrationLifecycleAction(integrationId: string, formData: FormData) {
  const actor = await requireOperatorActor();

  try {
    const integration = await updateOperationalIntegrationLifecycle(actor, integrationId, {
      action:
        toTextValue(formData.get("action")) === "REVOKE"
          ? "REVOKE"
          : toTextValue(formData.get("action")) === "REACTIVATE"
            ? "REACTIVATE"
            : "SUSPEND",
      reason: toTextValue(formData.get("reason"))
    });
    revalidatePath("/operator/rollout");
    redirectWithFeedback(
      "/operator/rollout",
      "Operational integration lifecycle updated",
      `Atlas set ${integration.label} to ${integration.status.toLowerCase()}.`
    );
  } catch (error) {
    redirectWithFeedback("/operator/rollout", "Operational integration failed", normalizeActionError(error), "error");
  }
}
