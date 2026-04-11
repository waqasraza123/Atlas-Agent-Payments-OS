import { WorkspaceDetailRoute } from "@/components/workspace-detail-route";
import { readWorkflowFeedback } from "@/lib/workflow-feedback";

type SellerServiceDetailPageProps = Readonly<{
  params: Promise<{
    serviceId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function SellerServiceDetailPage({ params, searchParams }: SellerServiceDetailPageProps) {
  const [{ serviceId }, resolvedSearchParams] = await Promise.all([params, searchParams]);

  return (
    <WorkspaceDetailRoute
      workspace="SELLER"
      surfaceKey="services"
      recordId={serviceId}
      feedback={readWorkflowFeedback(resolvedSearchParams)}
    />
  );
}
