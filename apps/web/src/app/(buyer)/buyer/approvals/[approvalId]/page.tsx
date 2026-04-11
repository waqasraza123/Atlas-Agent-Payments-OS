import { WorkspaceDetailRoute } from "@/components/workspace-detail-route";

type BuyerApprovalDetailPageProps = Readonly<{
  params: Promise<{
    approvalId: string;
  }>;
}>;

export default async function BuyerApprovalDetailPage({ params }: BuyerApprovalDetailPageProps) {
  const { approvalId } = await params;

  return <WorkspaceDetailRoute workspace="BUYER" surfaceKey="approvals" recordId={approvalId} />;
}
