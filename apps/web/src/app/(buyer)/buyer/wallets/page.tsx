import { getOrganizationProgrammableSettlement } from "@atlas/database";
import { ProgrammableSettlementPage } from "@/components/programmable-settlement-page";
import {
  createBuyerProgrammableWalletAction,
  updateBuyerProgrammableSettlementSettingsAction
} from "@/app/(buyer)/buyer/actions";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { readWorkflowFeedback } from "@/lib/workflow-feedback";

type BuyerProgrammableSettlementPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function BuyerProgrammableSettlementPage({ searchParams }: BuyerProgrammableSettlementPageProps) {
  const [resolution, resolvedSearchParams] = await Promise.all([resolveWorkspaceActor("BUYER"), searchParams]);

  if (resolution.status !== "ready") {
    return null;
  }

  const record = await getOrganizationProgrammableSettlement(resolution.actor);

  return (
    <ProgrammableSettlementPage
      workspace="BUYER"
      record={record}
      feedback={readWorkflowFeedback(resolvedSearchParams)}
      createWalletAction={createBuyerProgrammableWalletAction}
      updateSettingsAction={updateBuyerProgrammableSettlementSettingsAction}
    />
  );
}
