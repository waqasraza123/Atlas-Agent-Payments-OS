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

## Verification Commands

- `pnpm build`
- operator workflow smoke tests

## Acceptance Criteria

- Atlas can be trusted operationally under failure and investigation scenarios
