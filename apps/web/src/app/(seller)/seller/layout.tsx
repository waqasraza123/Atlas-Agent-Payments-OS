import { WorkspaceLayout } from "@/components/workspace-layout";
import type { ReactNode } from "react";

type SellerLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function SellerLayout({ children }: SellerLayoutProps) {
  return <WorkspaceLayout workspace="SELLER" currentPath="/seller">{children}</WorkspaceLayout>;
}
