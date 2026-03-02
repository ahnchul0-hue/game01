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

/// Internal DB row for streaks — includes `last_reward_date` column.
#[derive(Debug, Deserialize, FromRow, Clone)]
pub struct Streak {
    pub user_id: String,
    pub current_streak: i64,
    pub longest_streak: i64,
    pub last_play_date: Option<String>,
    pub last_reward_date: Option<String>,
    pub total_rewards_claimed: i64,
}

/// Public response type that includes `today_reward_claimed` derived field.
#[derive(Debug, Serialize, Clone)]
pub struct StreakResponse {
    pub user_id: String,
    pub current_streak: i64,
    pub longest_streak: i64,
    pub last_play_date: Option<String>,
    pub total_rewards_claimed: i64,
    pub today_reward_claimed: bool,
}

impl StreakResponse {
    pub fn from_streak(streak: Streak, today: &str) -> Self {
        let today_reward_claimed = streak
            .last_reward_date
            .as_deref()
            .map(|d| d == today)
            .unwrap_or(false);
        StreakResponse {
            user_id: streak.user_id,
            current_streak: streak.current_streak,
            longest_streak: streak.longest_streak,
            last_play_date: streak.last_play_date,
            total_rewards_claimed: streak.total_rewards_claimed,
            today_reward_claimed,
        }
    }
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
/// S3: Always INSERT OR IGNORE first, then SELECT — avoids race condition.
pub async fn get_or_create_daily_missions(
    pool: &SqlitePool,
    user_id: &str,
    date: &str,
) -> Result<Vec<Mission>, sqlx::Error> {
    // S3: Always attempt inserts first (INSERT OR IGNORE handles duplicates).
    // Do NOT check existing first; insert then select to avoid TOCTOU race.
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

    // Fetch and return (newly created or pre-existing) missions
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
/// S1: Rejects updates if mission is already completed (reward_claimed guards further abuse).
/// Marks completed=1 if current_value reaches target_value.
/// Returns the updated Mission row.
pub async fn update_mission_progress(
    pool: &SqlitePool,
    user_id: &str,
    date: &str,
    mission_type: &str,
    progress_delta: i64,
) -> Result<Mission, sqlx::Error> {
    // S1: Check if the mission is already completed — reject further updates.
    let mission: Option<Mission> = sqlx::query_as::<_, Mission>(
        "SELECT id, user_id, mission_date, mission_type, target_value, current_value,
                completed, reward_claimed, reward_type, reward_amount
         FROM daily_missions
         WHERE user_id = ? AND mission_date = ? AND mission_type = ?",
    )
    .bind(user_id)
    .bind(date)
    .bind(mission_type)
    .fetch_optional(pool)
    .await?;

    if let Some(ref m) = mission {
        if m.completed != 0 {
            // Already completed — return current state without update (idempotent)
            return Ok(m.clone());
        }
    }

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
/// S2: Wraps UPDATE daily_missions + INSERT/UPDATE inventories in a transaction.
/// Returns an error (mapped to AppError by the caller) on logical failures.
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

    let (add_mandarin, add_watermelon, add_hotspring_material) = match mission.reward_type.as_str()
    {
        "mandarin" => (mission.reward_amount, 0i64, 0i64),
        "watermelon" => (0i64, mission.reward_amount, 0i64),
        "hotspring_material" => (0i64, 0i64, mission.reward_amount),
        _ => (0i64, 0i64, 0i64),
    };

    // S2: Wrap mark-claimed + inventory update in a transaction.
    let mut tx = pool.begin().await.map_err(ClaimError::Db)?;

    sqlx::query(
        "UPDATE daily_missions SET reward_claimed = 1 WHERE id = ? AND user_id = ?",
    )
    .bind(mission_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await
    .map_err(ClaimError::Db)?;

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
    .execute(&mut *tx)
    .await
    .map_err(ClaimError::Db)?;

    tx.commit().await.map_err(ClaimError::Db)?;

    // Return updated mission (outside transaction)
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
        "SELECT user_id, current_streak, longest_streak, last_play_date,
                last_reward_date, total_rewards_claimed
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
/// S5: Guards against zero-streak or pre-play claims.
/// S2: Wraps inventory update + total_rewards_claimed bump in a transaction.
/// C2: Sets last_reward_date = today so callers can derive today_reward_claimed.
pub async fn claim_streak_reward(
    pool: &SqlitePool,
    user_id: &str,
    today: &str,
) -> Result<Streak, ClaimError> {
    // Ensure streak is up-to-date (sets last_play_date = today if needed)
    let streak = update_streak(pool, user_id, today)
        .await
        .map_err(ClaimError::Db)?;

    // S5: Reject if the streak was never established from a real play session.
    if streak.current_streak == 0 {
        return Err(ClaimError::NotCompleted);
    }
    // S5: last_play_date must be today (update_streak sets it, but guard explicitly).
    if streak.last_play_date.as_deref() != Some(today) {
        return Err(ClaimError::NotCompleted);
    }

    // C2: Check if reward was already claimed today.
    if streak.last_reward_date.as_deref() == Some(today) {
        return Err(ClaimError::AlreadyClaimed);
    }

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

    // S2: Wrap inventory upsert + streak update in a transaction.
    let mut tx = pool.begin().await.map_err(ClaimError::Db)?;

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
    .execute(&mut *tx)
    .await
    .map_err(ClaimError::Db)?;

    // C2: Record last_reward_date and increment total_rewards_claimed atomically.
    sqlx::query(
        "UPDATE streaks
         SET total_rewards_claimed = total_rewards_claimed + 1,
             last_reward_date = ?
         WHERE user_id = ?",
    )
    .bind(today)
    .bind(user_id)
    .execute(&mut *tx)
    .await
    .map_err(ClaimError::Db)?;

    tx.commit().await.map_err(ClaimError::Db)?;

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
