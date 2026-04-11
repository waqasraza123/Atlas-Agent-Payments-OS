# Contributing

## Local setup

1. Use Node `24.x`.
2. Copy `.env.example` to `.env`.
3. Run `pnpm install`.
4. Run `pnpm hooks:install`.

## Standard workflow

- Use `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before pushing meaningful changes.
- Use `pnpm verify:push` to run the same verification as the pre-push hook.
- Use `pnpm safe-push` as the default push path. It runs verification first, then runs `git push`.

## Pre-push hook

- The repo-versioned hook lives at `.githooks/pre-push`.
- This clone should use `core.hooksPath=.githooks`.
- Normal `git push` is blocked if `pnpm build` fails.

## Build gate

- The current root build gate is `pnpm typecheck`.
- This is intentional for the current repo state because API and worker run natively via `tsx`, and the web production build is not yet treated as a stable push gate during Phase 0 hardening.
