# Phase 0 Foundation Detailed

## Goal

Turn the repo from a strong scaffold and governance baseline into a real application baseline with actor-aware structure, protected workspace shells, domain skeletons, stronger seeds, and queue contracts.

## Why This Phase Exists

Without a real Phase 0 baseline, every later feature lands on placeholders. Phase 0 creates the durable application shape that all later workflows depend on.

## Current Repository Baseline

- monorepo scaffold exists
- durable planning docs and repo memory exist
- safe push workflow exists
- web, API, worker, and database packages boot at a basic level
- buyer, seller, and operator routes are still placeholders
- auth and actor context do not exist yet
- API domain modules are still mostly skeletal

## Entry Criteria

- monorepo scaffold exists
- docs, repo memory, and safe push workflow exist
- web, API, worker, and database packages boot at a basic level

## Exit Criteria

- local-first auth and session baseline exists
- actor context exists across web and API
- buyer, seller, and operator workspaces use a real product shell
- shared UI primitives exist and are reused
- domain module skeletons exist in the API
- seeds support realistic dashboards and demo paths
- queue namespace conventions exist
- docs are updated to reflect the real Phase 0 state

## Sequence

1. Phase 0.1 durable planning and execution memory
2. Phase 0.2 auth and actor-context baseline
3. Phase 0.3 real product shell
4. Phase 0.4 API domain skeletons
5. Phase 0.5 seed hardening
6. Phase 0.6 queue namespace conventions
7. Phase 0.7 verification hardening

## Detailed Sub-Steps

### Phase 0.1 — durable planning and execution memory

Purpose:

- preserve the authoritative product spec and execution plan inside the repo
- make future Codex sessions restart-safe

Tasks:

- ensure the master execution plan exists
- ensure the master product spec exists
- ensure detailed phase docs exist
- ensure AGENTS.md points to the correct read order
- ensure project-state and current-session are accurate
- ensure legacy summary docs clearly defer to the authoritative planning docs

Deliverables:

- `docs/product/master-product-spec.md`
- `docs/architecture/master-execution-plan.md`
- `docs/backlog/*-detailed.md`
- `docs/codex-execution-runbook.md`
- aligned `AGENTS.md`, `docs/project-state.md`, and `docs/_local/current-session.md`

### Phase 0.2 — auth and actor-context baseline

Purpose:

- make the app actor-aware without overcommitting to a long-term auth vendor too early

Tasks:

- define a local-first session strategy for development
- define the actor model as user, organization, role, and optional agent context
- expand `packages/auth` with typed session and permission primitives
- implement web route gating by workspace role
- implement API actor extraction and a role-aware guard baseline
- keep the auth implementation thin, replaceable, and suitable for later real identity integration

Expected outputs:

- session type definitions
- actor context helpers
- role and workspace guard utilities
- API request actor extraction baseline
- shared local session transport through the web cookie and API request header
- seeded memberships that back the local-first actor profiles

### Phase 0.3 — real product shell

Purpose:

- replace placeholder routes with a credible product shell that later workflows can inhabit

Tasks:

- build shared app shell components
- build sidebar navigation
- build top bar
- build page header
- build KPI card, list shell, detail shell, and timeline shell primitives
- replace buyer, seller, and operator placeholder pages with real workspace shells
- wire shells to seeded actor context and role state

Expected outputs:

- reusable workspace shell in `packages/ui`
- buyer, seller, and operator layout routes with coherent navigation
- premium but restrained placeholder content grounded in seeded state

### Phase 0.4 — API domain skeletons

Purpose:

- give the modular monolith real domain boundaries before adding business workflows

Tasks:

- create NestJS modules for identity, organizations, agents, policies, requests, approvals, audit, sellers, services, payments, receipts, and operator controls
- keep modules thin but real
- add routing and service skeletons
- define DTO and validation boundaries where the shape is already clear
- avoid implementing full business logic in this phase

Expected outputs:

- module directories and exports
- route/controller/service structure that matches the roadmap
- a clearer domain map for Phase 1 and 2 work

### Phase 0.5 — seed hardening

Purpose:

- make demoable seeded state come from the real schema instead of frontend-only mock data

Tasks:

- expand buyer, seller, and operator organizations
- add memberships and role contexts
- add multiple agents
- add multiple policies
- add request states across pending, approved, denied, failed, and fulfilled
- add audit-heavy timeline data
- attach scenario meaning so demo flows can be replayed later

Expected outputs:

- realistic dashboards and list states
- coherent request lifecycle examples
- enough seeded data to support Phase 1 showcase work

### Phase 0.6 — queue namespace conventions

Purpose:

- establish worker structure before approval, notification, payment, and webhook complexity expands

Tasks:

- define queue families for approvals, notifications, payments, seller webhooks, and audit projections
- create worker registration structure for those families
- keep processors placeholder-level but real
- document retry and dead-letter expectations before real payment jobs are added

Expected outputs:

- queue name constants or domain definitions
- worker boot structure grouped by queue family
- queue conventions captured in docs and code

### Phase 0.7 — verification hardening

Purpose:

- make the repository baseline safe to build on every day

Tasks:

- ensure build, typecheck, seed, and basic boot work cleanly
- update docs to reflect the actual baseline
- keep the push workflow working through the pre-push gate

Expected outputs:

- stable verification path
- trustworthy current-session handoff
- updated durable memory reflecting the true Phase 0 state

## Modules Touched

- `packages/auth`
- `packages/ui`
- `packages/database`
- `packages/domain`
- `apps/web`
- `apps/api`
- `apps/worker`
- `docs`

## Deliverables

- local-first auth and session baseline
- actor-aware route gating
- shared workspace shell primitives
- real NestJS domain module skeletons
- richer seed scenarios
- queue namespace conventions
- updated project memory and current-session memory

## Focused V1 Track Boundary

This phase belongs directly to the focused v1 build track. It should establish the application baseline required for every later product phase without widening into deployment-platform or compliance-heavy implementation.

## Full-Scale Platform Maturity Follow-Ons

Later tracks build on this phase through:

- stronger auth and identity maturity
- tenant-boundary validation and support tooling guardrails
- environment and deployment automation
- deeper observability and incident readiness

## Intentionally Deferred In Phase 0

- Stripe implementation
- blockchain settlement
- full buyer request creation flow
- seller publication flow
- receipt finalization workflow
- operator cases
- production deployment architecture
- advanced security or compliance program implementation

## Verification Commands

- `pnpm install`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm dev:web`
- `pnpm dev:api`
- `pnpm dev:worker`
- `pnpm db:migrate`
- `pnpm db:seed`

## Acceptance Criteria

- the app no longer feels like route placeholders
- actor-aware shells exist
- seeds provide realistic state
- API structure is ready for Phase 1 and Phase 2 work

## Risks and Watchouts

- do not overbuild auth
- do not create fake frontend-only demo data that bypasses schema
- do not split one web app into multiple frontends
- do not add payment or seller workflow logic before actor context and shell structure are real
