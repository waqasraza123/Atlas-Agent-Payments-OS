# Project State

## Product

Atlas Agent Payments OS is a premium B2B platform for controlled AI agent spending on paid APIs and digital services. The repo positions Atlas as the control plane for agent requests, approvals, payments, receipts, seller delivery, and auditability.

## Current Architecture

- Monorepo with `pnpm` workspaces and Turborepo
- `apps/web`: Next.js App Router with route groups for marketing, buyer, seller, and operator
- `apps/api`: NestJS modular monolith with a health endpoint
- `apps/worker`: BullMQ worker baseline with Redis-backed queue-family boot for approvals, notifications, payments, seller webhooks, and audit projections
- `packages/config`, `types`, `ui`, `database`, `auth`, and `domain` as shared internal packages
- PostgreSQL, Redis, MinIO, and MailHog defined in Docker Compose for local infra only
- Prisma schema and committed initial migration under `packages/database/prisma`
- Local-first session selection now exists through a shared auth contract, HTTP cookie in the web app, and a shared request header contract in the API
- Buyer, seller, and operator routes now use actor-aware workspace shells with explicit route surfaces instead of placeholder-only panels
- Workspace and API domain structure now share a single route and module registry in `@atlas/domain`
- The API now exposes thin domain skeleton modules for identity, organizations, agents, policies, requests, approvals, audit, sellers, services, payments, receipts, and operator controls
- Phase 0 seed data is now scenario-driven, schema-backed, and aligned to all major lifecycle states through reusable seed definitions in `@atlas/database`
- Queue namespace conventions now exist through a shared queue registry in `@atlas/domain`, worker queue-family bootstrapping, and a platform queue discovery route in the API
- The repo now has an expanded automated test baseline with package-level unit tests, worker and database tests, API e2e, and web HTTP smoke coverage
- Durable planning now covers both the focused v1 execution track and the longer-term platform blueprint through `docs/product/master-product-spec.md`, `docs/architecture/master-execution-plan.md`, the blueprint docs under `docs/architecture`, and the detailed phase docs under `docs/backlog`
- Phase 1 seeded demo storytelling is now reinforced by replayable scenario cards and request-linked lifecycle detail routes
- Standalone web production build now passes through `pnpm --filter @atlas/web build`
- Phase 3 seller workflow baseline and fulfillment path now exist through seller service records, seller request outcome recording, and seller-side analytics summaries
- Phase 4 payment rail abstraction, internal simulated settlement, Stripe baseline, richer receipt evidence, and reconciliation surfaces now exist through immutable payment attempts, buyer-triggered execution, buyer and operator receipt views, seller-visible payment detail, receipt truth updates, and operator-facing transaction inspection
- Phase 6 analytics, CSV export readiness, multi-entity filtering, and enterprise-grade reporting surfaces now exist through shared analytics contracts, guarded reporting APIs, filtered buyer and seller ledgers, platform transaction reporting, and organization health views
- Phase 7 programmable settlement extension now exists through organization wallet registry, supported chain runtime config, governed programmable rail selection, operator wallet verification flows, and on-chain evidence mapped into payment attempts and receipt records
- Post-v1 rollout-hardening baseline now exists through structured runtime config, structured API and worker logs, request-correlation headers, live/startup/readiness health endpoints, release-verification scripts, and a GitHub Actions release gate
- Deployment and recovery baseline now exists through environment-specific sample files, runtime env validation, release-manifest generation, rollback-readiness verification, and repo-owned database backup and restore scripts

## Non-Negotiable Rules

- No comments in code
- Keep code typed, modular, reusable, and production-grade
- Follow the existing route-group and package-boundary architecture
- Prefer native app processes on macOS and Docker only for infra
- Record assumptions in docs or task responses, not in code comments
- Keep commit messages under 140 characters
- Use `pnpm safe-push` or pass the same verification gate before pushing

## Current Roadmap

- Product source of truth: `docs/product/master-product-spec.md`
- Execution source of truth: `docs/architecture/master-execution-plan.md`
- Full-scale blueprint docs: `docs/architecture/full-scale-product-blueprint.md`, `docs/architecture/production-operations-blueprint.md`, `docs/architecture/security-and-compliance-roadmap.md`, `docs/architecture/release-maturity-model.md`
- Testing source of truth: `docs/architecture/testing-strategy.md`
- Focused-v1 extension completion doc: `docs/backlog/phase-7-programmable-settlement-detailed.md`
- Active next-track docs: `docs/architecture/production-operations-blueprint.md`, `docs/architecture/security-and-compliance-roadmap.md`, `docs/architecture/release-maturity-model.md`
- Current operations runbook: `docs/runbooks/production-operations-baseline.md`
- Current deployment and recovery runbooks: `docs/runbooks/environment-promotion-baseline.md`, `docs/runbooks/database-backup-and-restore.md`, `docs/runbooks/release-rollback-baseline.md`
- Phase 0: foundation hardening and real application baseline completed in repo scope
- Phase 1: premium demo foundation
- Phase 2: core buyer workflow completed in repo scope
- Phase 3: seller workflow completed in repo scope
- Phase 4: payments and receipts completed in repo scope
- Phase 5: operator controls and exceptions completed in repo scope
- Phase 6: analytics and enterprise polish completed in repo scope
- Phase 7: programmable settlement extension completed in repo scope
- Next active implementation track: production operations, release maturity, and security hardening for broader rollout readiness

