import Link from "next/link";
import { atlasProduct, premiumSurfaces } from "@atlas/config";
import { Panel } from "@atlas/ui";

const controlPoints = [
  "Buyer organizations define spend rules before agents can transact.",
  "Seller organizations expose paid APIs and digital services with traceability.",
  "Operators review approvals, payments, receipts, and audit trails in one control plane."
];

export default function MarketingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-10 px-6 py-10 sm:px-10">
      <header className="flex items-center justify-between border-b border-[var(--atlas-line)] pb-6">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.32em] text-[var(--atlas-accent)]">Atlas</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">{atlasProduct.name}</h1>
        </div>
        <nav className="hidden gap-4 text-sm text-[var(--atlas-muted)] sm:flex">
          <Link href="/buyer">Buyer</Link>
          <Link href="/seller">Seller</Link>
          <Link href="/operator">Operator</Link>
        </nav>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
        <Panel className="space-y-8 p-8 sm:p-10">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.28em] text-[var(--atlas-accent-strong)]">
              Controlled agent spend
            </p>
            <h2 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
              Let AI agents buy paid APIs and digital services without losing human control.
            </h2>
            <p className="max-w-2xl text-lg leading-8 text-[var(--atlas-muted)]">
              Atlas Agent Payments OS is the operating surface for approvals, policy controls,
              payment records, receipts, and auditability across buyer, seller, and operator teams.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {premiumSurfaces.map((surface) => (
              <Link
                key={surface.href}
                href={surface.href}
                className="rounded-2xl border border-[var(--atlas-line)] bg-white/4 p-5 transition hover:border-[var(--atlas-accent)] hover:bg-white/8"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--atlas-muted)]">
                  {surface.label}
                </p>
                <p className="mt-3 text-lg font-medium">{surface.title}</p>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel className="space-y-6 p-8">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--atlas-muted)]">
              Foundation status
            </p>
            <h3 className="text-2xl font-semibold">Phase 0 scaffold is live.</h3>
          </div>
          <div className="space-y-4">
            {controlPoints.map((point) => (
              <div
                key={point}
                className="rounded-2xl border border-[var(--atlas-line)] bg-[var(--atlas-panel-strong)]/70 p-4 text-sm leading-7 text-[var(--atlas-muted)]"
              >
                {point}
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </main>
  );
}
