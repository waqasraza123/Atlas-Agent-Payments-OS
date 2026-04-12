"use server";

import {
  AtlasProgrammableSettlementError,
  AtlasSellerWorkflowError,
  createOrganizationWallet,
  createSellerService,
  recordSellerRequestFulfillment,
  updateOrganizationProgrammableSettlementSettings,
  updateSellerService
} from "@atlas/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAtlasWorkspaceDetailHref } from "@/lib/detail-hrefs";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { buildWorkflowFeedbackHref, type WorkflowFeedbackTone } from "@/lib/workflow-feedback";

function toTextValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function toIntegerValue(value: FormDataEntryValue | null) {
  const parsed = Number.parseInt(toTextValue(value), 10);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function redirectWithFeedback(path: string, title: string, description: string, tone: WorkflowFeedbackTone = "default"): never {
  redirect(buildWorkflowFeedbackHref(path, title, description, tone));
}

async function requireSellerActor() {
  const resolution = await resolveWorkspaceActor("SELLER");

  if (resolution.status !== "ready") {
    redirectWithFeedback(
      "/seller",
      "Seller session required",
      "Switch to a seeded seller session before submitting seller workflow actions.",
      "warning"
    );
  }

  return resolution.actor;
}

function normalizeActionError(error: unknown) {
  if (error instanceof AtlasSellerWorkflowError || error instanceof AtlasProgrammableSettlementError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Atlas could not complete the requested seller workflow action.";
}

export async function createSellerServiceAction(formData: FormData) {
  const actor = await requireSellerActor();

  try {
    const service = await createSellerService(actor, {
      key: toTextValue(formData.get("key")),
      name: toTextValue(formData.get("name")),
      description: toTextValue(formData.get("description")),
      category: toTextValue(formData.get("category")),
      status: toTextValue(formData.get("status")) || "DRAFT",
      visibility: toTextValue(formData.get("visibility")) || "PRIVATE",
      pricingModel: toTextValue(formData.get("pricingModel")) || "FIXED",
      priceMinor: toIntegerValue(formData.get("priceMinor")),
      currency: toTextValue(formData.get("currency")) || "USD"
    });

    revalidatePath("/seller");
    revalidatePath("/seller/services");
    revalidatePath("/seller/requests");
    redirectWithFeedback(
      getAtlasWorkspaceDetailHref("SELLER", "services", service.id) ?? "/seller/services",
      "Service created",
      "The seller service is now part of the catalog and available for inbound request matching."
    );
  } catch (error) {
    redirectWithFeedback("/seller/services", "Service creation failed", normalizeActionError(error), "error");
  }
}

export async function updateSellerServiceAction(serviceId: string, formData: FormData) {
  const actor = await requireSellerActor();

  try {
    const service = await updateSellerService(actor, serviceId, {
      key: toTextValue(formData.get("key")),
      name: toTextValue(formData.get("name")),
      description: toTextValue(formData.get("description")),
      category: toTextValue(formData.get("category")),
      status: toTextValue(formData.get("status")),
      visibility: toTextValue(formData.get("visibility")),
      pricingModel: toTextValue(formData.get("pricingModel")),
      priceMinor: toIntegerValue(formData.get("priceMinor")),
      currency: toTextValue(formData.get("currency"))
    });

    revalidatePath("/seller");
    revalidatePath("/seller/services");
    revalidatePath("/seller/requests");
    redirectWithFeedback(
      getAtlasWorkspaceDetailHref("SELLER", "services", service.id) ?? "/seller/services",
      "Service updated",
      "The seller service catalog and pricing posture were updated successfully."
    );
  } catch (error) {
    redirectWithFeedback("/seller/services", "Service update failed", normalizeActionError(error), "error");
  }
}

export async function recordSellerRequestFulfillmentAction(requestId: string, formData: FormData) {
  const actor = await requireSellerActor();

  try {
    const request = await recordSellerRequestFulfillment(actor, requestId, {
      fulfillmentStatus: toTextValue(formData.get("fulfillmentStatus")),
      note: toTextValue(formData.get("note"))
    });

    revalidatePath("/seller");
    revalidatePath("/seller/requests");
    redirectWithFeedback(
      getAtlasWorkspaceDetailHref("SELLER", "requests", request.id) ?? "/seller/requests",
      request.fulfillment?.fulfillmentStatus === "FAILED" ? "Delivery failure recorded" : "Delivery confirmed",
      request.fulfillment?.note ?? "The seller outcome was recorded successfully.",
      request.fulfillment?.fulfillmentStatus === "FAILED" ? "error" : "default"
    );
  } catch (error) {
    redirectWithFeedback("/seller/requests", "Fulfillment update failed", normalizeActionError(error), "error");
  }
}

export async function createSellerProgrammableWalletAction(formData: FormData) {
  const actor = await requireSellerActor();

  try {
    await createOrganizationWallet(actor, {
      label: toTextValue(formData.get("label")),
      address: toTextValue(formData.get("address")),
      ownershipLabel: toTextValue(formData.get("ownershipLabel")),
      chain: toTextValue(formData.get("chain")),
      isDefault: formData.get("isDefault") === "on"
    });

    revalidatePath("/seller");
    revalidatePath("/seller/wallets");
    redirectWithFeedback(
      "/seller/wallets",
      "Wallet registered",
      "The seller wallet entry is now part of the programmable-settlement registry and awaits verification."
    );
  } catch (error) {
    redirectWithFeedback("/seller/wallets", "Wallet registration failed", normalizeActionError(error), "error");
  }
}

export async function updateSellerProgrammableSettlementSettingsAction(formData: FormData) {
  const actor = await requireSellerActor();

  try {
    const allowedRails = [
      formData.get("allowInternalSimulated") === "on" ? "INTERNAL_SIMULATED" : null,
      formData.get("allowStripe") === "on" ? "STRIPE" : null,
      formData.get("allowProgrammableUsdc") === "on" ? "PROGRAMMABLE_USDC" : null
    ].filter((value): value is "INTERNAL_SIMULATED" | "STRIPE" | "PROGRAMMABLE_USDC" => Boolean(value));

    await updateOrganizationProgrammableSettlementSettings(actor, {
      allowedRails,
      preferredRail: toTextValue(formData.get("preferredRail")) || null
    });

    revalidatePath("/seller");
    revalidatePath("/seller/wallets");
    redirectWithFeedback(
      "/seller/wallets",
      "Settlement settings updated",
      "Seller programmable-settlement governance was updated successfully."
    );
  } catch (error) {
    redirectWithFeedback("/seller/wallets", "Settlement settings failed", normalizeActionError(error), "error");
  }
}
