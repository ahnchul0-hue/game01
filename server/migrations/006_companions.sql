CREATE TABLE IF NOT EXISTS user_companions (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    selected_companion TEXT NOT NULL DEFAULT 'none',
    unlocked_companions TEXT NOT NULL DEFAULT '[]'
);
