# Phase 5 Operator Controls Detailed

## Goal

Make Atlas trustworthy under failure and edge conditions, not only under happy path.

## Why This Phase Exists

Production trust comes from failure handling, case ownership, audit clarity, and safe operational actions. This phase makes those trust surfaces real.

## Entry Criteria

- payment and receipt flows exist

## Exit Criteria

- operator center exists
- exception queue exists
- safe operator actions exist
- audit explorer is powerful enough for real investigation

## Detailed Sub-Steps

### Phase 5.1 — operator overview and search

- operator dashboard
- cross-entity search
- status and risk summaries

### Phase 5.2 — exception types and case model

- case schema
- exception states
- actor and ownership tracking
- lifecycle for investigation and resolution

### Phase 5.3 — safe operator actions with reason capture

- pause
- requeue
- annotate
- override
- audit every operator action

### Phase 5.4 — audit explorer

- filterable timeline explorer
- entity drill-down
- actor causality views
- export-ready investigation view

### Phase 5.5 — notification expansion

- exception notifications
- operator attention queue
- delayed settlement alerts

## Modules Touched

- `apps/web`
- `apps/api`
- `apps/worker`
- `packages/database`
- `packages/domain`

## Deliverables

- operator dashboard and exception center
- operator case model
- safe operator actions with reason capture
- audit explorer

## Focused V1 Track Boundary

This phase is part of the production-grade focused v1 track because operator trust surfaces are required before real-world rollout of the narrow wedge.

## Full-Scale Platform Maturity Follow-Ons

Later tracks may add:

- richer internal support workflows
- incident-specific tooling
- case ownership automation
- broader export and evidence packaging

## Verification Commands

- `pnpm build`
- operator workflow smoke tests

## Acceptance Criteria

- Atlas can be trusted operationally under failure and investigation scenarios

## Repo Status

- Phase 5 is now complete in repo scope
- operator case modeling now exists through persisted operator cases, actions, and notifications
- operator overview, exception queue, case detail, and audit explorer routes now exist in the web app
- guarded operator APIs now exist for overview, case listing, case detail, notifications, actions, and audit-event filtering
- reason-captured operator actions now write durable action records and audit events
- the next active execution slice is Phase 6 analytics, export readiness, and enterprise polish
