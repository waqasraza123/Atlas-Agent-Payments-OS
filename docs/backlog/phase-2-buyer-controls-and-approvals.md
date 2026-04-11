# Phase 2 Buyer Controls and Approvals

## Goal

Deliver the first real buyer-side controlled-spend loop using real agent, policy, request, approval, and audit data.

## Dependencies

- Phase 1 complete
- actor context and route authorization in place
- audit-event writer available

## Workstreams

### 1. Buyer organization setup

- Build organization profile, team membership list, role assignment UI, and emergency stop control.
- Keep roles explicit: owner, admin, operator, approver, finance, viewer.
- Add API endpoints for membership reads and membership mutation by authorized actors only.

### 2. Agent management

- Build create, edit, activate, pause, and disable flows for agents.
- Store owner reference, purpose, linked policy, status, and summary metrics.
- Add agent detail timeline and recent request panels.

### 3. Policy management

- Build a readable policy authoring flow with per-action max, daily and weekly limits, seller allowlist, service allowlist, time windows, and approval thresholds.
- Version policies rather than overwriting them.
- Persist policy evaluation snapshots so every later request can explain what was matched.

### 4. Request creation and evaluation

- Add spend request API creation endpoint with idempotency key support.
- Persist request intent, requested service, amount, seller reference, and purpose metadata.
- Run policy evaluation synchronously on create.
- Produce one of three outcomes: auto-approved, approval-required, rejected.

### 5. Approval inbox

- Build approval list, filter set, request card, detail view, and action controls.
- Support approve, deny, escalate, and expire.
- Capture reason on every manual decision.
- Emit timeline and audit events for each state change.

## Technical deliverables

- NestJS modules for organizations, agents, policies, requests, approvals
- policy version and evaluation schema additions
- buyer route pages for organization setup, agent list/detail, policy list/detail, requests, approvals
- approval notification job contracts
- request timeline generation

## Acceptance criteria

- an authorized buyer user can create an agent and attach a policy
- an agent request can be submitted once and safely deduplicated
- policy evaluation explains whether the request was approved, escalated, or denied
- an approver can resolve the request and see the outcome in timeline form
- every mutation is auditable and attributable
