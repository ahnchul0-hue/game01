-- Migration 007: Performance indexes and data integrity
-- Note: SQLite does not support ALTER TABLE ADD CONSTRAINT for CHECK constraints
-- on existing tables. CHECK constraints can only be defined at table creation time.
-- Enforce invariants at the application layer instead (see models/missions.rs).

-- Composite indexes for rate-limit queries
-- scores: used by the 60-second window rate-limit in scores.rs
CREATE INDEX IF NOT EXISTS idx_scores_user_created ON scores(user_id, created_at DESC);

-- daily_missions: used by the 60-second window rate-limit in missions.rs
CREATE INDEX IF NOT EXISTS idx_daily_missions_user_updated ON daily_missions(user_id, updated_at);

-- Backfill NULL updated_at values left by rows created before migration 005
UPDATE daily_missions SET updated_at = datetime('now') WHERE updated_at IS NULL;
