# Collaboration Guide

## Purpose

This guide defines how human contributors and AI agents should collaborate in the Atlas repository without creating architectural drift or noisy history.

## Working model

- Read `AGENTS.md` before starting implementation work.
- Read `docs/project-state.md` before making design or roadmap decisions.
- Read `docs/_local/current-session.md` if it exists before changing code.
- Keep `docs/project-state.md` durable and concise.
- Keep `docs/_local/current-session.md` restart-friendly and task-specific.

## Standard task flow

1. Inspect the current repo state.
2. Identify the current phase and the safest next slice.
3. Implement only that slice.
4. Verify with grounded repo commands.
5. Update `docs/_local/current-session.md`.
6. Update `docs/project-state.md` only if a long-term decision changed.
7. Commit and push through the protected workflow.

## Change boundaries

- Prefer small, verifiable slices over broad speculative refactors.
- Keep buyer, seller, operator, and marketing in the single web app.
- Keep shared packages thin and reusable.
- Avoid introducing new infrastructure categories without an ADR.

## Verification baseline

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm verify:push`

## Collaboration rules

- No comments in code.
- Use descriptive names and explicit typing.
- Record assumptions in docs or task output, not in code comments.
- Avoid fake demo state that bypasses the real domain model.
- Avoid speculative notes in durable repo memory.
