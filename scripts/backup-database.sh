#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$repo_root"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is required to create a database backup." >&2
  exit 1
fi

backup_dir=${DATABASE_BACKUP_DIR:-backups}
timestamp=$(date -u +"%Y%m%dT%H%M%SZ")
target_path=${1:-"$backup_dir/atlas-${APP_ENV:-local}-$timestamp.sql"}

mkdir -p "$(dirname "$target_path")"
pg_dump --no-owner --no-privileges --file "$target_path" "$DATABASE_URL"
printf '%s\n' "$target_path"
