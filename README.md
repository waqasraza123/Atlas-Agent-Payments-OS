# Atlas Agent Payments OS

[![Phase](https://img.shields.io/badge/phase-0_foundation-0b1320?style=for-the-badge)](./docs/backlog/phase-0-foundation.md)
[![Scope](https://img.shields.io/badge/scope-paid_APIs_%26_digital_services-0f766e?style=for-the-badge)](./docs/product/product-spec-v1.md)
[![License](https://img.shields.io/badge/license-Apache_2.0-1d4ed8?style=for-the-badge)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-24.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.x-F69220?style=for-the-badge&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Next.js](https://img.shields.io/badge/next.js-16.x-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/nest-11.x-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Prisma](https://img.shields.io/badge/prisma-6.19-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/tailwind-4.x-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

Atlas Agent Payments OS is a premium B2B control plane for safely giving AI agents spending power across paid APIs and digital services. Atlas sits between agents and paid digital actions and provides approvals, policy controls, payment orchestration, receipts, and auditability.

## Why Atlas

- Controlled autonomy for AI agent spending
- Buyer, seller, and operator workflows in one product surface
- Durable records for requests, approvals, payments, receipts, and audit trails
- Architecture optimized for fast local iteration on a 2019 Intel MacBook Pro
- Monorepo foundation designed for production-grade growth, not throwaway demos

## Product summary

- Buyer organizations define which agents can spend and under what controls.
- Seller organizations represent API and digital service providers.
- Operators run oversight workflows and platform operations.
- Policies, approvals, requests, payments, receipts, and audit trails form the control surface.
- The current scope is paid APIs and digital services only.

## Stack

- Monorepo with `pnpm` workspaces and Turborepo
- Node.js 24 target
- `apps/web`: Next.js App Router with Tailwind CSS
- `apps/api`: NestJS
- `apps/worker`: Node TypeScript worker with BullMQ
- PostgreSQL with Prisma
- Redis
- MinIO for local object storage
- MailHog for local SMTP capture
- Shared internal packages for config, types, ui, database, auth, and domain helpers

## Current repo status

- Current phase: Phase 0 foundation hardening
- Current build gate: `pnpm build`
- Current safe push path: `pnpm safe-push`
- Current local runtime model: Docker for infra, native processes for web, API, and worker

## Repository layout

```text
apps/
  api/
  web/
  worker/
packages/
  auth/
  config/
  database/
  domain/
  types/
  ui/
infra/
  docker/
docs/
scripts/
```

## Quick start

1. Use Node `24.x`.
2. Copy `.env.example` to `.env`.
3. Run `pnpm install`.
4. Run `pnpm hooks:install`.
5. Run `pnpm infra:up`.
6. Run `pnpm db:generate`.
7. Run `pnpm db:migrate`.
8. Run `pnpm db:seed`.
9. Start apps with `pnpm dev`, `pnpm dev:web`, `pnpm dev:api`, or `pnpm dev:worker`.

Detailed local guidance lives in [local-development-intel-mac-2019.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/runbooks/local-development-intel-mac-2019.md).

## Standard verification

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm verify:push`

## Phase 0 milestone

Phase 0 is complete when a new engineer can clone the repo, install dependencies, start local infrastructure, generate and migrate the database, run the web app, API, and worker natively, and verify:

- `/` renders the marketing placeholder
- `/buyer`, `/seller`, and `/operator` route placeholders load
- `GET /health` returns a healthy API response
- the worker connects to Redis and boots its placeholder queue processor
- shared packages typecheck cleanly

## Repository rules

- Build directly in the repo root. No nested project shell.
- Docker is reserved for infrastructure only.
- Application processes run natively for faster Intel Mac feedback loops.
- Keep modules small, typed, and explicit.
- Put assumptions and tradeoffs in docs, not code comments.
- Avoid introducing features before the domain boundary for them is documented.

## Documentation

- [technical-execution-plan.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/architecture/technical-execution-plan.md)
- [stack-baseline.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/architecture/stack-baseline.md)
- [system-overview.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/architecture/system-overview.md)
- [domain-boundaries.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/architecture/domain-boundaries.md)
- [0001-monorepo-stack.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/decisions/0001-monorepo-stack.md)
- [product-spec-v1.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/product/product-spec-v1.md)
- [docs/backlog/README.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/backlog/README.md)
- [phase-0-foundation.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/backlog/phase-0-foundation.md)
- [phase-1-public-narrative-and-demo.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/backlog/phase-1-public-narrative-and-demo.md)
- [phase-2-buyer-controls-and-approvals.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/backlog/phase-2-buyer-controls-and-approvals.md)
- [phase-3-seller-services-and-delivery.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/backlog/phase-3-seller-services-and-delivery.md)
- [phase-4-payments-and-receipts.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/backlog/phase-4-payments-and-receipts.md)
- [phase-5-operator-controls-and-exceptions.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/backlog/phase-5-operator-controls-and-exceptions.md)
- [phase-6-analytics-reporting-and-polish.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/backlog/phase-6-analytics-reporting-and-polish.md)
- [phase-7-programmable-settlement-extension.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/backlog/phase-7-programmable-settlement-extension.md)
- [collaboration-guide.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/collaboration-guide.md)

## Collaboration and governance

- [CONTRIBUTING.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/CONTRIBUTING.md)
- [SECURITY.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/SECURITY.md)
- [LICENSE](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/LICENSE)
- [AGENTS.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/AGENTS.md)

## Intentionally out of scope for now

- Real authentication and identity provider integration
- Real payment rails or Stripe integration
- Blockchain features
- Physical goods or shipping workflows
- Microservices and Kubernetes
- Seller onboarding UX beyond placeholder routes
- Production deployment manifests

## Risks and guardrails

- Spend controls are core product behavior, so control-plane concepts are scaffolded early even before business logic exists.
- Node 24 is the target runtime even if a local machine is temporarily on another version.
- Shared packages must remain thin. Business workflows belong in app modules or dedicated domain services, not in utility packages.
- Local development favors low-memory defaults and native process startup over heavy orchestration.

## License

This repository is licensed under Apache-2.0. See [LICENSE](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/LICENSE).
