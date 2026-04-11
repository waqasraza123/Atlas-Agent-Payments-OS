# Phase 5 Operator Controls and Exceptions

This file is a summary companion. The authoritative implementation guide is [phase-5-operator-controls-detailed.md](./phase-5-operator-controls-detailed.md).

## Goal

Make Atlas trustworthy under failure, review, and investigation scenarios.

## Dependencies

- Phase 4 complete
- receipt and payment evidence available

## Workstreams

### 1. Operator center

- Build platform-wide search, KPI overview, exception inbox, investigation detail, and action log surfaces.
- Support cross-entity lookup for organizations, agents, requests, payments, receipts, and services.

### 2. Exception model

- Define exception categories: approval expired, payment failed, duplicate blocked, seller callback missing, suspicious pattern, settlement delayed, metadata incomplete.
- Track status, owner, severity, opened-at, resolved-at, and resolution notes.

### 3. Safe operator actions

- Add pause organization, pause agent, requeue webhook, retry delivery check, annotate case, and override-with-reason actions.
- Gate every operator action by explicit permission and audit record.

### 4. Audit explorer

- Build a grouped timeline explorer with filters by actor, entity, date, event type, and organization.
- Support export-ready evidence bundles for investigation and customer support use.

### 5. Notification handling

- Add notifications for approval deadlines, failed payments, delayed deliveries, unusual activity, and case resolution.
- Keep notification records and delivery attempts visible.

## Technical deliverables

- operator domain module
- exception schema and APIs
- search and filter contracts for cross-entity lookup
- audited operator action handlers
- notification queue flows and delivery logs

## Acceptance criteria

- an operator can investigate a failed or suspicious flow without engineering help
- operator actions are reasoned, scoped, and audited
- exception lists are filterable and actionable
- audit explorer explains entity history cleanly
