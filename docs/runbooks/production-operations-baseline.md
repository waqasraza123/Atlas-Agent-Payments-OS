# Production Operations Baseline

## Purpose

This runbook defines the repo-level operational baseline that now exists after the post-v1 rollout-hardening slice.

## Current Baseline

- structured runtime config for app environment, release stage, log level, and healthcheck timeout
- structured JSON logging for API and worker runtime events
- API request correlation through `x-atlas-request-id`
- API live, startup, and readiness endpoints under `/health`
- release verification script through `pnpm verify:release`
- runtime smoke verification script through `pnpm verify:ops`
- GitHub Actions release gate in `.github/workflows/release-gate.yml`
- web security headers baseline through `next.config.ts`

## Release Verification

Run this before a broader rollout candidate:

1. `pnpm install`
2. `pnpm db:generate`
3. `pnpm verify:release`

## Runtime Smoke Verification

With the API running:

1. `pnpm verify:ops`
2. Confirm `/health`, `/health/live`, `/health/startup`, and `/health/ready` return expected status payloads
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
- observability is currently structured logging plus readiness checks, not full tracing and alerting
