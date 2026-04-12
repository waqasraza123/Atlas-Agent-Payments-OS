import { getOrganizationProgrammableSettlement } from "@atlas/database";
import { ProgrammableSettlementPage } from "@/components/programmable-settlement-page";
import {
  createSellerProgrammableWalletAction,
  updateSellerProgrammableSettlementSettingsAction
} from "@/app/(seller)/seller/actions";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { readWorkflowFeedback } from "@/lib/workflow-feedback";

type SellerProgrammableSettlementPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function SellerProgrammableSettlementPage({ searchParams }: SellerProgrammableSettlementPageProps) {
  const [resolution, resolvedSearchParams] = await Promise.all([resolveWorkspaceActor("SELLER"), searchParams]);

  if (resolution.status !== "ready") {
    return null;
  }

  const record = await getOrganizationProgrammableSettlement(resolution.actor);

  return (
    <ProgrammableSettlementPage
      workspace="SELLER"
      record={record}
      feedback={readWorkflowFeedback(resolvedSearchParams)}
      createWalletAction={createSellerProgrammableWalletAction}
      updateSettingsAction={updateSellerProgrammableSettlementSettingsAction}
    />
  );
}
