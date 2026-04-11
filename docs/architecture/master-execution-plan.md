# Master Execution Plan

## Purpose

This document is the execution-side source of truth for Atlas Agent Payments OS. Use it with [master-product-spec.md](../product/master-product-spec.md) to sequence implementation work, decide what not to build yet, and keep future Codex sessions on the same path.

## Source Of Truth Stack

- Product source of truth: [master-product-spec.md](../product/master-product-spec.md)
- Execution source of truth: [master-execution-plan.md](./master-execution-plan.md)
- Durable repo memory: [project-state.md](../project-state.md)
- Local handoff memory: `docs/_local/current-session.md`
- Execution workflow: [codex-execution-runbook.md](../codex-execution-runbook.md)

## Current Repository Baseline

- The monorepo scaffold, governance docs, safe push workflow, and local infra definitions already exist.
- `apps/web`, `apps/api`, `apps/worker`, and the shared packages boot at a basic scaffold level.
- Prisma schema, initial migration, and a seed path already exist.
- The repo is still in Phase 0 because the real application baseline is not complete yet.
- The next active implementation slice after this planning task is Phase 0.2 auth and actor-context baseline.

## Exact Phase Order

1. Phase 0 — Foundation hardening and real application baseline
2. Phase 1 — Premium demo foundation
3. Phase 2 — Core buyer workflow
4. Phase 3 — Seller workflow
5. Phase 4 — Payments and receipts
6. Phase 5 — Operator controls and exceptions
7. Phase 6 — Analytics and enterprise polish
8. Phase 7 — Programmable settlement extension

## Phase Dependency Summary

- Phase 0 makes the app real enough to build on.
- Phase 1 makes the product narratively powerful and demoable on top of real domain structures.
- Phase 2 makes buyer-side controls operational.
- Phase 3 completes two-sided product credibility.
- Phase 4 makes money movement and evidence real.
- Phase 5 proves the platform under failure and investigation.
- Phase 6 makes the platform enterprise-polished.
- Phase 7 adds programmable settlement credibility without distorting the core product narrative.

## Phase Plans

### Phase 0 — Foundation hardening and real application baseline

Detailed doc: [phase-0-foundation-detailed.md](../backlog/phase-0-foundation-detailed.md)

Entry criteria:

- monorepo scaffold exists
- docs, repo memory, and safe push workflow exist
- web, API, worker, and database packages boot at a basic level

Exit criteria:

- local-first auth and session baseline exists
- actor context exists across web and API
- buyer, seller, and operator workspaces use a real product shell
- shared UI primitives exist and are reused
- domain module skeletons exist in the API
- seeds support realistic dashboards and demo paths
- queue namespace conventions exist
- docs reflect the real Phase 0 state

Verification gate:

- `pnpm build`
- `pnpm dev:web`
- `pnpm dev:api`
- `pnpm dev:worker`
- `pnpm db:seed`

Acceptance summary:

- the app no longer feels like route placeholders
- future work can land on real actor-aware shells and domain structure

### Phase 1 — Premium demo foundation

Detailed doc: [phase-1-demo-foundation-detailed.md](../backlog/phase-1-demo-foundation-detailed.md)

Entry criteria:

- Phase 0 exit criteria met

Exit criteria:

- public marketing site is polished and category-clear
- buyer, seller, and operator overviews are attractive and believable
- seeded demo flow exists end to end visually
- timeline and dashboard storytelling work

Verification gate:

- `pnpm build`
- `pnpm dev:web`
- manual walkthrough of the seeded demo story

Acceptance summary:

- a founder or design partner can understand Atlas in one guided session

### Phase 2 — Core buyer workflow

Detailed doc: [phase-2-core-buyer-workflow-detailed.md](../backlog/phase-2-core-buyer-workflow-detailed.md)

Entry criteria:

- Phase 1 demo foundation is stable
- domain modules and seeds exist

Exit criteria:

- buyers can manage agents and policies
- buyers can create spend requests
- policy engine evaluates requests
- approvals can be reviewed and decided
- request timeline is real

Verification gate:

- `pnpm build`
- `pnpm dev:web`
- `pnpm dev:api`
- request and approval smoke coverage

Acceptance summary:

- a real buyer-side spend request can move through policy and approval lifecycle states

### Phase 3 — Seller workflow

