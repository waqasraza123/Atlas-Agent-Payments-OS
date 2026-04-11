# Phase 2 Core Buyer Workflow Detailed

## Goal

Deliver the first real buyer-side controlled-spend workflow.

## Why This Phase Exists

Phase 1 makes Atlas believable. Phase 2 makes the buyer-side control loop operational with real request, policy, approval, and audit behavior.

## Entry Criteria

- Phase 1 demo foundation is stable
- domain modules and seeds exist

## Current Status

Phase 2.1 through 2.5 now have a baseline in repo scope. Buyer agents and policies can be created and updated, spend requests can be submitted through real schema-backed write paths, policy evaluation now persists structured outcomes, and approvals can be decided with audit events. The next active step is Phase 2.6 request detail timeline and workflow stabilization before moving into Phase 3 seller workflow.

## Exit Criteria

- buyers can manage agents and policies
- buyers can create spend requests
- policy engine evaluates requests
- approvals can be reviewed and decided
- request timeline is real

## Detailed Sub-Steps

### Phase 2.1 — agent management

- list agents
- agent detail
- create and edit agent basics
- status management
- policy association
- recent request and approval summaries

### Phase 2.2 — policy management

- list policies
- policy detail
- create and edit policy
- version handling
- seller and service allowlists
- amount thresholds and approval thresholds

### Phase 2.3 — request creation

- spend request API
- validation
- idempotency strategy
- service and seller references
- amount and purpose capture
- actor and agent context capture

### Phase 2.4 — policy evaluation

- per-action max
- seller allowlist
- service allowlist
- auto-approval threshold
- organization emergency stop
- evaluation result persistence

### Phase 2.5 — approval workflow

- approvals inbox
- approve and deny actions
- audit events for decisions
- expiration support baseline
- clear request card and detail surface

### Phase 2.6 — request detail timeline

- request detail page
- timeline events across request and approval lifecycle
- reason visibility for approvals and policy outcomes
- reflect persisted evaluation results directly in the buyer detail surface
- tighten buyer-side e2e around create-to-detail progression

## Modules Touched

- `apps/web`
- `apps/api`
- `packages/database`
- `packages/domain`
- `packages/types`

## Deliverables

- buyer agent and policy management baseline
- real spend request creation path
- real approval inbox and decision flow
- request-level timeline inspectability

## Focused V1 Track Boundary

This phase is core focused-v1 product work. It should deliver a real buyer-side control loop for the narrow wedge before broader platform expansion.

## Full-Scale Platform Maturity Follow-Ons

Later tracks may add:

- delegated approvals
- department and cost-center governance
- external buyer APIs
- stronger compliance-facing exports

## Deferred

- payment execution
- seller fulfillment
- advanced enterprise policy models
- external API productization

## Verification Commands

- `pnpm build`
- `pnpm --filter @atlas/web build`
- `pnpm dev:web`
- `pnpm dev:api`
- request and approval lifecycle smoke tests

## Acceptance Criteria

- a real request can be created and move through policy and approval flow
- all key state changes are inspectable
