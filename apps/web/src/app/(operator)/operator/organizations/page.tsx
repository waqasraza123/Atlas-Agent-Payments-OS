import { WorkspaceSurfaceRoute } from "@/components/workspace-surface-route";

export default async function OperatorOrganizationsPage() {
  return <WorkspaceSurfaceRoute workspace="OPERATOR" surfaceKey="organizations" />;
}
