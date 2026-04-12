#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$repo_root"

backup_file=${1:-}

if [ -z "$backup_file" ]; then
  echo "Usage: pnpm db:restore <backup-file>" >&2
  exit 1
fi

if [ ! -f "$backup_file" ]; then
  echo "Backup file '$backup_file' was not found." >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

if [ "${ATLAS_RESTORE_CONFIRM:-}" != "atlas-restore" ]; then
  echo "Set ATLAS_RESTORE_CONFIRM=atlas-restore to run restore." >&2
  exit 1
fi

if [ "${APP_ENV:-local}" = "production" ] && [ "${ATLAS_RESTORE_ALLOW_PRODUCTION:-false}" != "true" ]; then
  echo "Production restore requires ATLAS_RESTORE_ALLOW_PRODUCTION=true." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to restore a database backup." >&2
  exit 1
fi

if [ -f "${backup_file}.manifest.json" ]; then
  pnpm exec tsx ./scripts/backup-manifest.ts verify --file "$backup_file" >/dev/null
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$backup_file"
