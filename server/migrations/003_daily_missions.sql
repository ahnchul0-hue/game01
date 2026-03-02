-- Daily missions: regenerated per user per day
CREATE TABLE IF NOT EXISTS daily_missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id),
    mission_date TEXT NOT NULL,  -- YYYY-MM-DD format (UTC)
    mission_type TEXT NOT NULL,  -- 'collect_mandarins', 'run_distance', 'dodge_obstacles'
    target_value INTEGER NOT NULL,
    current_value INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    reward_claimed INTEGER NOT NULL DEFAULT 0,
    reward_type TEXT NOT NULL DEFAULT 'mandarin',  -- reward item type
    reward_amount INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, mission_date, mission_type)
);

CREATE INDEX IF NOT EXISTS idx_daily_missions_user_date ON daily_missions(user_id, mission_date);

-- Streaks: track consecutive play days
CREATE TABLE IF NOT EXISTS streaks (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_play_date TEXT,       -- YYYY-MM-DD format (UTC)
    last_reward_date TEXT,     -- YYYY-MM-DD: date of last streak reward claim
    total_rewards_claimed INTEGER NOT NULL DEFAULT 0
);
