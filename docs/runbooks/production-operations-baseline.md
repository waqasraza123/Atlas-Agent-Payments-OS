# Production Operations Baseline

## Purpose

This runbook defines the repo-level operational baseline that now exists after the post-v1 rollout-hardening slice.

## Current Baseline

- structured runtime config for app environment, release stage, log level, and healthcheck timeout
- structured JSON logging for API and worker runtime events
- API request correlation through `x-atlas-request-id`
- API live, startup, readiness, and metrics endpoints under `/health`
- operator observability routes for metrics, alerts, and incident readiness
- retained observability snapshot capture plus persisted snapshot and dispatch history on `/operator/alerts`
- release verification script through `pnpm verify:release`
- runtime smoke verification script through `pnpm verify:ops`
- environment-template validation through `pnpm verify:env`
- release manifest generation through `pnpm release:manifest`
- rollback-readiness verification through `pnpm verify:rollback`
- repo-owned backup and restore scripts through `pnpm db:backup` and `pnpm db:restore`
- S3-compatible rollout proof replication through the operations artifact bucket when proof storage is enabled
- GitHub Actions promotion dispatch and AWS Secrets Manager rotation dispatch through the rollout adapters
- governed external alert dispatch through owned generic-webhook and Slack webhook adapters plus `ALERT_DISPATCH` operational integrations
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

## Known Gaps

- readiness still depends on local database, Redis, and object storage availability
- seed execution is still blocked on this machine by PostgreSQL access denial
- release verification is stronger than push verification; `pnpm safe-push` still gates on the repo build path, not the full release gate
- observability now includes runtime metrics and operator alert posture, but not full tracing, external dispatch, or retained telemetry
- observability now includes retained snapshots and governed external dispatch, but not shared worker metrics endpoints, tracing, or automated incident triggers
- backup and restore scripts exist, but scheduled backups and restore drills are still not automated
