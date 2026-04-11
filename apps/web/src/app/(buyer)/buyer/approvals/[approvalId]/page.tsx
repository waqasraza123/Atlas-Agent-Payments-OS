import { WorkspaceDetailRoute } from "@/components/workspace-detail-route";
import { readWorkflowFeedback } from "@/lib/workflow-feedback";

type BuyerApprovalDetailPageProps = Readonly<{
  params: Promise<{
    approvalId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function BuyerApprovalDetailPage({ params, searchParams }: BuyerApprovalDetailPageProps) {
  const [{ approvalId }, resolvedSearchParams] = await Promise.all([params, searchParams]);

  return (
    <WorkspaceDetailRoute
      workspace="BUYER"
      surfaceKey="approvals"
      recordId={approvalId}
      feedback={readWorkflowFeedback(resolvedSearchParams)}
    />
  );
}
