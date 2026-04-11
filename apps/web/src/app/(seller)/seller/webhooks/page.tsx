import { WorkspaceSurfaceRoute } from "@/components/workspace-surface-route";

export default async function SellerWebhooksPage() {
  return <WorkspaceSurfaceRoute workspace="SELLER" surfaceKey="webhooks" />;
}
