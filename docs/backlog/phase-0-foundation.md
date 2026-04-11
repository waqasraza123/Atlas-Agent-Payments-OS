# Phase 0 Foundation and Platform Baseline

## Goal

Turn the existing scaffold into a dependable platform baseline for every later phase. This phase ends when the repo is not just organized correctly, but can support auth, seeded demo flows, policy evaluation, audit events, and seller/payment work without another round of architecture churn.

## Current state

- Monorepo scaffold exists.
- Root tooling, package boundaries, Docker Compose, placeholder web routes, placeholder API health endpoint, placeholder worker, and initial Prisma schema are already present.
- This phase now focuses on hardening and filling the remaining platform gaps rather than recreating the scaffold.

## Exact milestone

The phase is complete when:

- the architecture, product, naming, and phase docs are aligned and checked into the repo
- local setup on Node `24.x` works on a 2019 Intel Mac without extra manual steps
- Docker Compose boots PostgreSQL, Redis, MinIO, and MailHog as the only containers needed for daily development
- Prisma generates, deploys the initial migration, and seeds demo-safe buyer, seller, and operator records
- the web app has real route shells and navigation structure for marketing, buyer, seller, and operator groups
- auth/session boundaries exist even if the login provider remains narrow
- API modules are split by domain, not only by placeholder route
- worker queues, job names, and instrumentation are stable enough for later request, notification, and payment jobs
- audit-event write utilities and correlation IDs exist across API and worker flows
- `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass from the repo root

## Workstreams

### 1. Workspace and developer ergonomics

- Lock the explicit stack baseline in docs and keep it aligned with the actual repo versions.
- Add a `docs/backlog` phase index so contributors know the delivery order.
- Normalize environment loading for web, API, worker, and database commands.
- Add a script strategy for local reset, seed replay, and demo data refresh.

### 2. Web product shell

- Replace standalone placeholder pages with a route-grouped product shell that includes shared navigation, page headers, filter bars, KPI card slots, and detail drawer patterns.
- Add layout primitives in `packages/ui` for page frame, sidebar, top bar, section header, metric card, and timeline shell.
- Build loading, empty, and error states that match the premium product direction.
- Keep design tokens centralized and documented. Avoid adding per-page visual systems.

### 3. Auth and authorization baseline

- Add a thin authentication implementation suitable for local development and future production replacement.
- Introduce actor context in the API for user, organization, role, and request correlation.
- Gate route groups by role class: buyer, seller, operator, and internal support.
- Keep organization switching as a first-class product concept from the beginning.

### 4. API and domain module hardening

- Create NestJS modules for identity, organizations, agents, policies, requests, approvals, audit, sellers, services, and payments even if some remain thin.
- Add DTOs, validation, and module boundaries now so API shapes remain predictable.
- Add request correlation IDs, structured logging, and uniform error mapping.
- Add an internal-only OpenAPI surface for faster integration and review.

### 5. Database and seed baseline

- Harden the Prisma schema so request, approval, payment, receipt, and audit remain separate lifecycles.
- Commit the initial migration set and verify it against the repo-owned Postgres container.
- Expand seeding so demo-safe records cover happy-path and exception-path scenarios.
- Add seed records for at least one buyer organization, one seller organization, one operator organization, two agents, two policies, a pending approval, a completed payment, and one failure scenario.

### 6. Worker and async foundation

- Define queue namespaces for approvals, notifications, payments, seller webhooks, and audit projection refresh.
- Keep processors small and job payloads explicit.
- Add retry and dead-letter conventions in docs before real payment jobs are introduced.
- Instrument worker boot, job start, job success, job retry, and job failure logs with correlation metadata.

### 7. Acceptance hardening

- Verify app boot, API health, worker boot, Prisma generate, lint, typecheck, and seed commands from a clean local checkout.
- Capture any local-machine conflicts in the Intel Mac runbook.
- Do not start Phase 1 until Phase 0 has one stable path for new engineers.

## Explicit deliverables

- stack baseline doc
- product spec doc
- naming options doc
- detailed phase backlog docs
- hardened route shells across marketing, buyer, seller, and operator
- auth/session baseline
- real NestJS domain module skeletons
- committed migration baseline and richer seeds
- queue naming and instrumentation conventions
- Intel Mac-focused local runbook updates

## Out of scope

- full production SSO
- Stripe integration
- onchain settlement
- full policy evaluation engine
- seller-facing delivery logic
- analytics warehouse or BI stack
- production deployment automation

## Risks

- schema churn if request and payment lifecycles are collapsed too early
- local friction if Dockerized infra and native processes are not clearly separated
- overbuilding auth before organization, role, and support boundaries are finalized
- demo seed records becoming fake marketing state rather than real domain records

## Guardrails

- keep the product shell premium, but use real domain records underneath it
- prefer one clear abstraction per domain boundary over generic framework-heavy indirection
- do not introduce extra infrastructure majors in this phase
- record assumptions in docs and ADRs, not in code comments
