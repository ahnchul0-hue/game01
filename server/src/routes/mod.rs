pub mod companions;
pub mod health;
pub mod inventory;
pub mod missions;
pub mod scores;
pub mod users;

use axum::http::HeaderMap;
use axum::Router;
use sqlx::SqlitePool;

use crate::error::AppError;

/// Extracts and validates the Bearer token from the Authorization header.
/// Shared by all route modules to avoid duplication (S-7).
pub fn extract_token(headers: &HeaderMap) -> Result<&str, AppError> {
    let token = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(AppError::Unauthorized)?;
    if token.len() > 64 {
        return Err(AppError::Unauthorized);
    }
    Ok(token)
}

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
}

pub fn create_router(pool: SqlitePool) -> Router {
    let state = AppState { pool };

    Router::new()
        .merge(health::router())
        .merge(users::router())
        .merge(scores::router())
        .merge(inventory::router())
        .merge(missions::router())
        .merge(companions::router())
        .with_state(state)
}
