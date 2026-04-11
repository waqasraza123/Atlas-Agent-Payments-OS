import { WorkspaceDetailRoute } from "@/components/workspace-detail-route";

type OperatorReceiptDetailPageProps = Readonly<{
  params: Promise<{
    receiptId: string;
  }>;
}>;

export default async function OperatorReceiptDetailPage({ params }: OperatorReceiptDetailPageProps) {
  const { receiptId } = await params;

  return <WorkspaceDetailRoute workspace="OPERATOR" surfaceKey="receipts" recordId={receiptId} />;
}
