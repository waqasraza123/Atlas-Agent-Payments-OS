# Technical Execution Plan

This file is now a summary companion. The authoritative execution source of truth is [master-execution-plan.md](./master-execution-plan.md).

## Objective

Deliver Atlas Agent Payments OS as a single monorepo with one premium web surface, one API, one worker, and a shared domain model that can grow into approvals, payments, receipts, auditability, and programmable settlement without a structural rewrite.

## Current baseline

- The repository already contains the initial monorepo scaffold, root tooling, local infrastructure definitions, shared package shells, and placeholder web, API, and worker entrypoints.
- This document replaces the earlier thin roadmap and becomes the execution source of truth for the remaining build.
- Phase delivery order is fixed unless a later architecture decision explicitly changes it.

## Explicit stack baseline

The authoritative stack choices live in [stack-baseline.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/architecture/stack-baseline.md). The short version:

- Node.js `24.x`
- `pnpm` workspaces and Turborepo
- TypeScript `6.x`
- Next.js App Router and React `19.2`
- Tailwind CSS `4.x`
- NestJS `11.x`
- BullMQ `5.x`
- Prisma `6.19.x`
- PostgreSQL `16` and Redis `7` for the initial local baseline on Intel Mac
- MinIO and MailHog in Docker Compose
- Stripe introduced in Phase 4
- Onchain settlement introduced in Phase 7, not before

## Delivery rules

- Keep one Next.js app. Separate buyer, seller, operator, and marketing by route groups and authorization, not separate frontends.
- Keep one API and one worker inside the monorepo. Do not split to microservices during Phases 0 through 6.
- Keep app processes native on macOS. Docker remains infra-only for PostgreSQL, Redis, MinIO, and MailHog.
- Do not upgrade core infrastructure majors during active feature phases unless an ADR is written first.
- Model request, approval, payment, settlement, receipt, and audit as separate lifecycles.
- Treat timeline and audit event generation as a product requirement, not an observability add-on.

## Phase order

1. Phase 0: Foundation hardening and platform baseline
2. Phase 1: Public narrative and premium demo system
3. Phase 2: Buyer controls, policies, and approvals
4. Phase 3: Seller services and digital delivery workflows
5. Phase 4: Payment execution and receipt truth layer
6. Phase 5: Operator controls, exceptions, and trust surface
7. Phase 6: Analytics, reporting, and enterprise polish
8. Phase 7: Programmable settlement extension

## Phase summaries

### Phase 0: Foundation hardening and platform baseline

- Finish the repo baseline so a new engineer on a 2019 Intel Mac can install, boot infra, migrate, seed, and run the three app processes without hidden setup work.
- Replace placeholder-only structure with real auth boundaries, route shells, audit plumbing, seeded demo records, and operational guardrails.
- Exit only when the repo can support Phase 1 and Phase 2 work without revisiting core scaffolding.

### Phase 1: Public narrative and premium demo system

- Build the premium story surface that makes Atlas understandable in minutes.
- Use real seeded domain objects to power demo flows so the marketing and demo layer stays compatible with later functional work.
- Exit only when a guided buyer-to-seller-to-receipt story can be demonstrated inside the real product shell.

### Phase 2: Buyer controls, policies, and approvals

- Deliver the first usable buyer-side loop: create agent, define policy, submit request, evaluate policy, route approval, resolve approval, inspect timeline.
- Introduce policy versioning and approval artifacts early so historical state remains explainable.
- Exit only when the control plane feels operationally real from the buyer perspective.

### Phase 3: Seller services and digital delivery workflows

- Deliver the first seller-side loop: create service, publish price, receive paid request context, report delivery outcome, inspect request history.
- Keep seller concepts narrow to digital services and paid APIs.
- Exit only when the platform credibly supports both sides of a controlled digital transaction.

### Phase 4: Payment execution and receipt truth layer

- Introduce real payment orchestration with a Stripe-first rail plus a deterministic simulated rail for demo reliability.
- Build durable receipt generation, settlement evidence, retry handling, and reconciliation views.
- Exit only when Atlas can prove what happened, not just approve what should happen.

### Phase 5: Operator controls, exceptions, and trust surface

- Deliver investigation, pause, requeue, annotate, and export capabilities so failure paths are handled with the same quality as success paths.
- Make operator actions audited, reasoned, and bounded by explicit permissions.
- Exit only when the platform looks trustworthy under exceptions and partial failures.

### Phase 6: Analytics, reporting, and enterprise polish

- Add buyer, seller, and platform analytics; export paths; stronger search and filter behavior; and accessibility and dense-data polish.
- Push the product from strong demo quality to design-partner-ready.
- Exit only when stakeholder reporting, keyboard flow, empty states, and detail surfaces feel complete enough for external evaluation.

### Phase 7: Programmable settlement extension

- Add wallet registry, allowed settlement rails, transaction proof capture, and unified offchain/onchain evidence mapping.
- Keep blockchain as an optional settlement rail, not the product identity.
- Exit only when onchain and offchain payment evidence appear as one coherent Atlas timeline.

## Cross-phase implementation rules

- Every major mutation emits an audit event and timeline event in the same transaction boundary or in a guaranteed follow-up job.
- Policy evaluation results are immutable historical records tied to a policy version.
- Approval decisions are append-oriented and never lose approver reason context.
- Payment attempts are immutable, sequential, and idempotency-aware.
- Receipt records must be reconstructable from database state plus object storage evidence.
- Demo mode must use seeded real entities, not a separate fake frontend-only store.

## Risks

- NestJS, Next.js, Prisma, and BullMQ are all productive together, but careless package coupling can create slow local feedback loops.
- Over-modeling the payment domain too early would add schema churn before request, approval, and seller workflows are proven.
- Running local infra on older Intel hardware requires memory discipline, especially around Docker and browser tabs.
- Mixing real and fake demo data models would create rework and broken trust signals.
- Pulling blockchain into the core narrative too early would weaken B2B buyer credibility.

## Guardrails

- No second web app and no service decomposition during active product discovery.
- No Kubernetes, service mesh, Kafka, or search cluster in the first seven phases.
- No real blockchain settlement before the payment abstraction, receipts, and operator workflows are already proven offchain.
- Avoid infrastructure majors during feature execution unless a migration step is itself a planned milestone.
- Use the phase backlog docs below as the implementation checklist for each phase:
  - [docs/backlog/README.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/backlog/README.md)