## Completed Major Slices

- Initial monorepo scaffold and root tooling
- Architecture, product, and phase roadmap docs
- Authoritative master planning system and detailed per-phase execution docs
- Full-scale product, platform, operations, security, and release blueprint docs
- Repository governance docs, license, and collaboration guidance
- Local Docker Compose for PostgreSQL, Redis, MinIO, and MailHog
- Next.js marketing and workspace placeholder routes
- NestJS API bootstrap with `GET /health`
- BullMQ worker bootstrap and placeholder queue
- Prisma schema, generated client path, initial migration, and seed script
- Shared local-first auth and actor-context contract in `@atlas/auth`
- Role-aware web workspace gating and shared workspace shell primitives
- API actor extraction baseline with protected actor routes
- Shared domain registry for workspace route surfaces and API module ownership
- Buyer, seller, and operator workspace route shells beyond the overview page
- Thin NestJS domain skeleton modules across the Phase 0.4 module map
- Scenario-driven seed manifest with lifecycle coverage across request, approval, payment, receipt, and audit states
- Shared queue family registry and worker boot structure for approvals, notifications, payments, seller webhooks, and audit projections
- Package-level tests for config, types, UI, database seed definitions, and worker queue contracts
- Automated unit and e2e test foundation expanded across packages, API, and web workspace smoke routes
- Phase 1 narrative and dashboard baseline across marketing, buyer, seller, and operator overview surfaces
- Phase 1 detail baseline across seeded buyer request, approval, timeline, payment, and audit-linked record presentation
- Phase 1.6 demo-mode polish baseline across replayable scenario storytelling, richer loading states, and linked lifecycle detail flows
- Phase 2 buyer workflow baseline across agent management, policy management, request creation, policy evaluation, approval decisions, and buyer write-path audit events
- Shared buyer workflow contracts now live in `@atlas/domain` and Prisma-backed buyer workflow services now live in `@atlas/database`
- Buyer-facing pages now support schema-backed create and update flows instead of overview-only seeded surfaces
- Phase 2.6 buyer request detail and workflow stabilization now render persisted policy outcomes, approval reasons, idempotency posture, and create-to-detail continuity directly from request state
- Phase 3 seller workflow now supports seller profile and team visibility, service catalog management, service detail routing, inbound request monitoring, seller fulfillment recording, and seller-side analytics summaries
- Phase 4 is now complete in repo scope through shared payment rail contracts, internal simulated settlement, Stripe payment-intent creation behind config gates, immutable payment attempts, retry hardening, richer receipt evidence, buyer and operator receipt surfaces, payment and receipt API routes, request-linked receipt truth updates, and broader reconciliation posture
- Phase 5 is now complete in repo scope through operator case modeling, persistent operator notifications, reason-captured operator actions, operator overview and exception surfaces, and a filterable audit explorer
- Phase 6 is now complete in repo scope through shared analytics contracts, guarded reporting APIs, CSV export flows, filtered buyer and seller ledgers, platform transaction reporting, and organization health views
- Phase 7 is now complete in repo scope through programmable wallet registry, supported chain config, governed `PROGRAMMABLE_USDC` rail selection, operator wallet verification, and on-chain evidence propagation into payment and receipt records
- Post-v1 operations baseline is now in place through runtime config discipline, request correlation, readiness endpoints, release scripts, and CI release gating
- Deployment and recovery baseline is now in place through env-profile validation, release manifests, backup and restore scripts, and rollback-readiness checks
- Root safe push workflow with versioned pre-push hook and verifier scripts
- Durable repo memory in `AGENTS.md` and `docs/project-state.md`

## Important Decisions

