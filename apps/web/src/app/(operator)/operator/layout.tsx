import { WorkspaceLayout } from "@/components/workspace-layout";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

type OperatorLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function OperatorLayout({ children }: OperatorLayoutProps) {
  return <WorkspaceLayout workspace="OPERATOR" currentPath="/operator">{children}</WorkspaceLayout>;
}
