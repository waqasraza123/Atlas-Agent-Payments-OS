import { WorkspaceDetailRoute } from "@/components/workspace-detail-route";

type SellerRequestDetailPageProps = Readonly<{
  params: Promise<{
    requestId: string;
  }>;
}>;

export default async function SellerRequestDetailPage({ params }: SellerRequestDetailPageProps) {
  const { requestId } = await params;

  return <WorkspaceDetailRoute workspace="SELLER" surfaceKey="requests" recordId={requestId} />;
}
