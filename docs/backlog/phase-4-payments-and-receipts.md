# Phase 4 Payments and Receipts

This file is a summary companion. The authoritative implementation guide is [phase-4-payments-and-receipts-detailed.md](./phase-4-payments-and-receipts-detailed.md).

## Goal

Turn Atlas from a control-only system into a real payment execution and evidence platform.

## Dependencies

- Phase 3 complete
- seller service lifecycle operational
- worker queues stable

## Workstreams

### 1. Payment abstraction

- Introduce a payments domain with explicit interfaces for create intent, authorize, capture, confirm settlement, and fetch evidence.
- Keep payment intent, payment attempt, and settlement record separate.
- Add provider-neutral status normalization.

### 2. Stripe-first rail

- Integrate Stripe as the first real money rail.
- Store provider references, webhook event links, settlement timestamps, and failure reasons.
- Normalize Stripe outcomes into Atlas payment and settlement models.

### 3. Simulated deterministic rail

- Build an internal deterministic rail for demo reliability and local development.
- Support forced success, forced failure, delayed settlement, and delayed seller confirmation scenarios.
- Keep simulated evidence shaped like real evidence so receipts stay consistent.

### 4. Receipts

- Generate durable receipt records that reference request, approval, payment, seller, amount, policy snapshot, and evidence objects.
- Store receipt metadata in Postgres and artifact payloads in MinIO.
- Add receipt detail pages and export preparation hooks.

### 5. Reconciliation and retries

- Add retry rules, duplicate prevention, and reconciliation states for payment-succeeded-but-delivery-pending and approval-complete-but-payment-failed flows.
- Add worker jobs for provider webhook reconciliation and delayed checks.

## Technical deliverables

- payment abstraction package or domain module
- Stripe adapter plus simulated adapter
- schema additions for payment attempts, settlement records, receipt artifacts
- webhook ingestion and retry worker contracts
- receipt detail surfaces in buyer, seller, and operator views

## Acceptance criteria

- an approved request can produce a payment intent and payment attempt
- payment settlement outcome is visible in Atlas-native states
- a durable receipt can be generated from a completed request
- failure and retry states are inspectable
- buyer, seller, and operator screens all show the same underlying truth
