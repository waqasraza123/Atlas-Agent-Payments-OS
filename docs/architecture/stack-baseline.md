# Stack Baseline

## Purpose

This document locks the technical baseline for Atlas Agent Payments OS so execution can move without repeated stack debates. These choices are intentionally aligned to the current repo scaffold and the local development target of a 2019 Intel MacBook Pro.

## Runtime and workspace

- Node.js: `24.x`
- Package manager: `pnpm 10.x`
- Monorepo orchestration: Turborepo `2.x`
- Language: TypeScript `6.x`

## Frontend

- Framework: Next.js `16.x`
- React: `19.2`
- Routing model: App Router with route groups for `(marketing)`, `(buyer)`, `(seller)`, and `(operator)`
- Styling: Tailwind CSS `4.x`
- Shared UI: repo-owned `@atlas/ui` package
- Motion: CSS-first motion plus selective Framer Motion introduction only when a screen needs richer transitions

### Why this frontend baseline

- One Next.js app keeps the product coherent and reduces overhead on an older Intel laptop.
- React `19.2` is already represented by the current type and runtime packages.
- Tailwind `4.x` supports a fast internal design system without creating a separate CSS tooling track.
- A repo-owned UI package is preferred over pulling in a generated component layer for every primitive. Atlas needs a distinctive premium visual language rather than a library-shaped product.

## Backend and async processing

- API framework: NestJS `11.x`
- Worker runtime: Node TypeScript plus BullMQ `5.x`
- Queue backend: Redis `7-alpine`
- API style: modular monolith with domain modules, DTO validation, and explicit worker job payloads

### Why this backend baseline

- NestJS provides strong module boundaries for identity, requests, approvals, sellers, payments, receipts, audit, and operator tools.
- BullMQ is sufficient for approval reminders, payment retries, seller webhook reconciliation, demo replay jobs, notifications, and export generation.
- Redis `7` is already present in local infra and is enough for the first seven phases.

## Data and storage

- Primary database: PostgreSQL `16-alpine`
- ORM and schema tool: Prisma `6.19.x`
- Object storage: MinIO
- Local mail capture: MailHog

### Why this data baseline

- PostgreSQL `16` and Redis `7` match the current Docker Compose baseline and keep local image churn low on Intel Mac hardware.
- Prisma `6.19.x` is intentionally held instead of moving to `7.x` during active product buildout. Prisma 7 changes config conventions; that migration is not worth the noise while the domain is still being shaped.
- MinIO gives local parity for receipt artifacts and future export bundles.

## Product rails and deferred choices

- Real payment rail for first live execution phase: Stripe
- Deterministic demo rail: internal simulated rail in the worker and payments domain
- Blockchain settlement: deferred to Phase 7 as an optional rail, not the product identity

## Local development baseline for Intel Mac

- Docker is for infrastructure only: PostgreSQL, Redis, MinIO, MailHog
- Web, API, worker, tests, and typecheck run natively on macOS
- One command path for install and boot must remain documented and reproducible
- Avoid introducing local Kubernetes, secondary databases, search clusters, or event buses during Phases 0 through 6

## Package boundaries

- `apps/web`: marketing and product UI
- `apps/api`: control-plane HTTP API and realtime gateway later
- `apps/worker`: queues, retries, notifications, exports, demo playback
- `packages/config`: runtime config and product constants
- `packages/types`: shared enums and transport-safe types
- `packages/ui`: reusable visual primitives
- `packages/database`: Prisma schema, client, migrations, seeds
- `packages/auth`: session and authorization primitives
- `packages/domain`: domain helpers, state predicates, demo constants

## Explicit non-choices

- No microservices
- No Kubernetes
- No Supabase
- No separate seller frontend
- No Elasticsearch or OpenSearch in the first seven phases
- No blockchain-first payment strategy
- No Prisma `7.x` migration during active product buildout unless a dedicated ADR approves it

## Review cadence

- Revisit this baseline only at the end of a phase, not mid-phase.
- Any change to core runtime, database major, queue backend, auth strategy, or frontend architecture requires an ADR.

## Verified references

- Node releases: https://nodejs.org/en/about/previous-releases
- Next.js App Router: https://nextjs.org/docs/app
- React documentation: https://react.dev/
- NestJS migration guide: https://docs.nestjs.com/migration-guide
- Tailwind CSS v4: https://tailwindcss.com/blog/tailwindcss-v4
- Prisma documentation: https://www.prisma.io/docs
- Docker Desktop on Mac: https://docs.docker.com/desktop/setup/install/mac-install/
