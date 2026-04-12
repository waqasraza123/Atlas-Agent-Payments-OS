#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$repo_root"

pnpm exec tsx ./scripts/run-restore-drill.ts --backup ./scripts/fixtures/restore-drill.sql >/dev/null
