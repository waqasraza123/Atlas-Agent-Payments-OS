#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$repo_root"

pnpm verify:env
pnpm exec tsx ./scripts/create-release-manifest.ts --service api >/dev/null
pnpm db:generate >/dev/null

latest_migration=$(find packages/database/prisma/migrations -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)

if [ -z "$latest_migration" ]; then
  echo "No Prisma migration directories were found." >&2
  exit 1
fi

if [ ! -x ./scripts/backup-database.sh ] || [ ! -x ./scripts/restore-database.sh ]; then
  echo "Database backup and restore scripts must be executable." >&2
  exit 1
fi

if [ ! -x ./scripts/verify-restore-drill.sh ]; then
  echo "Restore-drill verification script must be executable." >&2
  exit 1
fi

printf '%s\n' "$latest_migration"
