import { isAtlasPaymentExecutionEligible, isAtlasPaymentRetryEligible } from "@atlas/domain";
import { prisma } from "@atlas/database";
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
  const canExecute = isAtlasPaymentExecutionEligible(request.status);
  const canRetry = request.payment ? isAtlasPaymentRetryEligible(request.payment.status) : false;
  const action = executeBuyerPaymentAction.bind(null, requestId);

  if (!canExecute && !canRetry) {
    return (
      <DetailGrid
        eyebrow="Payment execution"
        title="Execution currently unavailable"
        description="Payment execution remains gated until the request is approved or an existing failed attempt becomes retry eligible."
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
      title={canRetry ? "Retry payment attempt" : "Execute simulated payment"}
      description="Atlas creates an immutable payment attempt, updates the payment intent, and refreshes receipt truth from the latest seller fulfillment posture."
      action={action}
      submitLabel={canRetry ? "Retry payment execution" : "Execute payment"}
    >
      <input type="hidden" name="rail" value="INTERNAL_SIMULATED" />
      <WorkflowFormField label="Rail" hint="Phase 4 uses the internal simulated rail. Stripe remains behind the same abstraction for a later slice.">
        <input
          readOnly
          value="Internal simulated"
          className="w-full rounded-2xl border border-[var(--atlas-outline)] bg-[var(--atlas-surface-muted)] px-4 py-3 text-sm text-[var(--atlas-ink)]"
        />
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
    </WorkflowFormPanel>
  );
}
