# Codex Execution Runbook

## Purpose

This runbook defines how future Codex sessions should use the Atlas planning system safely.

## Required Read Order Before Implementation

1. `AGENTS.md`
2. `docs/project-state.md`
3. `docs/architecture/master-execution-plan.md`
4. the blueprint docs in `docs/architecture/` when the task affects long-range architecture, rollout, operations, or security
5. the active detailed phase doc named in `docs/project-state.md`
6. `docs/_local/current-session.md` if it exists

## How To Find The Active Phase

- use `docs/project-state.md` for durable repo state
- use `docs/_local/current-session.md` for the local handoff
- if they disagree, prefer the durable roadmap and the actual repository state
- if a task clearly changes the active phase, update `docs/project-state.md`

## Standard Execution Flow

1. inspect current repo state
2. identify the current phase and active step
3. choose the safest next slice inside that phase
4. implement only that slice
5. run grounded verification commands
6. update `docs/_local/current-session.md`
7. update `docs/project-state.md` only if a durable repo fact changed
8. commit and push through `pnpm safe-push`

## Planning Rules

- treat the master product spec as the product source of truth
- treat the master execution plan as the sequencing source of truth
- treat the full-scale blueprint docs as the long-range target state for product, platform, operations, security, and release maturity
- treat detailed phase docs as the implementation guide for active work
- keep old summary docs only as companions that point back to the source-of-truth docs
- do not create contradictory roadmap documents
- do not let the full-scale blueprint override the current focused v1 implementation order unless durable repo state changes explicitly

## Documentation Update Rules

- update `docs/project-state.md` only for durable architecture, roadmap, or workflow changes
- update `docs/_local/current-session.md` at the end of every meaningful task
- never store secrets in durable or local memory files
- keep durable docs concise and execution-friendly
- prefer exact next steps, changed files, assumptions, and verification commands over long prose

## Verification Baseline

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm verify:push`
