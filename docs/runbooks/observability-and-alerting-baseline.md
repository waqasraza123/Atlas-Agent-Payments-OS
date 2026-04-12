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

## Current Metrics Scope

- API request volume
- API server-error count
- API average and max request duration
- API in-flight request count
- API per-route request summaries
- Last readiness result and timestamp
- Worker queue readiness, processed-count, and failed-count snapshots in runtime logs

## Current Alert Sources

- invalid startup configuration
- degraded readiness status
- elevated API error rate
- critical operator cases
- unread operator notifications
- delayed operator cases

## Triage Order

1. Check `GET /health/startup` for configuration validity.
2. Check `GET /health/ready` for degraded dependencies.
3. Check `GET /health/metrics` for error rate, route concentration, and latency posture.
4. Check `/operator/alerts` for operator-visible alert aggregation.
5. Follow the linked runbook path on each alert before taking manual action.

## Current Limitations

- metrics are in-memory and process-local
- there is no long-term metrics retention yet
- there is no external alert dispatcher yet
- worker metrics are log-visible but not yet exposed through a shared metrics endpoint
- dashboards are operator-facing product surfaces, not a replacement for future APM tooling

## Verification

- `pnpm verify:ops`
- `curl -s http://localhost:4000/health/metrics`
- `curl -H "x-atlas-local-session: <token>" http://localhost:4000/observability/alerts`
