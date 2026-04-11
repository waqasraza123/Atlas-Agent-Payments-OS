import { WorkspaceLayout } from "@/components/workspace-layout";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

type BuyerLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function BuyerLayout({ children }: BuyerLayoutProps) {
  return <WorkspaceLayout workspace="BUYER" currentPath="/buyer">{children}</WorkspaceLayout>;
}
