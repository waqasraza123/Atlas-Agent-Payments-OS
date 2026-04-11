# Testing Strategy

## Purpose

This document defines the testing baseline for Atlas Agent Payments OS as the repo moves from scaffold to real product implementation. It keeps verification durable, explicit, and aligned with the current focused v1 build track.

## Current Testing Layers

- Unit tests for shared auth contracts in `packages/auth`
- Unit tests for shared domain registry and route definitions in `packages/domain`
- Unit tests for shared config, type guards, UI primitives, and database seed contracts in `packages/config`, `packages/types`, `packages/ui`, and `packages/database`
- Unit tests for worker queue catalog and processor registry in `apps/worker`
- API e2e tests in `apps/api/test`
- Web unit and route tests in `apps/web/src`
- Web HTTP smoke e2e tests in `apps/web/e2e`

## Current Commands

- `pnpm test`
- `pnpm test:e2e`
- `pnpm --filter @atlas/api test`
- `pnpm --filter @atlas/api test:e2e`
- `pnpm --filter @atlas/web test`
- `pnpm --filter @atlas/web test:e2e`
- `pnpm --filter @atlas/auth test`
- `pnpm --filter @atlas/domain test`
- `pnpm --filter @atlas/database test`
- `pnpm --filter @atlas/worker test`
- `pnpm verify:phase0`

## What Is Covered Now

- local session selection parsing and serialization
- workspace and role access helper behavior
- shared workspace surface definitions and API module registry contracts
- shared queue definitions and worker processor coverage
- seed manifest lifecycle coverage and local-session membership alignment
- API health route
- API module registry route
- API queue registry route
- actor-guard edge cases for missing header, unavailable actor resolution, forbidden workspace access, and allowed shared-module access
- web local-session route behavior
- web workspace shell rendering and route-aware navigation state
- marketing page and workspace route HTTP smoke paths

## Immediate Gaps

- no buyer request, policy evaluation, seller workflow, payment, or receipt lifecycle tests yet
- no browser-level interaction suite yet
- no seeded database integration suite yet because local database access is not reliable on this machine

## Testing Standard For New Slices

- add unit coverage for pure helpers and shared contracts
- add integration coverage when a slice introduces routing, data loading, or state transitions
- add or extend API e2e coverage when a slice adds or changes HTTP behavior
- add or extend web smoke coverage when a slice changes major user-visible routes
- add edge-case assertions for invalid input, unauthorized access, forbidden access, and unavailable dependency paths

## Edge-Case Priority Order

1. authorization and tenancy boundary failures
2. invalid or malformed input
3. unavailable dependency behavior
4. idempotency and duplicate-action handling
5. lifecycle-state mismatch handling
6. export, audit, and reconciliation correctness

## Phase-Aligned Test Expansion Plan

### Phase 0

- finish baseline tests for UI primitives, worker queue contracts, and database seed helpers
- keep API actor and module registry coverage green
- keep web shell and session route coverage green

### Phase 1

- add marketing narrative smoke expansion
- add buyer, seller, and operator overview snapshot and HTTP smoke coverage

### Phase 2

- add request creation, policy evaluation, and approval workflow unit, integration, and e2e coverage
- add idempotency and approval-expiration edge-case tests

### Phase 3

- add seller service, request intake, and fulfillment-path tests
- add seller webhook contract and retry tests

### Phase 4

- add payment rail contract tests
- add payment attempt and receipt lifecycle tests
- add reconciliation and delayed-confirmation edge-case tests

### Phase 5

- add operator case and exception-routing tests
- add audit explorer and support-safe action tests

### Phase 6

- add analytics and export correctness tests
- add performance-aware search and filtering coverage

### Phase 7

- add programmable settlement rail tests
- add on-chain evidence normalization tests

## Operational Notes

- root `pnpm build` is still typecheck-only
- root `pnpm test` now exercises the current automated unit and integration baseline
- root `pnpm test:e2e` exercises API e2e and web HTTP smoke coverage
- current web e2e is server-level smoke coverage, not full browser automation
- current API e2e avoids real database dependency by overriding actor resolution in-process

## Definition Of Test-Ready

A slice is not test-ready until:

- the main success path is covered
- the highest-risk edge cases are covered
- auth and workspace boundaries are covered when relevant
- verification commands are documented
- `pnpm test` and any new relevant e2e command pass
