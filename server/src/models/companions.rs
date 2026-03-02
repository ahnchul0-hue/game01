use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};

pub const VALID_IDS: &[&str] = &["none", "otter", "duck", "turtle"];

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct CompanionRow {
    #[serde(skip_serializing)]
    pub user_id: String,
    pub selected_companion: String,
    pub unlocked_companions: String,
}

#[derive(Deserialize)]
pub struct SaveCompanionRequest {
    pub selected_companion: String,
    pub unlocked_companions: Vec<String>,
}

pub async fn get_companions(pool: &SqlitePool, user_id: &str) -> Result<CompanionRow, sqlx::Error> {
    sqlx::query("INSERT OR IGNORE INTO user_companions (user_id) VALUES (?)")
        .bind(user_id)
        .execute(pool)
        .await?;
    sqlx::query_as::<_, CompanionRow>(
        "SELECT user_id, selected_companion, unlocked_companions FROM user_companions WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
}

pub async fn save_companions(
    pool: &SqlitePool,
    user_id: &str,
    req: &SaveCompanionRequest,
) -> Result<CompanionRow, sqlx::Error> {
    let unlocked_json = serde_json::to_string(&req.unlocked_companions)
        .unwrap_or_else(|_| "[]".to_string());

    sqlx::query(
        "INSERT INTO user_companions (user_id, selected_companion, unlocked_companions)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           selected_companion = excluded.selected_companion,
           unlocked_companions = excluded.unlocked_companions",
    )
    .bind(user_id)
    .bind(&req.selected_companion)
    .bind(&unlocked_json)
    .execute(pool)
    .await?;

    get_companions(pool, user_id).await
}
