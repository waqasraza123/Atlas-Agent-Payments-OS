import { BuyerPaymentExecutionPanel } from "@/components/buyer-payment-execution-panel";
import { WorkspaceDetailRoute } from "@/components/workspace-detail-route";
import { readWorkflowFeedback } from "@/lib/workflow-feedback";

type BuyerRequestDetailPageProps = Readonly<{
  params: Promise<{
    requestId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function BuyerRequestDetailPage({ params, searchParams }: BuyerRequestDetailPageProps) {
  const [{ requestId }, resolvedSearchParams] = await Promise.all([params, searchParams]);

  return (
    <WorkspaceDetailRoute
      workspace="BUYER"
      surfaceKey="requests"
      recordId={requestId}
      feedback={readWorkflowFeedback(resolvedSearchParams)}
    >
      <BuyerPaymentExecutionPanel requestId={requestId} />
    </WorkspaceDetailRoute>
  );
}
