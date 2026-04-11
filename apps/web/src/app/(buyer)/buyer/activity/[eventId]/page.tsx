import { WorkspaceDetailRoute } from "@/components/workspace-detail-route";

type BuyerActivityDetailPageProps = Readonly<{
  params: Promise<{
    eventId: string;
  }>;
}>;

export default async function BuyerActivityDetailPage({ params }: BuyerActivityDetailPageProps) {
  const { eventId } = await params;

  return <WorkspaceDetailRoute workspace="BUYER" surfaceKey="activity" recordId={eventId} />;
}
