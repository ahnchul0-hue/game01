use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Score {
    pub id: String,
    pub user_id: String,
    pub score: i64,
    pub distance: i64,
    pub items_collected: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct PublicScore {
    pub score: i64,
    pub distance: i64,
    pub items_collected: i64,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct CreateScoreRequest {
    pub score: i64,
    pub distance: i64,
    pub items_collected: i64,
}

pub async fn create_score(
    pool: &SqlitePool,
    user_id: &str,
    req: &CreateScoreRequest,
) -> Result<Score, sqlx::Error> {
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO scores (id, user_id, score, distance, items_collected) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(user_id)
    .bind(req.score)
    .bind(req.distance)
    .bind(req.items_collected)
    .execute(pool)
    .await?;

    find_by_id(pool, &id).await
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Score, sqlx::Error> {
    sqlx::query_as::<_, Score>(
        "SELECT id, user_id, score, distance, items_collected, created_at FROM scores WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
}

pub async fn get_top_scores(pool: &SqlitePool, limit: i64) -> Result<Vec<Score>, sqlx::Error> {
    sqlx::query_as::<_, Score>(
        "SELECT id, user_id, score, distance, items_collected, created_at FROM scores ORDER BY score DESC LIMIT ?",
    )
    .bind(limit)
    .fetch_all(pool)
    .await
}
