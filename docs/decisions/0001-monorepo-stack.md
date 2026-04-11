# ADR 0001: Monorepo Stack

## Status

Accepted

## Context

Atlas Agent Payments OS is a new product with one core product team, one web surface, one API, and one worker. The immediate need is fast local iteration, shared types, explicit domain boundaries, and a structure that supports future operational rigor without incurring platform complexity too early.

## Decision

Adopt a TypeScript monorepo with:

- Node.js 24
- `pnpm` workspaces
- Turborepo
- Next.js App Router for `apps/web`
- NestJS for `apps/api`
- BullMQ and Redis for `apps/worker`
- PostgreSQL and Prisma
- MinIO for local object storage
- Docker Compose for infrastructure only

## Why this stack

- One language across frontend, backend, worker, and shared packages reduces translation cost.
- `pnpm` workspaces keep local installs fast and disk-efficient on an older Intel laptop.
- Turborepo provides simple task orchestration without forcing service decomposition.
- Next.js gives a strong path for route-grouped product surfaces and marketing in one app.
- NestJS supports modular backend growth with clear domain modules.
- BullMQ gives a pragmatic async job model without introducing a second backend platform.
- Prisma accelerates schema evolution and keeps the early data model explicit.
- Docker Compose local infra keeps the machine setup repeatable while preserving native app process speed.

## Rejected alternatives

- Multiple frontends: rejected because one web app is enough for this phase.
- Microservices: rejected because the team and product are too early.
- Kubernetes: rejected because local and operational complexity would outweigh value.
- Supabase: rejected because the stack needs direct control over auth, data model, and background processing shape.
- Stripe-first integration: rejected because the payment domain must be modeled before a provider is wired in.

## Consequences

- Internal package boundaries matter; poor boundaries will create tight coupling quickly.
- Local native process tooling must stay simple and well-documented.
- The repo should favor explicit scripts over magic wrappers.
