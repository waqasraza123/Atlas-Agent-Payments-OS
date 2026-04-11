import { WorkspaceDetailRoute } from "@/components/workspace-detail-route";

type SellerPaymentDetailPageProps = Readonly<{
  params: Promise<{
    paymentId: string;
  }>;
}>;

export default async function SellerPaymentDetailPage({ params }: SellerPaymentDetailPageProps) {
  const { paymentId } = await params;

  return <WorkspaceDetailRoute workspace="SELLER" surfaceKey="payments" recordId={paymentId} />;
}
