# Observability And Alerting Baseline

## Purpose

Define the minimum observability posture that Atlas now ships in-repo for broader rollout hardening.

## Runtime Surfaces

- API public health endpoints:
  - `GET /health`
  - `GET /health/live`
  - `GET /health/startup`
  - `GET /health/ready`
  - `GET /health/metrics`
- Operator observability endpoints:
  - `GET /observability/summary`
  - `GET /observability/metrics`
  - `GET /observability/alerts`
  - `GET /observability/incidents`
  - `GET /observability/incident-triggers`
  - `GET /observability/worker`
  - `GET /observability/snapshots`
  - `GET /observability/dispatches`

## Current Metrics Scope

- API request volume
- API server-error count
- API average and max request duration
- API in-flight request count
- API per-route request summaries
- API trace coverage and recent trace records
- Last readiness result and timestamp
- Worker queue readiness, processed-count, failed-count, trace coverage, and recent trace snapshots published into the shared runtime snapshot directory and exposed on the operator observability surface

## Current Alert Sources

- invalid startup configuration
- degraded readiness status
- elevated API error rate
- degraded API trace coverage
- degraded worker trace coverage
- critical operator cases
- unread operator notifications
- delayed operator cases

## Triage Order

1. Check `GET /health/startup` for configuration validity.
2. Check `GET /health/ready` for degraded dependencies.
3. Check `GET /health/metrics` for error rate, route concentration, and latency posture.
4. Check `/operator/alerts` for operator-visible alert aggregation, recent traces, and trace coverage posture.
5. Check `/observability/incident-triggers` for active durable incident triggers and linked report artifacts.
6. Follow the linked runbook path on each alert before taking manual action.

## Current Limitations

- API metrics are still process-local even though the latest API and worker runtime posture is published into shared JSON snapshots
- retained telemetry is operator-captured and stored as bounded repo-owned snapshots rather than continuous time-series history
- external alert dispatch is operator-triggered and currently limited to the owned generic-webhook and Slack webhook adapters
- repo-owned observability automation now exists for snapshot capture, optional dispatch, and durable incident-trigger sync, but it is still operator-invoked rather than timer-driven
- dashboards are operator-facing product surfaces, not a replacement for future APM tooling

## Verification

- `pnpm verify:ops`
- `pnpm observability:automation --actor-user-email operator-admin@atlas.local --reason "Validate shared observability automation posture."`
- `curl -s http://localhost:4000/health/metrics`
- `curl -H "x-atlas-local-session: <token>" http://localhost:4000/observability/alerts`
- `curl -H "x-atlas-local-session: <token>" http://localhost:4000/observability/incident-triggers`
- `curl -H "x-atlas-local-session: <token>" http://localhost:4000/observability/worker`
- `curl -H "x-atlas-local-session: <token>" http://localhost:4000/observability/snapshots`
- `curl -H "x-atlas-local-session: <token>" http://localhost:4000/observability/dispatches`
