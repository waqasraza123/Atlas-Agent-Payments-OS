# Database Backup And Restore

## Purpose

This runbook documents the backup and restore commands that now exist in the repo.

## Backup

Run:

1. `pnpm db:backup`

Optional target path:

1. `pnpm db:backup backups/manual/atlas-pre-release.sql`

Requirements:

- `DATABASE_URL` must be set
- `pg_dump` must be installed
- a backup integrity manifest is written alongside each backup file

## Restore

Run:

1. `ATLAS_RESTORE_CONFIRM=atlas-restore pnpm db:restore backups/manual/atlas-pre-release.sql`

Additional production guard:

1. `ATLAS_RESTORE_CONFIRM=atlas-restore ATLAS_RESTORE_ALLOW_PRODUCTION=true pnpm db:restore <backup-file>`

Requirements:

- `DATABASE_URL` must be set
- `psql` must be installed
- restore confirmation env vars must be explicit
- if a `<backup-file>.manifest.json` file exists it must pass integrity verification before restore

## Operational Rule

Take a backup before any release that includes schema or durable lifecycle changes.

## Restore Drill

Run:

1. `pnpm verify:restore-drill`

Optional execution mode:

1. `ATLAS_RESTORE_DRILL_EXECUTE=true ATLAS_RESTORE_DRILL_DATABASE_URL=<database-url> pnpm verify:restore-drill`

Explicit proof mode:

1. `ATLAS_RESTORE_DRILL_EXECUTE=true ATLAS_RESTORE_DRILL_DATABASE_URL=<database-url> pnpm exec tsx ./scripts/run-restore-drill.ts --backup <backup-file> --environment staging --label staging-restore-slot --report restore-drills/staging/latest.json`

Requirements:

- the restore-drill report must show `executedRestore=true`
- the report target environment must match the environment being promoted
- the report must stay within the configured freshness window before promotion

## Current Limitation

The repo now owns the scripts, integrity checks, dry-run restore-drill verification, executed restore-drill reporting, provider-aware restore adapter contracts, proof-bearing restore-drill reports with target metadata, and owned verified rollout targets for command-mode restore execution, but backup scheduling and stored non-local restore proof ownership still need a real deployment environment and documented ownership.
