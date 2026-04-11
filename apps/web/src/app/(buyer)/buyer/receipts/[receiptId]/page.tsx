import { WorkspaceDetailRoute } from "@/components/workspace-detail-route";

type BuyerReceiptDetailPageProps = Readonly<{
  params: Promise<{
    receiptId: string;
  }>;
}>;

export default async function BuyerReceiptDetailPage({ params }: BuyerReceiptDetailPageProps) {
  const { receiptId } = await params;

  return <WorkspaceDetailRoute workspace="BUYER" surfaceKey="receipts" recordId={receiptId} />;
}
