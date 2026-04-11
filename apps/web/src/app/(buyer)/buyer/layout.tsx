import { WorkspaceLayout } from "@/components/workspace-layout";
import type { ReactNode } from "react";

type BuyerLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function BuyerLayout({ children }: BuyerLayoutProps) {
  return <WorkspaceLayout workspace="BUYER" currentPath="/buyer">{children}</WorkspaceLayout>;
}
