#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$repo_root"

pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm --filter @atlas/web build
