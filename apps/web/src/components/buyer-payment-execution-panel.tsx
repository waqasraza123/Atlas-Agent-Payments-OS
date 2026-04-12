import { paymentRuntime } from "@atlas/config";
import { atlasPaymentMaximumAttemptCount, isAtlasPaymentAttemptLimitReached, isAtlasPaymentExecutionEligible, isAtlasPaymentRetryEligible } from "@atlas/domain";
import { getDefaultVerifiedOrganizationWallet, getOrganizationProgrammableSettlement, prisma } from "@atlas/database";
import { DetailGrid, StatePanel } from "@atlas/ui";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { executeBuyerPaymentAction } from "@/app/(buyer)/buyer/actions";
import { WorkflowFormField } from "./workflow-form-field";
import { WorkflowFormPanel } from "./workflow-form-panel";

type BuyerPaymentExecutionPanelProps = Readonly<{
  requestId: string;
}>;

function formatOptionalValue(value: string | null | undefined, fallback: string) {
  return value && value.trim().length > 0 ? value : fallback;
}

export async function BuyerPaymentExecutionPanel({ requestId }: BuyerPaymentExecutionPanelProps) {
  const resolution = await resolveWorkspaceActor("BUYER");

  if (resolution.status !== "ready") {
    return null;
  }

  const request = await prisma.spendRequest.findFirst({
    where: {
      id: requestId,
      organizationId: resolution.actor.organization.id
    },
    include: {
      organization: true,
      sellerOrganization: true,
      payment: {
        include: {
          attempts: {
            orderBy: {
              attemptNumber: "desc"
            }
          }
        }
      }
    }
  });

  if (!request) {
    return null;
  }

  if (!request.sellerOrganizationId) {
    return (
      <StatePanel
        eyebrow="Payment execution"
        title="Seller linkage required"
        description="Atlas cannot execute payment for a buyer request until a seller organization is linked to the record."
        tone="warning"
      />
    );
  }

  const sellerOrganization = request.sellerOrganization;

  if (!sellerOrganization) {
    return (
      <StatePanel
        eyebrow="Payment execution"
        title="Seller context unavailable"
        description="Atlas could not resolve seller context for this request, so execution remains blocked until the request is linked cleanly."
        tone="warning"
      />
    );
  }

  const latestAttempt = request.payment?.attempts[0] ?? null;
  const attemptCount = request.payment?.attempts.length ?? 0;
  const canExecute = isAtlasPaymentExecutionEligible(request.status);
  const canRetry = request.payment ? isAtlasPaymentRetryEligible(request.payment.status) : false;
  const attemptLimitReached = isAtlasPaymentAttemptLimitReached(attemptCount);
  const action = executeBuyerPaymentAction.bind(null, requestId);
  const programmableSettlement = await getOrganizationProgrammableSettlement(resolution.actor);
  const sellerVerifiedWallet = await getDefaultVerifiedOrganizationWallet(request.sellerOrganizationId);
  const programmableRailReady =
    programmableSettlement.readiness.ready &&
    programmableSettlement.settings.allowedRails.includes("PROGRAMMABLE_USDC") &&
    Boolean(sellerVerifiedWallet);
  const availableRails = [
    { value: "INTERNAL_SIMULATED", label: "Internal simulated" },
    ...(paymentRuntime.stripeEnabled ? [{ value: "STRIPE", label: "Stripe" }] : []),
    ...(programmableRailReady ? [{ value: "PROGRAMMABLE_USDC", label: "Programmable USDC" }] : [])
  ];
  const programmableReadinessMessage = programmableRailReady
    ? `Programmable USDC is available on ${programmableSettlement.supportedChain.label}.`
    : [
        ...programmableSettlement.readiness.reasons,
        sellerVerifiedWallet ? null : "The seller organization needs a verified default wallet."
      ]
        .filter((value): value is string => Boolean(value))
        .join(" ");

  if ((!canExecute && !canRetry) || attemptLimitReached) {
    return (
      <DetailGrid
        eyebrow="Payment execution"
        title={attemptLimitReached ? "Execution limit reached" : "Execution currently unavailable"}
        description={
          attemptLimitReached
            ? `Atlas only allows ${atlasPaymentMaximumAttemptCount} attempts per request during the current Phase 4 baseline.`
            : "Payment execution remains gated until the request is approved or an existing failed attempt becomes retry eligible."
        }
        items={[
          {
            label: "Request status",
            value: request.status,
            detail: "Approved or executing requests can enter payment execution."
          },
          {
            label: "Current payment",
            value: request.payment?.status ?? "Not created",
            detail: formatOptionalValue(latestAttempt?.reference, "No payment attempt has been recorded yet.")
          },
          {
            label: "Attempt count",
            value: `${attemptCount}`,
            detail: `Maximum attempts in this baseline: ${atlasPaymentMaximumAttemptCount}`
          },
          {
            label: "Seller",
            value: sellerOrganization.name,
            detail: sellerOrganization.slug
          }
        ]}
      />
    );
  }

  return (
    <WorkflowFormPanel
      eyebrow="Payment execution"
      title={canRetry ? "Retry payment attempt" : "Execute payment attempt"}
      description="Atlas creates an immutable payment attempt, updates the payment intent, and refreshes receipt truth from the latest seller fulfillment posture."
      action={action}
      submitLabel={canRetry ? "Retry payment execution" : "Execute payment"}
    >
      <WorkflowFormField
        label="Rail"
        hint={
          [
            paymentRuntime.stripeEnabled
              ? "Stripe is available in this environment and remains hidden behind the same Atlas payment abstraction."
              : "Stripe is not configured in this environment.",
            programmableReadinessMessage
          ]
            .filter(Boolean)
            .join(" ")
        }
      >
        <select
          name="rail"
          defaultValue="INTERNAL_SIMULATED"
          className="w-full rounded-2xl border border-[var(--atlas-outline)] bg-[var(--atlas-surface-muted)] px-4 py-3 text-sm text-[var(--atlas-ink)]"
        >
          {availableRails.map((rail) => (
            <option key={rail.value} value={rail.value}>
              {rail.label}
            </option>
          ))}
        </select>
      </WorkflowFormField>
      <WorkflowFormField label="Execution posture" hint="Execution is allowed on approved requests and retries remain limited to failed or voided attempts.">
        <input
          readOnly
          value={canRetry ? "Retry eligible" : "Fresh execution"}
          className="w-full rounded-2xl border border-[var(--atlas-outline)] bg-[var(--atlas-surface-muted)] px-4 py-3 text-sm text-[var(--atlas-ink)]"
        />
      </WorkflowFormField>
      <WorkflowFormField label="Current payment state" hint="Atlas keeps the payment intent separate from the request and receipt lifecycles.">
        <input
          readOnly
          value={request.payment?.status ?? "Not created"}
          className="w-full rounded-2xl border border-[var(--atlas-outline)] bg-[var(--atlas-surface-muted)] px-4 py-3 text-sm text-[var(--atlas-ink)]"
        />
      </WorkflowFormField>
      <WorkflowFormField label="Latest attempt reference" hint="Every execution path appends a new immutable payment attempt.">
        <input
          readOnly
          value={formatOptionalValue(latestAttempt?.reference, "No attempt recorded")}
          className="w-full rounded-2xl border border-[var(--atlas-outline)] bg-[var(--atlas-surface-muted)] px-4 py-3 text-sm text-[var(--atlas-ink)]"
        />
      </WorkflowFormField>
      <WorkflowFormField label="Attempt count" hint="Phase 4 currently caps execution attempts per request to keep evidence and retry posture bounded.">
        <input
          readOnly
          value={`${attemptCount} of ${atlasPaymentMaximumAttemptCount}`}
          className="w-full rounded-2xl border border-[var(--atlas-outline)] bg-[var(--atlas-surface-muted)] px-4 py-3 text-sm text-[var(--atlas-ink)]"
        />
      </WorkflowFormField>
      <WorkflowFormField label="Programmable readiness" hint="Programmable settlement remains governed by org-level rail settings and verified wallet posture.">
        <input
          readOnly
          value={programmableRailReady ? "Ready" : "Blocked"}
          className="w-full rounded-2xl border border-[var(--atlas-outline)] bg-[var(--atlas-surface-muted)] px-4 py-3 text-sm text-[var(--atlas-ink)]"
        />
      </WorkflowFormField>
    </WorkflowFormPanel>
  );
}
