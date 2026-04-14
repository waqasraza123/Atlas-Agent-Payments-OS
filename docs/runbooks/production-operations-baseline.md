# Production Operations Baseline

## Purpose

This runbook defines the repo-level operational baseline that now exists after the post-v1 rollout-hardening slice.

## Current Baseline

- structured runtime config for app environment, release stage, log level, and healthcheck timeout
- structured JSON logging for API and worker runtime events
- API request correlation through `x-atlas-request-id`
- API trace propagation through `x-atlas-trace-id`, `x-atlas-span-id`, and `traceparent`
- API live, startup, readiness, and metrics endpoints under `/health`
- operator observability routes for metrics, alerts, and incident readiness
- retained observability snapshot capture plus persisted snapshot and dispatch history on `/operator/alerts`
- shared API and worker runtime snapshots plus worker telemetry visibility on `/operator/alerts`
- recent API and worker trace visibility plus incident-trigger visibility on `/operator/alerts`
- release verification script through `pnpm verify:release`
- runtime smoke verification script through `pnpm verify:ops`
- environment-template validation through `pnpm verify:env`
- release manifest generation through `pnpm release:manifest`
- rollback-readiness verification through `pnpm verify:rollback`
- repo-owned backup and restore scripts through `pnpm db:backup` and `pnpm db:restore`
- S3-compatible rollout proof replication through the operations artifact bucket when proof storage is enabled
- GitHub Actions promotion dispatch and AWS Secrets Manager rotation dispatch through the rollout adapters
- governed external alert dispatch through owned generic-webhook, Slack webhook, PagerDuty Events, and Opsgenie adapters plus `ALERT_DISPATCH` operational integrations
- repo-owned observability automation through `pnpm observability:automation`
- worker-scheduled observability automation through `OBSERVABILITY_AUTOMATION_SCHEDULE_MODE=interval`
- explicit telemetry-ownership policy through `OBSERVABILITY_AUTOMATION_TELEMETRY_POLICY=monitor|recover`
- explicit repeated-breach escalation through `OBSERVABILITY_AUTOMATION_TELEMETRY_ESCALATION_THRESHOLD`
- durable incident-trigger sync plus incident report artifact generation through observability automation
- durable telemetry-ownership recovery reports and policy-aware automation history through the worker scheduler and `/operator/alerts`
- explicit operator alerts when telemetry auto-recovery fails or still leaves ownership degraded
- explicit critical operator alerts when telemetry auto-recovery breaches the configured threshold across consecutive runs
- recover-mode automation now raises same-cycle incident and optional paging posture from the post-recovery alert set when ownership remains degraded
- recover-mode automation failure handling now synthesizes same-cycle snapshot, incident-trigger, and optional paging posture from the failure state when recovery aborts before post-recovery status can be computed
- `/operator/alerts` now exposes a guided telemetry-remediation plan plus a one-click recommended response so operators can run the owned recovery path directly from the current remediation posture
- explicit observability retention windows plus automated retention sweeps for retained snapshots, dispatch reports, incident reports, and automation reports
- GitHub Actions release gate in `.github/workflows/release-gate.yml`
- web security headers baseline through `next.config.ts`

## Release Verification

Run this before a broader rollout candidate:

1. `pnpm install`
2. `pnpm db:generate`
3. `pnpm verify:env`
4. `pnpm verify:release`

## Runtime Smoke Verification

With the API running:

1. `pnpm verify:ops`
2. Confirm `/health`, `/health/live`, `/health/startup`, `/health/ready`, and `/health/metrics` return expected status payloads
3. Confirm `/platform/queues` returns the registered queue map

## Required Environment Variables

- `APP_ENV`
- `LOG_LEVEL`
- `RELEASE_STAGE`
- `HEALTHCHECK_TIMEOUT_MS`
- `API_BASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `OBSERVABILITY_TRACE_HISTORY_LIMIT`
- `OBSERVABILITY_AUTOMATION_TRIGGER_INCIDENTS`
- `OBSERVABILITY_AUTOMATION_TELEMETRY_POLICY`
- `OBSERVABILITY_AUTOMATION_TELEMETRY_ESCALATION_THRESHOLD`
- `OBSERVABILITY_INCIDENT_REPORT_DIR`
- `OBSERVABILITY_INCIDENT_MINIMUM_SEVERITY`
- `OBSERVABILITY_ALERT_DISPATCH_PAGERDUTY_ROUTING_KEY` when `OBSERVABILITY_ALERT_DISPATCH_PROVIDER=pagerduty-events`
- `OBSERVABILITY_ALERT_DISPATCH_OPSGENIE_API_KEY` when `OBSERVABILITY_ALERT_DISPATCH_PROVIDER=opsgenie-alerts`
- `OBSERVABILITY_ALERT_DISPATCH_OPSGENIE_TEAM` when `OBSERVABILITY_ALERT_DISPATCH_PROVIDER=opsgenie-alerts`

## Known Gaps

- readiness still depends on local database, Redis, and object storage availability
- seed execution is still blocked on this machine by PostgreSQL access denial
- release verification is stronger than push verification; `pnpm safe-push` still gates on the repo build path, not the full release gate
- observability now includes runtime metrics, retained snapshots, external dispatch, shared worker telemetry, distributed tracing, worker-driven automation cadence, scheduler-enforced telemetry-ownership recovery policy, and explicit retention windows, but not continuous time-series ownership or third-party APM tooling
- observability automation can now run on a worker timer, sync durable incident triggers, and auto-recover degraded telemetry ownership, but continuous time-series ownership and third-party paging lifecycle state are still outside the repo baseline
- backup and restore scripts exist, but scheduled backups and restore drills are still not automated
