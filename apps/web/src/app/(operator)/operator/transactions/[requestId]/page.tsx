import { WorkspaceDetailRoute } from "@/components/workspace-detail-route";

type OperatorTransactionDetailPageProps = Readonly<{
  params: Promise<{
    requestId: string;
  }>;
}>;

export default async function OperatorTransactionDetailPage({ params }: OperatorTransactionDetailPageProps) {
  const { requestId } = await params;

  return <WorkspaceDetailRoute workspace="OPERATOR" surfaceKey="transactions" recordId={requestId} />;
}
