# Release Rollback Baseline

## Purpose

This runbook defines the current repo-owned rollback-readiness baseline.

## Current Commands

1. `pnpm verify:rollback`
2. `pnpm release:manifest`
3. `pnpm db:backup`

## Rollback Readiness Checklist

Before a broader rollout candidate:

1. environment templates validate
2. release manifest can be generated
3. Prisma client generation succeeds
4. at least one committed migration exists
5. backup and restore scripts are executable

## What This Baseline Does Not Yet Do

- deploy a previous application revision
- reverse a non-backward-compatible migration automatically
- coordinate worker and API rollback against in-flight lifecycle state
- perform automated restore drills

## Current Rule

No release should be treated as broader-rollout-ready unless a fresh backup exists and `pnpm verify:rollback` passes.
