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

## Restore

Run:

1. `ATLAS_RESTORE_CONFIRM=atlas-restore pnpm db:restore backups/manual/atlas-pre-release.sql`

Additional production guard:

1. `ATLAS_RESTORE_CONFIRM=atlas-restore ATLAS_RESTORE_ALLOW_PRODUCTION=true pnpm db:restore <backup-file>`

Requirements:

- `DATABASE_URL` must be set
- `psql` must be installed
- restore confirmation env vars must be explicit

## Operational Rule

Take a backup before any release that includes schema or durable lifecycle changes.

## Current Limitation

The repo now owns the scripts and safety checks, but backup scheduling and restore drills still need a real deployment environment and documented ownership.
