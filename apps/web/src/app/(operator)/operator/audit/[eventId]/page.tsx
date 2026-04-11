import { WorkspaceDetailRoute } from "@/components/workspace-detail-route";

type OperatorAuditDetailPageProps = Readonly<{
  params: Promise<{
    eventId: string;
  }>;
}>;

export default async function OperatorAuditDetailPage({ params }: OperatorAuditDetailPageProps) {
  const { eventId } = await params;

  return <WorkspaceDetailRoute workspace="OPERATOR" surfaceKey="audit" recordId={eventId} />;
}
