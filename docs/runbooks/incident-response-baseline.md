# Incident Response Baseline

## Purpose

Define the current minimum operator incident-response posture for Atlas.

## Incident Entry Points

- `/operator/alerts`
- `/operator/exceptions`
- `/operator/transactions`
- `/operator/receipts`
- `/operator/audit`

## Initial Incident Types

- degraded API readiness
- invalid runtime configuration during release promotion
- elevated API server-error rate
- payment or settlement failure escalation
- receipt evidence drift
- seller-confirmation delay
- operator case backlog or unread alert accumulation

## First Response Workflow

1. Confirm runtime posture through `/health/startup`, `/health/ready`, and `/health/metrics`.
2. Review `/operator/alerts` for consolidated runtime and operator alert state.
3. Open the linked operator case or transaction route.
4. Review request, payment, receipt, and audit continuity before taking action.
5. Capture an explicit reason for every operator action that changes system posture.
6. If payment or receipt evidence is unclear, pause the affected lifecycle before retrying.

## Required Evidence Before Action

- request id
- current request status
- payment status and attempt history
- receipt status
- operator-case history
- latest audit events
- reason for intervention

## Current Constraints

- there is no automated paging integration yet
- there is no external incident timeline store yet
- support-access hardening and tenant-isolation hardening are still a next-track item
- backup restore remains operator-invoked and repo-driven rather than automated

## Verification

- `pnpm verify:release`
- `pnpm verify:ops`
- `pnpm verify:rollback`
