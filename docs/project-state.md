# Project State

## Product

Atlas Agent Payments OS is a premium B2B platform for controlled AI agent spending on paid APIs and digital services. The repo positions Atlas as the control plane for agent requests, approvals, payments, receipts, seller delivery, and auditability.

## Current Architecture

- Monorepo with `pnpm` workspaces and Turborepo
- `apps/web`: Next.js App Router with route groups for marketing, buyer, seller, and operator
- `apps/api`: NestJS modular monolith with a health endpoint
- `apps/worker`: BullMQ worker scaffold with Redis-backed queue boot
- `packages/config`, `types`, `ui`, `database`, `auth`, and `domain` as shared internal packages
- PostgreSQL, Redis, MinIO, and MailHog defined in Docker Compose for local infra only
- Prisma schema and committed initial migration under `packages/database/prisma`
- Durable planning centers on `docs/product/master-product-spec.md`, `docs/architecture/master-execution-plan.md`, and the detailed phase docs under `docs/backlog`

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
- Active detailed phase doc: `docs/backlog/phase-0-foundation-detailed.md`
- Phase 0: foundation hardening and real application baseline
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
- Repository governance docs, license, and collaboration guidance
- Local Docker Compose for PostgreSQL, Redis, MinIO, and MailHog
- Next.js marketing and workspace placeholder routes
- NestJS API bootstrap with `GET /health`
- BullMQ worker bootstrap and placeholder queue
- Prisma schema, generated client path, initial migration, and seed script
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
- The current active execution slice after planning is Phase 0.2 auth and actor-context baseline

## Deferred / Not Yet Implemented

- Real auth provider and organization session flows
- Policy versioning and policy evaluation engine
- Request and approval lifecycle endpoints
- Seller service management workflows
- Stripe integration and payment reconciliation
- Receipt artifact generation beyond seeded records
- Operator exception center and analytics
- Onchain settlement support

## Risks / Watchouts

- The repo is still in Phase 0, so domain modules exist more in docs and schema than in working API features
- Local verification depends on Docker Desktop being up and the repo-owned Postgres instance owning port `5432`
- `pnpm build` currently validates the workspace through repo-wide typecheck only; API and worker still run natively via `tsx`
- The planning surface is now centralized; future tasks should update the master docs instead of introducing new parallel planning files
- Future tasks should avoid widening the stack or introducing extra infra before Phase 0 hardening is complete

## Standard Verification

- `find docs -maxdepth 3 -type f | sort`
- `pnpm install`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm verify:push`
- `pnpm dev:api`
- `curl -s http://localhost:4000/health`
- `pnpm dev:worker`
