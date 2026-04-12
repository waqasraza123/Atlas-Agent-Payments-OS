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
3. `pnpm secrets:rotation:manifest --environment staging --rotated-by <operator-email> --reason "<ticket>" --key AUTH_SESSION_SIGNING_SECRET --key AUTH_IDENTITY_BRIDGE_SECRET --key DATABASE_URL --key STRIPE_SECRET_KEY --key STRIPE_WEBHOOK_SECRET --key MINIO_SECRET_KEY`
4. `pnpm promote:staging`
5. `pnpm promote:production`
5. `pnpm verify:rollback`

## Promotion Sequence

1. Validate target environment variables against the appropriate template.
2. Generate a release manifest for the target deployment.
3. Run `pnpm verify:release`.
4. Capture a database backup before applying schema changes.
5. Produce a restore-drill report for the target environment and a secret-rotation manifest that covers the required secret set.
6. Promote the same revision forward from development to staging to production with `--restore-report` and `--rotation-manifest`, or the matching env vars.
7. Store the generated promotion manifest with the release record for later rollback and incident review.
8. Treat the generated promotion bundle as the release artifact manifest for the environment handoff.

## Expected Metadata

- `APP_ENV`
- `RELEASE_STAGE`
- `APP_REVISION`
- `DEPLOYMENT_SLOT`
- `DATABASE_BACKUP_DIR`
- `RESTORE_DRILL_MAX_AGE_HOURS`
- `SECRET_ROTATION_MAX_AGE_HOURS`
- `SECRET_ROTATION_REQUIRED_KEYS`
- `RELEASE_ARTIFACT_ID`
- `RELEASE_ARTIFACT_SHA256`

## Current Limitation

The repo now validates environment shape, release metadata, restore-drill proof freshness, secret-rotation execution proof, provider-aware promotion adapter output, promotion-manifest generation, artifact-bound promotion bundles, and promotion execution reports, but it still does not own a cloud-specific deployment target, secret-manager-backed execution ownership, or environment-specific deploy execution.
