# Atlas Agent Payments OS

Atlas Agent Payments OS is a premium B2B platform for safely giving AI agents controlled purchasing power across paid APIs and digital services. The first release is intentionally narrow: establish a production-grade foundation for buyer organizations, seller organizations, operators, agents, policies, approvals, requests, payments, receipts, audit trails, and premium demo flows without implementing full product behavior yet.

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

## Initial layout

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

## Phase 0 foundation milestone

Phase 0 is complete when a new engineer can clone the repo, install dependencies, start local infrastructure, generate and migrate the database, run the web app, API, and worker natively, and verify:

- `/` renders the marketing placeholder
- `/buyer`, `/seller`, and `/operator` route placeholders load
- `GET /health` returns a healthy API response
- the worker connects to Redis and boots its placeholder queue processor
- shared packages typecheck cleanly

## Repo conventions

- Build directly in the repo root. No nested project shell.
- Docker is reserved for infrastructure only.
- Application processes run natively for faster Intel Mac feedback loops.
- Keep modules small, typed, and explicit.
- Put assumptions and tradeoffs in docs, not code comments.
- Avoid introducing features before the domain boundary for them is documented.

## Local development

1. Use Node `24.x`.
2. Copy `.env.example` to `.env`.
3. Run `pnpm install`.
4. Run `pnpm infra:up`.
5. Run `pnpm db:generate`.
6. Run `pnpm db:migrate`.
7. Run `pnpm db:seed`.
8. Start apps with `pnpm dev`, or target one process with `pnpm dev:web`, `pnpm dev:api`, or `pnpm dev:worker`.

Detailed setup guidance lives in [docs/runbooks/local-development-intel-mac-2019.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/runbooks/local-development-intel-mac-2019.md).

## Architecture docs

- [technical-execution-plan.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/architecture/technical-execution-plan.md)
- [stack-baseline.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/architecture/stack-baseline.md)
- [system-overview.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/architecture/system-overview.md)
- [domain-boundaries.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/architecture/domain-boundaries.md)
- [0001-monorepo-stack.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/decisions/0001-monorepo-stack.md)

## Product and roadmap docs

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
