import type { AtlasOrganizationProgrammableSettlementRecord } from "@atlas/domain";
import { formatAtlasPaymentRailLabel, formatAtlasWalletVerificationStatusLabel } from "@atlas/domain";
import { MetricCard, PageHeader, RecordListPanel } from "@atlas/ui";
import { WorkflowFeedbackPanel } from "./workflow-feedback-panel";
import { WorkflowFormField } from "./workflow-form-field";
import { WorkflowFormPanel } from "./workflow-form-panel";

type ProgrammableSettlementPageProps = Readonly<{
  workspace: "BUYER" | "SELLER";
  record: AtlasOrganizationProgrammableSettlementRecord;
  feedback?: {
    title: string;
    description: string;
    tone?: "default" | "warning" | "error";
  } | null;
  createWalletAction: (formData: FormData) => void | Promise<void>;
  updateSettingsAction: (formData: FormData) => void | Promise<void>;
}>;

export function ProgrammableSettlementPage({
  workspace,
  record,
  feedback,
  createWalletAction,
  updateSettingsAction
}: ProgrammableSettlementPageProps) {
  const verifiedWalletCount = record.wallets.filter((wallet) => wallet.verificationStatus === "VERIFIED").length;
  const pendingWalletCount = record.wallets.filter((wallet) => wallet.verificationStatus === "PENDING").length;
  const defaultWallet = record.wallets.find((wallet) => wallet.isDefault) ?? null;
  const programmableRailAllowed = record.settings.allowedRails.includes("PROGRAMMABLE_USDC");
  const workspaceLabel = workspace === "BUYER" ? "Buyer" : "Seller";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${workspaceLabel} settlement`}
        title={`${workspaceLabel} programmable settlement`}
        description="Register organization wallets, govern allowed payment rails, and keep programmable USDC readiness explicit inside the same Atlas control plane."
      />
      {feedback ? (
        <WorkflowFeedbackPanel title={feedback.title} description={feedback.description} tone={feedback.tone} />
      ) : null}
      <section className="grid gap-4 xl:grid-cols-5">
        <MetricCard
          label="Runtime"
          value={record.supportedChain.enabled ? "Enabled" : "Disabled"}
          detail={`${record.supportedChain.label} · ${record.supportedChain.assetSymbol}`}
        />
        <MetricCard
          label="Allowed rails"
          value={String(record.settings.allowedRails.length)}
          detail={record.settings.allowedRails.map((rail) => formatAtlasPaymentRailLabel(rail)).join(", ")}
        />
        <MetricCard
          label="Verified wallets"
          value={String(verifiedWalletCount)}
          detail="Verified default wallets are required before programmable execution becomes available."
        />
        <MetricCard
          label="Pending wallets"
          value={String(pendingWalletCount)}
          detail="Pending wallets still need operator verification before they can carry programmable settlement."
        />
        <MetricCard
          label="Readiness"
          value={record.readiness.ready ? "Ready" : "Blocked"}
          detail={record.readiness.reasons[0] ?? "Programmable settlement can execute when a verified default wallet is present."}
        />
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <RecordListPanel
          eyebrow="Wallet registry"
          title="Organization wallets"
          description="Wallets remain organization-scoped, verification-aware, and explicit about ownership so programmable settlement never becomes implicit."
          items={record.wallets.map((wallet) => ({
            id: wallet.id,
            title: wallet.label,
            description: `${wallet.chainLabel} · ${wallet.address}`,
            detail: `${wallet.ownershipLabel}${wallet.verificationNote ? ` · ${wallet.verificationNote}` : ""}`,
            statusLabel: formatAtlasWalletVerificationStatusLabel(wallet.verificationStatus),
            statusTone:
              wallet.verificationStatus === "VERIFIED"
                ? "success"
                : wallet.verificationStatus === "REVOKED"
                  ? "critical"
                  : "warning"
          }))}
          emptyTitle="No wallets registered"
          emptyDescription="Create a wallet entry to establish programmable-settlement ownership and verification posture."
        />
        <RecordListPanel
          eyebrow="Chain readiness"
          title="Supported programmable chain"
          description="Phase 7 keeps one governed programmable rail and one supported chain active at a time to avoid widening the operating surface too early."
          items={[
            {
              id: record.supportedChain.key,
              title: record.supportedChain.label,
              description: `${record.supportedChain.networkName} · Chain ID ${record.supportedChain.chainId}`,
              detail: `${record.supportedChain.assetSymbol} · ${record.supportedChain.requiredConfirmations} required confirmations`,
              statusLabel: record.supportedChain.enabled ? "Enabled" : "Disabled",
              statusTone: record.supportedChain.enabled ? "success" : "warning"
            },
            {
              id: `${record.organizationId}-default-wallet`,
              title: "Default wallet posture",
              description: defaultWallet ? `${defaultWallet.label} · ${defaultWallet.address}` : "No default wallet selected",
              detail: defaultWallet
                ? `${formatAtlasWalletVerificationStatusLabel(defaultWallet.verificationStatus)} · ${defaultWallet.chainLabel}`
                : "Select a default wallet once a verified registry entry exists.",
              statusLabel: defaultWallet ? (defaultWallet.isDefault ? "Default" : "Registered") : "Missing",
              statusTone: defaultWallet?.verificationStatus === "VERIFIED" ? "success" : "warning"
            }
          ]}
          emptyTitle="No programmable chain metadata"
          emptyDescription="Supported-chain metadata appears here once Phase 7 runtime config is active."
        />
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <WorkflowFormPanel
          eyebrow="Rail governance"
          title="Allowed rail settings"
          description="Organization-level rail governance keeps programmable settlement opt-in and reversible while Atlas continues to support the off-chain rails."
          action={updateSettingsAction}
          submitLabel="Update settlement settings"
        >
          <WorkflowFormField label="Allowed rails" hint="Keep at least one rail enabled so the organization can still execute approved payments.">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { name: "allowInternalSimulated", label: "Internal simulated", checked: record.settings.allowedRails.includes("INTERNAL_SIMULATED") },
                { name: "allowStripe", label: "Stripe", checked: record.settings.allowedRails.includes("STRIPE") },
                { name: "allowProgrammableUsdc", label: "Programmable USDC", checked: programmableRailAllowed }
              ].map((option) => (
                <label
                  key={option.name}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--atlas-outline)] bg-[var(--atlas-surface-muted)] px-4 py-3 text-sm text-[var(--atlas-ink)]"
                >
                  <input type="checkbox" name={option.name} defaultChecked={option.checked} className="h-4 w-4 accent-[var(--atlas-accent)]" />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </WorkflowFormField>
          <WorkflowFormField label="Preferred rail" hint="The preferred rail is advisory; buyers can still choose any allowed rail during execution.">
            <select
              name="preferredRail"
              defaultValue={record.settings.preferredRail ?? ""}
              className="w-full rounded-2xl border border-[var(--atlas-outline)] bg-[var(--atlas-surface-muted)] px-4 py-3 text-sm text-[var(--atlas-ink)]"
            >
              <option value="">No preferred rail</option>
              {record.settings.allowedRails.map((rail) => (
                <option key={rail} value={rail}>
                  {formatAtlasPaymentRailLabel(rail)}
                </option>
              ))}
            </select>
          </WorkflowFormField>
        </WorkflowFormPanel>
        <WorkflowFormPanel
          eyebrow="Wallet registry"
          title="Register a wallet"
          description="New wallet entries start pending verification so ownership remains explicit before a programmable rail can use them."
          action={createWalletAction}
          submitLabel="Create wallet entry"
        >
          <WorkflowFormField label="Label" hint="Use a durable wallet name that maps cleanly to treasury or settlement ownership.">
            <input
              name="label"
              required
              className="w-full rounded-2xl border border-[var(--atlas-outline)] bg-[var(--atlas-surface-muted)] px-4 py-3 text-sm text-[var(--atlas-ink)]"
            />
          </WorkflowFormField>
          <WorkflowFormField label="Wallet address" hint="Wallets are stored normalized and remain organization-scoped.">
            <input
              name="address"
              required
              placeholder="0x..."
              className="w-full rounded-2xl border border-[var(--atlas-outline)] bg-[var(--atlas-surface-muted)] px-4 py-3 text-sm text-[var(--atlas-ink)]"
            />
          </WorkflowFormField>
          <WorkflowFormField label="Ownership label" hint="Capture who owns the wallet inside the organization so operator review stays legible.">
            <input
              name="ownershipLabel"
              required
              className="w-full rounded-2xl border border-[var(--atlas-outline)] bg-[var(--atlas-surface-muted)] px-4 py-3 text-sm text-[var(--atlas-ink)]"
            />
          </WorkflowFormField>
          <WorkflowFormField label="Chain" hint="Phase 7 keeps the supported programmable chain narrow on purpose.">
            <select
              name="chain"
              defaultValue={record.supportedChain.key}
              className="w-full rounded-2xl border border-[var(--atlas-outline)] bg-[var(--atlas-surface-muted)] px-4 py-3 text-sm text-[var(--atlas-ink)]"
            >
              <option value={record.supportedChain.key}>{record.supportedChain.label}</option>
            </select>
          </WorkflowFormField>
          <WorkflowFormField label="Default wallet" hint="Default wallets are the first candidates for programmable settlement execution.">
            <label className="flex items-center gap-3 rounded-2xl border border-[var(--atlas-outline)] bg-[var(--atlas-surface-muted)] px-4 py-3 text-sm text-[var(--atlas-ink)]">
              <input type="checkbox" name="isDefault" className="h-4 w-4 accent-[var(--atlas-accent)]" />
              <span>Mark this wallet as the organization default</span>
            </label>
          </WorkflowFormField>
        </WorkflowFormPanel>
      </section>
    </div>
  );
}
