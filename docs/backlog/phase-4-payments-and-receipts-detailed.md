# Phase 4 Payments and Receipts Detailed

## Goal

Turn Atlas into a true governed payments platform by implementing payment execution and durable receipt truth.

## Why This Phase Exists

Phases 0 through 3 build trust, structure, and two-sided workflows. Phase 4 turns that governed workflow into a real payment and evidence system.

## Entry Criteria

- buyer and seller flows exist

## Exit Criteria

- payment rail abstraction is real
- internal simulated rail is fully usable
- Stripe rail baseline exists
- payment attempts are immutable
- receipts are finalized from real lifecycle state

## Detailed Sub-Steps

### Phase 4.1 — payment rail abstraction

- define rail contracts
- define payment intent state handling
- define attempt state normalization
- keep payment intent, attempt, and evidence separate

### Phase 4.2 — internal simulated settlement rail

- deterministic success path
- deterministic failure path
- delayed settlement path
- evidence shape that matches later real rails

### Phase 4.3 — Stripe rail integration

- create Stripe payment intent baseline
- normalize external references
- map webhook outcomes
- keep Stripe hidden behind the rail abstraction

### Phase 4.4 — payment attempt lifecycle and retries

- immutable attempts
- retry eligibility
- attempt sequencing
- duplicate protection

### Phase 4.5 — receipt generation and evidence model

- request-to-receipt mapping
- payment evidence mapping
- fulfillment mapping
- export-friendly receipt shape

### Phase 4.6 — reconciliation and delayed confirmation views

- payment pending
- payment failed
- awaiting seller confirmation
- delayed receipt evidence

## Modules Touched

- `apps/api`
- `apps/worker`
- `apps/web`
- `packages/database`
- `packages/domain`

## Deliverables

- real payment rail abstraction
- internal simulated rail
- Stripe baseline
- immutable payment attempts
- durable receipts with evidence

## Focused V1 Track Boundary

This phase is required for a production-grade focused v1 because the control plane must execute and prove the purchase lifecycle, not just model it.

## Full-Scale Platform Maturity Follow-Ons

Later tracks may add:

- additional rails
- invoicing or credits
- richer reconciliation operations
- stronger financial evidence exports

## Deferred

- on-chain settlement
- refunds beyond minimal placeholder
- broader billing system maturity
- finance-system integration depth

## Verification Commands

- `pnpm build`
- payment lifecycle smoke test
- receipt finalization smoke test

## Acceptance Criteria

- Atlas can execute, prove, and record digital purchases with durable receipts
