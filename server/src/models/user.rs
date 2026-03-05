use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: String,
    pub token: String,
    pub created_at: String,
}

#[derive(Serialize)]
pub struct UserResponse {
    pub id: String,
    pub token: String,
}

pub async fn create_user(pool: &SqlitePool) -> Result<UserResponse, sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    let token = Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO users (id, token) VALUES (?, ?)")
        .bind(&id)
        .bind(&token)
        .execute(pool)
        .await?;

    Ok(UserResponse { id, token })
}

pub async fn find_by_token(pool: &SqlitePool, token: &str) -> Result<User, sqlx::Error> {
    sqlx::query_as::<_, User>("SELECT id, token, created_at FROM users WHERE token = ?")
        .bind(token)
        .fetch_one(pool)
        .await
}
