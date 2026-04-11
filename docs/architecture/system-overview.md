# System Overview

## Product shape

Atlas Agent Payments OS is a single-platform control plane for managed AI agent spending. Human operators and organization admins define who can spend, what can be purchased, under which limits, and how those decisions are reviewed. The system then records requests, approvals, payments, receipts, and audit events around that control surface.

## Runtime components

### Web app

- One Next.js App Router application.
- Uses route groups for marketing, buyer, seller, and operator surfaces.
- Hosts premium demo routes and future product workflows in a unified shell.

### API

- One NestJS application.
- Owns synchronous control-plane APIs and request validation.
- Exposes health checks and future modules for organizations, agents, policies, requests, approvals, payments, receipts, and audit access.

### Worker

- One BullMQ-backed Node worker.
- Owns background execution, notifications, receipt ingestion, and future payment orchestration jobs.

### Shared packages

- `config`: runtime settings and product constants
- `types`: shared domain types and enums
- `ui`: shared React components
- `database`: Prisma schema, client, and seed path
- `auth`: placeholder auth contracts for future session handling
- `domain`: business-oriented helpers and demo constants

## Data stores

- PostgreSQL is the source of truth for organizations, users, agents, policies, approvals, requests, payments, receipts, and audit trails.
- Redis supports job queues and future short-lived coordination data.
- MinIO stores local receipt assets and future uploaded artifacts.
- MailHog captures outbound email locally without introducing a third-party dependency.

## Primary flow shape

1. A buyer organization creates or registers agents.
2. Human admins define policies and approval requirements.
3. An agent submits a spend request for a paid API or digital service.
4. The API validates and stores the request.
5. The worker processes asynchronous steps.
6. Payment and receipt records are persisted.
7. Audit events capture the lifecycle for operator review.

## Out of scope for the current foundation

- Physical inventory or order fulfillment
- Settlement with real payment processors
- Blockchain-based settlement or wallets
- Multi-service network deployment
