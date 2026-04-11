import { WorkflowFormField } from "@/components/workflow-form-field";
import { WorkflowFormPanel } from "@/components/workflow-form-panel";
import { WorkspaceDetailRoute } from "@/components/workspace-detail-route";
import { readWorkflowFeedback } from "@/lib/workflow-feedback";
import { recordSellerRequestFulfillmentAction } from "../../actions";

const inputClassName =
  "w-full rounded-2xl border border-[var(--atlas-line)] bg-black/20 px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition placeholder:text-[var(--atlas-muted)] focus:border-[var(--atlas-accent-strong)]";

type SellerRequestDetailPageProps = Readonly<{
  params: Promise<{
    requestId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function SellerRequestDetailPage({ params, searchParams }: SellerRequestDetailPageProps) {
  const [{ requestId }, resolvedSearchParams] = await Promise.all([params, searchParams]);

  return (
    <WorkspaceDetailRoute
      workspace="SELLER"
      surfaceKey="requests"
      recordId={requestId}
      feedback={readWorkflowFeedback(resolvedSearchParams)}
    >
      <WorkflowFormPanel
        eyebrow="Fulfillment outcome"
        title="Record seller delivery posture"
        description="Seller-side fulfillment remains explicit so buyer activity, later receipts, and operator review can all point to the same recorded outcome."
        action={recordSellerRequestFulfillmentAction.bind(null, requestId)}
        submitLabel="Record outcome"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <WorkflowFormField label="Fulfillment status">
            <select className={inputClassName} name="fulfillmentStatus" defaultValue="DELIVERED">
              <option value="DELIVERED">Delivered</option>
              <option value="FAILED">Failed</option>
            </select>
          </WorkflowFormField>
          <WorkflowFormField label="Seller note" hint="Outcome notes stay attached to the request timeline">
            <textarea
              className={`${inputClassName} min-h-28`}
              name="note"
              placeholder="Describe the seller-side delivery result, evidence, or failure posture."
              required
            />
          </WorkflowFormField>
        </div>
      </WorkflowFormPanel>
    </WorkspaceDetailRoute>
  );
}
