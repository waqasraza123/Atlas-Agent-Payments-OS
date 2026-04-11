import Link from "next/link";
import { atlasProduct } from "@atlas/config";
import { Panel } from "@atlas/ui";
import { createMarketingStoryModel } from "@/lib/marketing-story";
import { DemoScenarioPanel } from "@/components/demo-scenario-panel";

export default function MarketingPage() {
  const model = createMarketingStoryModel();

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-6 py-8 sm:px-10 sm:py-10">
      <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--atlas-line)] bg-[linear-gradient(135deg,rgba(12,24,43,0.94),rgba(5,10,18,0.96))] px-6 py-6 shadow-[0_28px_120px_rgba(0,0,0,0.42)] sm:px-8 sm:py-8">
        <div className="flex flex-col gap-4 border-b border-[var(--atlas-line)] pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.34em] text-[var(--atlas-accent)]">Atlas</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">{atlasProduct.name}</h1>
          </div>
          <nav className="flex flex-wrap items-center gap-3 text-sm text-[var(--atlas-muted)]">
            <Link href="/buyer" className="rounded-full border border-[var(--atlas-line)] px-4 py-2 hover:border-[var(--atlas-accent)]">
              Buyer
            </Link>
            <Link href="/seller" className="rounded-full border border-[var(--atlas-line)] px-4 py-2 hover:border-[var(--atlas-accent)]">
              Seller
            </Link>
            <Link href="/operator" className="rounded-full border border-[var(--atlas-line)] px-4 py-2 hover:border-[var(--atlas-accent)]">
              Operator
            </Link>
          </nav>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-6">
            <div className="space-y-4">
              <p className="text-[11px] uppercase tracking-[0.32em] text-[var(--atlas-accent-strong)]">
                Controlled autonomy for agent commerce
              </p>
              <h2 className="max-w-4xl text-4xl font-semibold leading-tight sm:text-6xl">
                Let agents pay for paid APIs and digital services without losing human control.
              </h2>
              <p className="max-w-3xl text-base leading-8 text-[var(--atlas-muted)] sm:text-lg">
                Atlas is the command center between AI agents and paid actions. It makes requests, approvals,
                payments, receipts, seller delivery, and auditability visible to buyer, seller, and operator teams
                in one premium control plane.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {model.heroMetrics.map((metric) => (
                <Panel key={metric.label} className="min-h-[164px] bg-white/4 p-5">
                  <div className="space-y-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--atlas-muted)]">{metric.label}</p>
                    <p className="text-3xl font-semibold tracking-tight text-[var(--atlas-ink)]">{metric.value}</p>
                    <p className="text-sm leading-6 text-[var(--atlas-muted)]">{metric.detail}</p>
                  </div>
                </Panel>
              ))}
            </div>
          </div>

          <Panel className="overflow-hidden p-0">
            <div className="border-b border-[var(--atlas-line)] bg-[linear-gradient(180deg,rgba(141,211,199,0.16),rgba(255,255,255,0))] px-6 py-5">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--atlas-accent)]">Live demo posture</p>
              <h3 className="mt-3 text-2xl font-semibold">A real seeded control plane, not a static mockup.</h3>
            </div>
            <div className="space-y-4 px-6 py-6">
              {model.workflow.map((step, index) => (
                <article key={step.id} className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 p-5">
                  <div className="flex items-start gap-4">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--atlas-line)] bg-white/8 text-sm font-semibold text-[var(--atlas-accent)]">
                      {index + 1}
                    </span>
                    <div className="space-y-2">
                      <h4 className="text-lg font-medium">{step.title}</h4>
                      <p className="text-sm leading-6 text-[var(--atlas-muted)]">{step.description}</p>
                      <p className="text-sm leading-6 text-[var(--atlas-accent-strong)]">{step.detail}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        </section>
      </header>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel className="space-y-6 p-6 sm:p-8">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--atlas-accent)]">Why Atlas</p>
            <h2 className="text-3xl font-semibold tracking-tight">The control plane for agent spending</h2>
            <p className="max-w-3xl text-sm leading-7 text-[var(--atlas-muted)] sm:text-base">
              Atlas is built for the moment when agents stop being read-only assistants and start doing paid work.
              The platform keeps every meaningful action bounded, attributable, and inspectable.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {model.trustPillars.map((pillar) => (
              <article
                key={pillar.id}
                className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 p-5 shadow-[0_16px_60px_rgba(0,0,0,0.18)]"
              >
                <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--atlas-accent-strong)]">{pillar.eyebrow}</p>
                <h3 className="mt-3 text-xl font-medium leading-8">{pillar.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--atlas-muted)]">{pillar.description}</p>
              </article>
            ))}
          </div>
        </Panel>

        <Panel className="space-y-5 p-6 sm:p-8">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--atlas-accent)]">Workspace preview</p>
            <h2 className="text-3xl font-semibold tracking-tight">One product, three trust surfaces</h2>
          </div>
          <div className="space-y-4">
            {model.workspacePreviews.map((workspace) => (
              <Link
                key={workspace.id}
                href={workspace.href}
                className="block rounded-[24px] border border-[var(--atlas-line)] bg-white/4 p-5 transition hover:border-[var(--atlas-accent)] hover:bg-white/8"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--atlas-muted)]">{workspace.subtitle}</p>
                    <h3 className="text-xl font-medium">{workspace.title}</h3>
                    <p className="text-sm leading-7 text-[var(--atlas-muted)]">{workspace.description}</p>
                  </div>
                  <span className="rounded-full border border-[var(--atlas-line)] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[var(--atlas-accent)]">
                    {workspace.detail}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {model.narrativeHighlights.map((highlight) => (
          <Panel key={highlight.id} className="space-y-4 p-6">
            <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--atlas-accent)]">{highlight.eyebrow}</p>
            <h3 className="text-2xl font-semibold tracking-tight">{highlight.title}</h3>
            <p className="text-sm leading-7 text-[var(--atlas-muted)]">{highlight.description}</p>
          </Panel>
        ))}
      </section>

      <DemoScenarioPanel
        eyebrow="Guided demo story"
        title="Walk the seeded lifecycle Atlas is built around"
        description="The current demo is replayable from real seed records. Start from the buyer-side request detail and follow approvals, payment posture, receipt evidence, and audit history from there."
        items={model.demoScenarioCards.slice(0, 4)}
      />

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Panel className="space-y-5 p-6 sm:p-8">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--atlas-accent)]">How Atlas works</p>
            <h2 className="text-3xl font-semibold tracking-tight">Request, decision, payment, receipt, audit.</h2>
            <p className="max-w-3xl text-sm leading-7 text-[var(--atlas-muted)] sm:text-base">
              The current repo already models the future lifecycle correctly. Requests, approvals, payments,
              receipts, and audit events remain separate records because that is how financial trust scales.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 p-5">
              <h3 className="text-lg font-medium">Buyer-side controls</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--atlas-muted)]">
                Seeded agents, policies, approvals, and request states now power the buyer workspace.
              </p>
            </article>
            <article className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 p-5">
              <h3 className="text-lg font-medium">Seller-side service posture</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--atlas-muted)]">
                Seller views already surface inbound requests, payment posture, customers, and webhook boundaries.
              </p>
            </article>
            <article className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 p-5">
              <h3 className="text-lg font-medium">Operator oversight</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--atlas-muted)]">
                Operators now see platform modules, queue families, failures, and audit-heavy lifecycle activity.
              </p>
            </article>
            <article className="rounded-[24px] border border-[var(--atlas-line)] bg-white/4 p-5">
              <h3 className="text-lg font-medium">Scalable foundations</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--atlas-muted)]">
                Queue families, worker structure, and package-level tests are now in place before real payment rails arrive.
              </p>
            </article>
          </div>
        </Panel>

        <Panel className="space-y-5 p-6 sm:p-8">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--atlas-accent)]">Next active product phase</p>
            <h2 className="text-3xl font-semibold tracking-tight">Premium demo foundation</h2>
          </div>
          <p className="text-sm leading-7 text-[var(--atlas-muted)]">
            The current step is to make Atlas immediately understandable and visually persuasive while staying grounded in
            the real Phase 0 domain and lifecycle baseline.
          </p>
          <div className="space-y-3">
            <Link
              href="/buyer"
              className="flex items-center justify-between rounded-[22px] border border-[var(--atlas-line)] bg-white/4 px-4 py-4 text-sm font-medium hover:border-[var(--atlas-accent)]"
            >
              Explore buyer overview
              <span className="text-[var(--atlas-accent)]">/buyer</span>
            </Link>
            <Link
              href="/seller"
              className="flex items-center justify-between rounded-[22px] border border-[var(--atlas-line)] bg-white/4 px-4 py-4 text-sm font-medium hover:border-[var(--atlas-accent)]"
            >
              Explore seller overview
              <span className="text-[var(--atlas-accent)]">/seller</span>
            </Link>
            <Link
              href="/operator"
              className="flex items-center justify-between rounded-[22px] border border-[var(--atlas-line)] bg-white/4 px-4 py-4 text-sm font-medium hover:border-[var(--atlas-accent)]"
            >
              Explore operator overview
              <span className="text-[var(--atlas-accent)]">/operator</span>
            </Link>
          </div>
        </Panel>
      </section>
    </main>
  );
}
