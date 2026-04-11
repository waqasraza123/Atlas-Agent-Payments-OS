# Contributing

Atlas is built as a production-grade monorepo with a strict protected push path and a documented collaboration model.

## Local setup

1. Use Node `24.x`.
2. Copy `.env.example` to `.env`.
3. Run `pnpm install`.
4. Run `pnpm hooks:install`.
5. Read [docs/collaboration-guide.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/collaboration-guide.md) before larger changes.

## Standard workflow

- Use `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before pushing meaningful changes.
- Use `pnpm verify:push` to run the same verification as the pre-push hook.
- Use `pnpm safe-push` as the default push path. It runs verification first, then runs `git push`.
- Keep changes scoped to the safest next slice rather than batching multiple roadmap steps together.
- Update `docs/_local/current-session.md` at the end of meaningful tasks.
- Update `docs/project-state.md` only when durable repo facts or long-term decisions change.

## Collaboration rules

- Read `AGENTS.md` before implementation work.
- Follow the route-group and package-boundary architecture already established in the repo.
- Keep code typed, modular, reusable, and production-grade.
- Do not add code comments.
- Put assumptions and tradeoffs in docs or task output.
- Avoid introducing new infrastructure categories without an ADR.

## Pre-push hook

- The repo-versioned hook lives at `.githooks/pre-push`.
- This clone should use `core.hooksPath=.githooks`.
- Normal `git push` is blocked if `pnpm build` fails.

## Build gate

- The current root build gate is `pnpm typecheck`.
- This is intentional for the current repo state because API and worker run natively via `tsx`, and the web production build is not yet treated as a stable push gate during Phase 0 hardening.

## Repository governance

- License: [Apache-2.0](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/LICENSE)
- Security policy: [SECURITY.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/SECURITY.md)
- Collaboration guide: [docs/collaboration-guide.md](/Users/mc/development/blockchain/ethereum/Atlas-Agent-Payments-OS/docs/collaboration-guide.md)
