-- C2: Add last_reward_date to streaks so we can track whether today's
-- streak reward has already been claimed without querying daily_missions.
ALTER TABLE streaks ADD COLUMN last_reward_date TEXT;
