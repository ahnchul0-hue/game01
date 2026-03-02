ALTER TABLE daily_missions ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));
