import { WorkspaceDetailRoute } from "@/components/workspace-detail-route";

type BuyerRequestDetailPageProps = Readonly<{
  params: Promise<{
    requestId: string;
  }>;
}>;

export default async function BuyerRequestDetailPage({ params }: BuyerRequestDetailPageProps) {
  const { requestId } = await params;

  return <WorkspaceDetailRoute workspace="BUYER" surfaceKey="requests" recordId={requestId} />;
}
