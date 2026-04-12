BEGIN;
CREATE TABLE IF NOT EXISTS atlas_restore_drill (
  id TEXT PRIMARY KEY,
  checked_at TIMESTAMPTZ NOT NULL
);
INSERT INTO atlas_restore_drill (id, checked_at)
VALUES ('atlas-restore-drill', NOW())
ON CONFLICT (id) DO UPDATE SET checked_at = EXCLUDED.checked_at;
COMMIT;
