# Phase 3 Seller Workflow Detailed

## Goal

Let sellers publish services and participate in the spend lifecycle with observable request and delivery behavior.

## Why This Phase Exists

Atlas is not credible as an Agent Payments OS until the seller side of the lifecycle is visible, manageable, and linked to buyer request behavior.

## Entry Criteria

- Phase 2 buyer flow is stable

## Exit Criteria

- sellers can create services
- pricing exists
- buyer requests can target seller services
- seller can confirm or fail delivery
- seller overview is meaningful

## Detailed Sub-Steps

### Phase 3.1 — seller profile and team baseline

- seller organization profile
- seller team roles
- seller settings baseline

### Phase 3.2 — services list and detail

- service list
- service detail
- category and metadata
- visibility and availability

### Phase 3.3 — pricing baseline

- fixed-price baseline
- clear amount and currency handling
- room for future usage-based models

### Phase 3.4 — publish and unpublish flow

- draft service
- published service
- archived service

### Phase 3.5 — inbound request monitoring

- seller request list
- request detail visibility
- buyer organization context and delivery status

### Phase 3.6 — fulfillment outcome handling

- confirm delivery
- fail delivery
- attach outcome metadata
- surface downstream effect on request and receipt state

### Phase 3.7 — seller-side analytics summaries

- top services
- top buyers
- request success and failure mix

## Modules Touched

- `apps/web`
- `apps/api`
- `packages/database`
- `packages/domain`

## Deliverables

- seller onboarding baseline
- service catalog management
- inbound request monitoring
- seller-side delivery outcomes and summaries

## Focused V1 Track Boundary

This phase completes the two-sided focused v1 product. It should prioritize credible seller participation over broader partner-program or marketplace complexity.

## Full-Scale Platform Maturity Follow-Ons

Later tracks may add:

- seller verification workflows
- richer seller API onboarding
- partner-quality and trust scoring
- broader payout and billing operations

## Deferred

- real payout system
- complex webhook retries beyond baseline
- seller verification programs
- marketplace expansion

## Verification Commands

- `pnpm build`
- buyer-to-seller seeded flow walkthrough

## Acceptance Criteria

- sellers can meaningfully participate in the lifecycle
- buyer requests can target seller services and display seller-side outcomes
