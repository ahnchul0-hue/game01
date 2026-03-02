use rand::Rng;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Mission {
    pub id: i64,
    pub user_id: String,
    pub mission_date: String,
    pub mission_type: String,
    pub target_value: i64,
    pub current_value: i64,
    pub completed: i64,
    pub reward_claimed: i64,
    pub reward_type: String,
    pub reward_amount: i64,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Streak {
    pub user_id: String,
    pub current_streak: i64,
    pub longest_streak: i64,
    pub last_play_date: Option<String>,
    pub total_rewards_claimed: i64,
}

// ---------------------------------------------------------------------------
// Mission generation helpers
// ---------------------------------------------------------------------------

struct MissionSpec {
    mission_type: &'static str,
    target_value: i64,
    reward_type: &'static str,
    reward_amount: i64,
}

fn generate_mission_specs() -> [MissionSpec; 3] {
    let mut rng = rand::thread_rng();

    let mandarin_target = rng.gen_range(10..=30);
    let mandarin_reward = rng.gen_range(2..=5);

    let distance_target = rng.gen_range(500..=2000);
    let distance_reward = rng.gen_range(1..=3);

    let dodge_target = rng.gen_range(5..=20);
    let dodge_reward = rng.gen_range(10..=30);

    [
        MissionSpec {
            mission_type: "collect_mandarins",
            target_value: mandarin_target,
            reward_type: "watermelon",
            reward_amount: mandarin_reward,
        },
        MissionSpec {
            mission_type: "run_distance",
            target_value: distance_target,
            reward_type: "hotspring_material",
            reward_amount: distance_reward,
        },
        MissionSpec {
            mission_type: "dodge_obstacles",
            target_value: dodge_target,
            reward_type: "mandarin",
            reward_amount: dodge_reward,
        },
    ]
}

// ---------------------------------------------------------------------------
// Daily mission functions
// ---------------------------------------------------------------------------

/// Returns today's missions for a user. If none exist yet, generates 3 new ones.
pub async fn get_or_create_daily_missions(
    pool: &SqlitePool,
    user_id: &str,
    date: &str,
) -> Result<Vec<Mission>, sqlx::Error> {
    // Check if missions already exist for today
    let existing: Vec<Mission> = sqlx::query_as::<_, Mission>(
        "SELECT id, user_id, mission_date, mission_type, target_value, current_value,
                completed, reward_claimed, reward_type, reward_amount
         FROM daily_missions
         WHERE user_id = ? AND mission_date = ?
         ORDER BY id ASC",
    )
    .bind(user_id)
    .bind(date)
    .fetch_all(pool)
    .await?;

    if !existing.is_empty() {
        return Ok(existing);
    }

    // Generate 3 missions and insert them
    let specs = generate_mission_specs();
    for spec in &specs {
        sqlx::query(
            "INSERT OR IGNORE INTO daily_missions
                (user_id, mission_date, mission_type, target_value, reward_type, reward_amount)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(user_id)
        .bind(date)
        .bind(spec.mission_type)
        .bind(spec.target_value)
        .bind(spec.reward_type)
        .bind(spec.reward_amount)
        .execute(pool)
        .await?;
    }

    // Fetch and return the newly created missions
    let missions: Vec<Mission> = sqlx::query_as::<_, Mission>(
        "SELECT id, user_id, mission_date, mission_type, target_value, current_value,
                completed, reward_claimed, reward_type, reward_amount
         FROM daily_missions
         WHERE user_id = ? AND mission_date = ?
         ORDER BY id ASC",
    )
    .bind(user_id)
    .bind(date)
    .fetch_all(pool)
    .await?;

    Ok(missions)
}

/// Adds progress_delta to the given mission_type for the user on the given date.
/// Marks completed=1 if current_value reaches target_value.
/// Returns the updated Mission row.
pub async fn update_mission_progress(
    pool: &SqlitePool,
    user_id: &str,
    date: &str,
    mission_type: &str,
    progress_delta: i64,
) -> Result<Mission, sqlx::Error> {
    sqlx::query(
        "UPDATE daily_missions
         SET current_value = MIN(current_value + ?, target_value),
             completed = CASE WHEN (current_value + ?) >= target_value THEN 1 ELSE completed END
         WHERE user_id = ? AND mission_date = ? AND mission_type = ? AND reward_claimed = 0",
    )
    .bind(progress_delta)
    .bind(progress_delta)
    .bind(user_id)
    .bind(date)
    .bind(mission_type)
    .execute(pool)
    .await?;

    sqlx::query_as::<_, Mission>(
        "SELECT id, user_id, mission_date, mission_type, target_value, current_value,
                completed, reward_claimed, reward_type, reward_amount
         FROM daily_missions
         WHERE user_id = ? AND mission_date = ? AND mission_type = ?",
    )
    .bind(user_id)
    .bind(date)
    .bind(mission_type)
    .fetch_one(pool)
    .await
}

/// Fetches a single mission by id and user_id (ownership check).
pub async fn get_mission_by_id(
    pool: &SqlitePool,
    mission_id: i64,
    user_id: &str,
) -> Result<Mission, sqlx::Error> {
    sqlx::query_as::<_, Mission>(
        "SELECT id, user_id, mission_date, mission_type, target_value, current_value,
                completed, reward_claimed, reward_type, reward_amount
         FROM daily_missions
         WHERE id = ? AND user_id = ?",
    )
    .bind(mission_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
}

/// Claims the reward for a completed, unclaimed mission.
/// Adds items to inventory and marks reward_claimed=1.
/// Returns an error string (mapped to AppError by the caller) on logical failures.
pub async fn claim_mission_reward(
    pool: &SqlitePool,
    user_id: &str,
    mission_id: i64,
) -> Result<Mission, ClaimError> {
    let mission = get_mission_by_id(pool, mission_id, user_id)
        .await
        .map_err(|_| ClaimError::NotFound)?;

    if mission.completed == 0 {
        return Err(ClaimError::NotCompleted);
    }
    if mission.reward_claimed != 0 {
        return Err(ClaimError::AlreadyClaimed);
    }

    // Mark as claimed
    sqlx::query(
        "UPDATE daily_missions SET reward_claimed = 1 WHERE id = ? AND user_id = ?",
    )
    .bind(mission_id)
    .bind(user_id)
    .execute(pool)
    .await
    .map_err(ClaimError::Db)?;

    // Add to inventory using the same upsert pattern as inventory.rs
    let (add_mandarin, add_watermelon, add_hotspring_material) = match mission.reward_type.as_str()
    {
        "mandarin" => (mission.reward_amount, 0i64, 0i64),
        "watermelon" => (0i64, mission.reward_amount, 0i64),
        "hotspring_material" => (0i64, 0i64, mission.reward_amount),
        _ => (0i64, 0i64, 0i64),
    };

    let inv_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO inventories (id, user_id, mandarin, watermelon, hotspring_material, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET
           mandarin = MIN(mandarin + excluded.mandarin, 99999),
           watermelon = MIN(watermelon + excluded.watermelon, 99999),
           hotspring_material = MIN(hotspring_material + excluded.hotspring_material, 99999),
           updated_at = datetime('now')",
    )
    .bind(&inv_id)
    .bind(user_id)
    .bind(add_mandarin)
    .bind(add_watermelon)
    .bind(add_hotspring_material)
    .execute(pool)
    .await
    .map_err(ClaimError::Db)?;

    // Return updated mission
    get_mission_by_id(pool, mission_id, user_id)
        .await
        .map_err(ClaimError::Db)
}

// ---------------------------------------------------------------------------
// Streak functions
// ---------------------------------------------------------------------------

/// Returns the streak row for a user, creating one if it doesn't exist.
pub async fn get_or_create_streak(
    pool: &SqlitePool,
    user_id: &str,
) -> Result<Streak, sqlx::Error> {
    sqlx::query(
        "INSERT OR IGNORE INTO streaks (user_id) VALUES (?)",
    )
    .bind(user_id)
    .execute(pool)
    .await?;

    sqlx::query_as::<_, Streak>(
        "SELECT user_id, current_streak, longest_streak, last_play_date, total_rewards_claimed
         FROM streaks WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
}

/// Updates the streak for today:
/// - If last_play_date == today: no-op (already counted)
/// - If last_play_date == yesterday: increment streak
/// - Otherwise: reset streak to 1
/// Also updates longest_streak.
pub async fn update_streak(
    pool: &SqlitePool,
    user_id: &str,
    today: &str,
) -> Result<Streak, sqlx::Error> {
    let streak = get_or_create_streak(pool, user_id).await?;

    // If already updated today, return as-is
    if streak.last_play_date.as_deref() == Some(today) {
        return Ok(streak);
    }

    // Determine new streak value
    let yesterday = yesterday_date(today);
    let new_streak = if streak.last_play_date.as_deref() == Some(&yesterday) {
        streak.current_streak + 1
    } else {
        1
    };
    let new_longest = streak.longest_streak.max(new_streak);

    sqlx::query(
        "UPDATE streaks
         SET current_streak = ?, longest_streak = ?, last_play_date = ?
         WHERE user_id = ?",
    )
    .bind(new_streak)
    .bind(new_longest)
    .bind(today)
    .bind(user_id)
    .execute(pool)
    .await?;

    get_or_create_streak(pool, user_id).await
}

/// Claims the streak reward for today. The reward depends on the streak day:
/// - Day 1-3: mandarin x 5
/// - Day 4-6: watermelon x 3
/// - Day 7+: hotspring_material x 2 (reward cycle repeats every 7)
///
/// This also calls `update_streak` to ensure last_play_date is set.
pub async fn claim_streak_reward(
    pool: &SqlitePool,
    user_id: &str,
    today: &str,
) -> Result<Streak, ClaimError> {
    // Ensure streak is up-to-date
    let streak = update_streak(pool, user_id, today)
        .await
        .map_err(ClaimError::Db)?;

    // Determine reward by current streak (cycle every 7)
    let cycle_day = ((streak.current_streak - 1) % 7) + 1; // 1..=7
    let (add_mandarin, add_watermelon, add_hotspring_material): (i64, i64, i64) =
        if cycle_day <= 3 {
            (5, 0, 0)
        } else if cycle_day <= 6 {
            (0, 3, 0)
        } else {
            (0, 0, 2)
        };

    // Add to inventory
    let inv_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO inventories (id, user_id, mandarin, watermelon, hotspring_material, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET
           mandarin = MIN(mandarin + excluded.mandarin, 99999),
           watermelon = MIN(watermelon + excluded.watermelon, 99999),
           hotspring_material = MIN(hotspring_material + excluded.hotspring_material, 99999),
           updated_at = datetime('now')",
    )
    .bind(&inv_id)
    .bind(user_id)
    .bind(add_mandarin)
    .bind(add_watermelon)
    .bind(add_hotspring_material)
    .execute(pool)
    .await
    .map_err(ClaimError::Db)?;

    // Increment total_rewards_claimed
    sqlx::query(
        "UPDATE streaks SET total_rewards_claimed = total_rewards_claimed + 1 WHERE user_id = ?",
    )
    .bind(user_id)
    .execute(pool)
    .await
    .map_err(ClaimError::Db)?;

    get_or_create_streak(pool, user_id)
        .await
        .map_err(ClaimError::Db)
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

pub enum ClaimError {
    NotFound,
    NotCompleted,
    AlreadyClaimed,
    Db(sqlx::Error),
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/// Returns the date string for the day before `date` (YYYY-MM-DD).
fn yesterday_date(date: &str) -> String {
    use chrono::NaiveDate;
    NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map(|d| {
            d.pred_opt()
                .map(|y| y.format("%Y-%m-%d").to_string())
                .unwrap_or_default()
        })
        .unwrap_or_default()
}