Detailed doc: [phase-3-seller-workflow-detailed.md](../backlog/phase-3-seller-workflow-detailed.md)

Entry criteria:

- Phase 2 buyer workflow is stable

Exit criteria:

- sellers can create services
- pricing exists
- buyer requests can target seller services
- seller can confirm or fail delivery
- seller overview is meaningful

Verification gate:

- `pnpm build`
- buyer-to-seller seeded lifecycle walkthrough

Acceptance summary:

- Atlas becomes a credible two-sided product, not just a buyer control surface

### Phase 4 — Payments and receipts

Detailed doc: [phase-4-payments-and-receipts-detailed.md](../backlog/phase-4-payments-and-receipts-detailed.md)

Entry criteria:

- buyer and seller flows exist

Exit criteria:

- payment rail abstraction is real
- internal simulated rail is fully usable
- Stripe rail baseline exists
- payment attempts are immutable
- receipts are finalized from real lifecycle state

Verification gate:

- `pnpm build`
- payment lifecycle smoke test
- receipt finalization smoke test

Acceptance summary:

- Atlas can execute, prove, and record digital purchases with durable evidence

### Phase 5 — Operator controls and exceptions

Detailed doc: [phase-5-operator-controls-detailed.md](../backlog/phase-5-operator-controls-detailed.md)

Entry criteria:

- payment and receipt flows exist

Exit criteria:

- operator center exists
- exception queue exists
- safe operator actions exist
- audit explorer is strong enough for real investigation

Verification gate:

- `pnpm build`
- operator workflow smoke tests

Acceptance summary:

- Atlas can be trusted under failure and investigation scenarios

### Phase 6 — Analytics and enterprise polish

Detailed doc: [phase-6-analytics-and-polish-detailed.md](../backlog/phase-6-analytics-and-polish-detailed.md)

Entry criteria:

- operator workflows exist

Exit criteria:

- analytics are meaningful
- exports are useful
- search and filtering are strong
- UX polish is enterprise-grade

Verification gate:

- `pnpm build`
- analytics and export smoke tests

Acceptance summary:

- Atlas becomes design-partner-ready and boardroom-ready

### Phase 7 — Programmable settlement extension

Detailed doc: [phase-7-programmable-settlement-detailed.md](../backlog/phase-7-programmable-settlement-detailed.md)

Entry criteria:

- core off-chain platform is credible and stable

Exit criteria:

- wallet registry exists
- programmable settlement rail exists
- on-chain evidence appears in receipt timelines
- organizations can control allowed rails

Verification gate:

- `pnpm build`
- programmable settlement evidence smoke test

Acceptance summary:

- Atlas gains programmable settlement credibility without becoming blockchain-first

## Detailed Do Not Do Yet List

- do not build blockchain settlement in Phase 0 or 1
- do not add production SSO in Phase 0
- do not introduce multiple frontend apps
- do not replace seeded realistic state with frontend-only mock state
- do not build physical goods flows
- do not widen infra with message buses or Kubernetes
- do not overcomplicate queues before approval, payment, and webhook families are real
- do not overfit the product to one seller type too early

## Success Criteria By Stage

### Success after Phase 0

The repo and app both feel real. Actor-aware shells, seeds, and domain module structure exist.

### Success after Phase 1

The product is demoable and visually persuasive.

### Success after Phase 2

A buyer can truly create and control a spend request.

### Success after Phase 3

A seller can participate meaningfully in the lifecycle.

### Success after Phase 4

Atlas can execute, prove, and record digital purchases.

### Success after Phase 5

Atlas can be trusted operationally.

### Success after Phase 6

Atlas feels like an enterprise-grade product.

### Success after Phase 7

Atlas has programmable settlement credibility without losing its core narrative.

## Definition Of Done For Any Slice

A slice is done only when:

- code compiles
- types pass
- the slice uses repo conventions
- docs are updated if durable behavior changed
- local session memory is updated
- the UI or API change is coherent with the data model
- verification commands are stated and run
- safe push passes

## Immediate Next Recommendation

From the current repository state, the next safest implementation slice is:

- Phase 0.2 auth and actor-context baseline
- Phase 0.3 shared workspace shell primitives and protected buyer, seller, and operator shells
- Phase 0.4 API domain module skeletons
- Phase 0.5 stronger seeds
- Phase 0.6 queue namespace conventions
