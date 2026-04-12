# Environment Promotion Baseline

## Purpose

This runbook defines the repo-owned environment and promotion baseline for Atlas after the deployment-hardening slice.

## Environment Files

- `.env.example` for local defaults
- `.env.development.example` for shared development expectations
- `.env.staging.example` for staging expectations
- `.env.production.example` for production expectations

These files are templates only. Real secrets must come from a secret manager or deployment platform.

## Validation Commands

1. `pnpm verify:env`
2. `pnpm release:manifest`
3. `pnpm promote:staging`
4. `pnpm promote:production`
5. `pnpm verify:rollback`

## Promotion Sequence

1. Validate target environment variables against the appropriate template.
2. Generate a release manifest for the target deployment.
3. Run `pnpm verify:release`.
4. Capture a database backup before applying schema changes.
5. Promote the same revision forward from development to staging to production.
6. Store the generated promotion manifest with the release record for later rollback and incident review.

## Expected Metadata

- `APP_ENV`
- `RELEASE_STAGE`
- `APP_REVISION`
- `DEPLOYMENT_SLOT`
- `DATABASE_BACKUP_DIR`

## Current Limitation

The repo now validates environment shape, release metadata, and promotion-manifest generation, but it still does not own a cloud-specific deployment target, secret-manager integration, or environment-specific deploy execution.
