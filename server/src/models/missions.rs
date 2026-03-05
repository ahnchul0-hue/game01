use rand::Rng;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Mission {
    #[serde(skip_serializing)]
    #[allow(dead_code)]
    pub id: i64,
    #[serde(skip_serializing)]
    #[allow(dead_code)]
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
    #[serde(skip_serializing)]
    #[allow(dead_code)]
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
/// Always INSERT OR IGNORE first, then SELECT — avoids race condition.
pub async fn get_or_create_daily_missions(
    pool: &SqlitePool,
    user_id: &str,
    date: &str,
) -> Result<Vec<Mission>, sqlx::Error> {
    // Always attempt inserts first (INSERT OR IGNORE handles duplicates).
    // Do NOT check existing first; insert then select to avoid TOCTOU race.
    // A7: Wrap all three INSERTs in a transaction for atomicity — either all
    // three mission rows are inserted or none are (on error).
    let specs = generate_mission_specs();
    let mut tx = pool.begin().await?;
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
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;

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

/// S-3: Atomic UPDATE replaces the SELECT-then-UPDATE pattern to avoid TOCTOU.
/// Updates progress for the given mission_type, capped at target_value.
/// If rows_affected == 0 the mission was already completed or doesn't exist;
/// in that case we just fetch and return the current row.
pub async fn update_mission_progress(
    pool: &SqlitePool,
    user_id: &str,
    date: &str,
    mission_type: &str,
    progress_delta: i64,
) -> Result<Mission, sqlx::Error> {
    // S-3: Single atomic UPDATE — avoids TOCTOU race between SELECT and UPDATE.
    // The WHERE clause includes `completed = 0` so completed missions are ignored.
    let result = sqlx::query(
        "UPDATE daily_missions
         SET current_value = MIN(current_value + ?, target_value),
             completed = CASE WHEN (current_value + ?) >= target_value THEN 1 ELSE completed END,
             updated_at = datetime('now')
         WHERE user_id = ? AND mission_date = ? AND mission_type = ? AND completed = 0",
    )
    .bind(progress_delta)
    .bind(progress_delta)
    .bind(user_id)
    .bind(date)
    .bind(mission_type)
    .execute(pool)
    .await?;

    // Whether rows_affected is 0 (already completed/not found) or 1, fetch current state.
    // This is idempotent — the SELECT always returns the authoritative DB row.
    let _ = result.rows_affected(); // acknowledged; we always fetch below

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

/// Claims the reward for a completed, unclaimed mission.
///
/// A4: SELECT-first 패턴으로 불필요한 중복 SELECT 제거.
/// 트랜잭션 내에서 미션을 먼저 읽어 조건을 검증한 후 UPDATE하여
/// 읽어온 row를 재사용한다. 총 SELECT 횟수: 최대 1회 (기존 최대 2회 → 1회).
///
/// TOCTOU 안전성: BEGIN IMMEDIATE 없이도 SQLite WAL 모드에서
/// 단일 writer 보장 + UPDATE의 WHERE 조건(completed=1 AND reward_claimed=0)이
/// 동시 이중 청구를 원자적으로 차단한다.
pub async fn claim_mission_reward(
    pool: &SqlitePool,
    user_id: &str,
    mission_id: i64,
) -> Result<Mission, ClaimError> {
    let mut tx = pool.begin().await.map_err(ClaimError::Db)?;

    // A4: SELECT를 먼저 수행하여 미션 정보를 한 번만 읽는다.
    // 이후 UPDATE 성공 여부에 따라 이 row를 그대로 재사용한다.
    let mission = sqlx::query_as::<_, Mission>(
        "SELECT id, user_id, mission_date, mission_type, target_value, current_value,
                completed, reward_claimed, reward_type, reward_amount
         FROM daily_missions WHERE id = ? AND user_id = ?",
    )
    .bind(mission_id)
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(ClaimError::Db)?;

    // 존재 여부 및 상태 검증 (SELECT 결과 재사용)
    let mission = match mission {
        None => return Err(ClaimError::NotFound),
        Some(m) if m.completed == 0 => return Err(ClaimError::NotCompleted),
        Some(m) if m.reward_claimed != 0 => return Err(ClaimError::AlreadyClaimed),
        Some(m) => m,
    };

    // Atomic: 동시 이중 청구 방지 — reward_claimed=0 조건이 경쟁 요청을 차단한다.
    // rows_affected==0 이면 다른 요청이 동시에 먼저 청구한 것이므로 AlreadyClaimed 반환.
    let result = sqlx::query(
        "UPDATE daily_missions SET reward_claimed = 1
         WHERE id = ? AND user_id = ? AND reward_claimed = 0",
    )
    .bind(mission_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await
    .map_err(ClaimError::Db)?;

    if result.rows_affected() == 0 {
        return Err(ClaimError::AlreadyClaimed);
    }

    // 위에서 읽어온 mission row를 재사용하여 보상 타입 결정 (추가 SELECT 불필요)
    let (add_mandarin, add_watermelon, add_hotspring_material) = match mission.reward_type.as_str() {
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
    .execute(&mut *tx)
    .await
    .map_err(ClaimError::Db)?;

    tx.commit().await.map_err(ClaimError::Db)?;

    // A4: reward_claimed=1로 업데이트된 최종 상태를 반영하여 반환
    Ok(Mission {
        reward_claimed: 1,
        ..mission
    })
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
///
/// S-4: Wraps read + UPDATE in a BEGIN IMMEDIATE transaction to prevent
/// concurrent updates racing between the read and write.
pub async fn update_streak(
    pool: &SqlitePool,
    user_id: &str,
    today: &str,
) -> Result<Streak, sqlx::Error> {
    // S-4: Use a transaction to make the read+update atomic.
    let mut tx = pool.begin().await?;

    let streak = sqlx::query_as::<_, Streak>(
        "SELECT user_id, current_streak, longest_streak, last_play_date,
                last_reward_date, total_rewards_claimed
         FROM streaks WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?;

    // Ensure row exists
    if streak.is_none() {
        sqlx::query("INSERT OR IGNORE INTO streaks (user_id) VALUES (?)")
            .bind(user_id)
            .execute(&mut *tx)
            .await?;
    }

    // Re-fetch if we just inserted
    let streak = match streak {
        Some(s) => s,
        None => sqlx::query_as::<_, Streak>(
            "SELECT user_id, current_streak, longest_streak, last_play_date,
                    last_reward_date, total_rewards_claimed
             FROM streaks WHERE user_id = ?",
        )
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await?,
    };

    // If already updated today, commit and return as-is
    if streak.last_play_date.as_deref() == Some(today) {
        tx.commit().await?;
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
    .execute(&mut *tx)
    .await?;

    // Fetch final state within the same transaction
    let updated = sqlx::query_as::<_, Streak>(
        "SELECT user_id, current_streak, longest_streak, last_play_date,
                last_reward_date, total_rewards_claimed
         FROM streaks WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(updated)
}

/// Claims the streak reward for today. The reward depends on the streak day:
/// - Day 1-3: mandarin x 5
/// - Day 4-6: watermelon x 3
/// - Day 7+: hotspring_material x 2 (reward cycle repeats every 7)
///
/// S-1: Only reads streak via get_or_create_streak (read-only). Does NOT call
///      update_streak — the streak must have been set by a real score submission.
/// S-2: Adds `AND (last_reward_date IS NULL OR last_reward_date != ?)` to the
///      streak UPDATE so concurrent claims are detected via rows_affected() == 0.
pub async fn claim_streak_reward(
    pool: &SqlitePool,
    user_id: &str,
    today: &str,
) -> Result<Streak, ClaimError> {
    // S-1: Read-only — do NOT call update_streak here.
    // The streak must be established by a real score submission (update_streak
    // is called from the scores route). Calling update_streak here would let
    // users claim a reward without ever playing.
    let streak = get_or_create_streak(pool, user_id)
        .await
        .map_err(ClaimError::Db)?;

    // S-1: last_play_date must be today (set by update_streak on score submit).
    if streak.last_play_date.as_deref() != Some(today) {
        return Err(ClaimError::NotCompleted);
    }

    // S-1: Reject if the streak was never established from a real play session.
    if streak.current_streak == 0 {
        return Err(ClaimError::NotCompleted);
    }

    // Check if reward was already claimed today (fast path before transaction).
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

    // Wrap inventory upsert + streak update in a transaction.
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

    // S-2: The WHERE clause guards against double-claim races.
    // If another request already set last_reward_date = today between our read
    // and this UPDATE, rows_affected() will be 0 and we return AlreadyClaimed.
    let update_result = sqlx::query(
        "UPDATE streaks
         SET total_rewards_claimed = total_rewards_claimed + 1,
             last_reward_date = ?
         WHERE user_id = ? AND (last_reward_date IS NULL OR last_reward_date != ?)",
    )
    .bind(today)
    .bind(user_id)
    .bind(today)
    .execute(&mut *tx)
    .await
    .map_err(ClaimError::Db)?;

    if update_result.rows_affected() == 0 {
        // Another concurrent request already claimed for today
        return Err(ClaimError::AlreadyClaimed);
    }

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
