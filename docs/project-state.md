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
- Active detailed phase doc: `docs/backlog/phase-1-demo-foundation-detailed.md`
- Phase 0: foundation hardening and real application baseline completed in repo scope
- Phase 1: premium demo foundation
- Phase 2: core buyer workflow
- Phase 3: seller workflow
- Phase 4: payments and receipts
- Phase 5: operator controls and exceptions
- Phase 6: analytics and enterprise polish
- Phase 7: programmable settlement extension

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
- The current active execution slice is Phase 1.5 timeline and detail experience, followed by Phase 1.6 demo-mode polish
- The focused v1 wedge remains unchanged while the docs now also define the longer-term platform and operations target state
- Local development auth currently relies on seeded memberships, a shared local session cookie, and the `x-atlas-local-session` request header contract
- Root `pnpm test:e2e` now exercises API e2e and web HTTP smoke coverage

## Deferred / Not Yet Implemented

- Real auth provider and organization session flows beyond the local-first baseline
- Policy versioning and policy evaluation engine
- Request and approval lifecycle endpoints
- Seller service management workflows
- Stripe integration and payment reconciliation
- Receipt artifact generation beyond seeded records
- Operator exception center and analytics
- Onchain settlement support
- Browser-level interaction tests beyond HTTP smoke coverage
- Seeded database integration tests against a reliably provisioned local database

## Risks / Watchouts

- Phase 0 structure is now in place, but domain modules still remain mostly skeleton boundaries rather than full product workflows
- Local actor resolution and real seed execution still depend on the repo-owned Postgres instance being reachable; current verification on this machine returned database access denial for `pnpm db:seed`
- `pnpm build` currently validates the workspace through repo-wide typecheck only; API and worker still run natively via `tsx`
- Current web e2e is still HTTP smoke coverage, not full browser automation
- The planning surface is now centralized; future tasks should update the master docs instead of introducing new parallel planning files
- The new full-scale blueprint docs are guidance for later release maturity and must not be used as justification to skip the current focused v1 implementation sequence
- Future tasks should avoid widening the stack or introducing extra infra before Phase 1 demo foundation is in place

## Standard Verification

- `find docs -maxdepth 3 -type f | sort`
- `pnpm install`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `pnpm verify:phase0`
- `pnpm db:seed`
- `pnpm verify:push`
- `pnpm dev:api`
- `curl -s http://localhost:4000/health`
- `curl -i -H "x-atlas-local-session: <token>" http://localhost:4000/actor/context`
- `pnpm --filter @atlas/web exec dotenv -e ../../.env -- next dev --port 3101`
- `pnpm dev:worker`