- One web app only; buyer, seller, operator, and marketing are separated by route groups
- No microservices, Kubernetes, Supabase, or blockchain-first scope in early phases
- Prisma is held on `6.19.x` for build stability while the domain is still changing
- Root `pnpm build` is currently defined as workspace typecheck only
- Git pre-push verification is repo-versioned under `.githooks/pre-push`
- Repository license is Apache-2.0
- Legacy summary planning docs remain only as companions and point back to the master planning system
- Phase 0 implementation slices 0.1 through 0.7 are now in place in repo scope
- Phase 1 implementation slices 1.1 through 1.6 are now in place in repo scope
- Phase 2 is now complete in repo scope through Phase 2.6
- Phase 3 is now complete in repo scope through seller catalog management, inbound request monitoring, seller fulfillment recording, and seller analytics summaries
- Phase 4 payment rail abstraction, internal simulated settlement, Stripe baseline, richer receipt evidence, and broader reconciliation views are now in place in repo scope
- Phase 6 analytics, export readiness, multi-entity filtering, and enterprise polish are now in place in repo scope
- Phase 7 programmable settlement extension is now in place in repo scope through governed wallet registry and on-chain evidence mapping
- The focused v1 and programmable-settlement extension tracks are complete in repo scope
- A first post-v1 operations baseline is now in place in repo scope
- A deployment and recovery baseline is now in place in repo scope
- The current active execution slice is deeper observability, auth hardening, tenancy validation, and incident-response maturity for broader rollout readiness
- The focused v1 wedge remains unchanged while the docs now also define the longer-term platform and operations target state
- Local development auth currently relies on seeded memberships, a shared local session cookie, and the `x-atlas-local-session` request header contract
- Root `pnpm test:e2e` now exercises API e2e and web HTTP smoke coverage
- Policy evaluation results now persist on `SpendRequest.evaluationResult`, and idempotency keys persist on `SpendRequest.idempotencyKey`
- Buyer workflow writes currently use shared domain validation plus Prisma-backed transaction helpers reused by both API and web
- Phase 6 analytics and export flows now use shared `@atlas/domain` and `@atlas/database` contracts instead of page-specific reporting logic

## Deferred / Not Yet Implemented

- Real auth provider and organization session flows beyond the local-first baseline
- Richer policy version history beyond the current integer version increment and stored rule snapshots
- Stripe webhook ingestion and settlement confirmation beyond the current payment-intent baseline
- Broader export packaging, richer audit bundle workflows, and deeper self-serve analytics customization beyond the current CSV baseline
- Receipt artifact generation beyond JSON-backed receipt truth
- Configurable analytics and broader reporting automation
- Full release-engineering implementation for multi-environment deployment and rollback discipline
- Full observability, backup, restore, and incident-response automation
- Broader auth maturity, SSO, and tenant-isolation hardening beyond the current local-first baseline
- Production-ready Stripe webhook ingestion and settlement confirmation lifecycle
- Broader support tooling, compliance workstreams, and enterprise deployment controls
- Browser-level interaction tests beyond current HTTP and route-level smoke coverage
- Seeded database integration tests against a reliably provisioned local database
- Broader automated coverage across every seller and operator detail route

## Risks / Watchouts

- Phase 0 structure is now in place, but domain modules still remain mostly skeleton boundaries rather than full product workflows
- Local actor resolution and real seed execution still depend on the repo-owned Postgres instance being reachable; current verification on this machine returned database access denial for `pnpm db:seed`
- `pnpm build` currently validates the workspace through repo-wide typecheck only; the stronger rollout gate is now `pnpm verify:release`
- `pnpm verify:release` now validates env templates, rollback-readiness, test/build gates, and standalone web production build
- Current web e2e remains route and HTTP smoke coverage rather than full browser automation
- Seller and operator detail routes still need broader automated runtime coverage than buyer-side seeded detail flows
- The repo root `pnpm build` gate is still workspace typecheck by design even though standalone web production build is now green
- The buyer, seller, and operator lifecycle now includes payment execution, receipt truth, reconciliation visibility, operator cases, analytics, exportable reporting, notifications, reason-captured interventions, and governed programmable settlement
- The current rollout-hardening baseline adds request correlation, runtime health surfaces, structured logs, security headers, and CI release verification, but deeper deployment automation and auth hardening are still not in place
- Database backup and restore scripts now exist, but scheduled backups, restore drills, and cloud deployment automation are still not in place
- The planning surface is now centralized; future tasks should update the master docs instead of introducing new parallel planning files
- The new full-scale blueprint docs are guidance for later release maturity and must not be used as justification to skip the current focused v1 implementation sequence
- Future tasks should avoid widening the stack or introducing extra infra unless it directly serves the platform, operations, security, or release-maturity blueprints

## Standard Verification

- `find docs -maxdepth 3 -type f | sort`
- `pnpm install`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `pnpm verify:env`
- `pnpm verify:release`
- `pnpm verify:rollback`
- `pnpm verify:ops`
- `pnpm --filter @atlas/web build`
- `pnpm verify:phase0`
- `pnpm db:seed`
- `pnpm verify:push`
- `pnpm dev:api`
- `curl -s http://localhost:4000/health`
- `curl -i -H "x-atlas-local-session: <token>" http://localhost:4000/actor/context`
- `pnpm --filter @atlas/web exec dotenv -e ../../.env -- next dev --port 3101`
- `pnpm dev:worker`
