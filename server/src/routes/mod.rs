pub mod companions;
pub mod health;
pub mod inventory;
pub mod missions;
pub mod scores;
pub mod telemetry;
pub mod users;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;

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

/// S1: Per-user rate limiter for inventory mutations
#[derive(Clone, Default)]
pub struct UserRateLimiter {
    last_access: Arc<Mutex<HashMap<String, Instant>>>,
}

impl UserRateLimiter {
    /// Returns true if the request should be allowed.
    /// Allows 1 request per `interval_secs` per user_id.
    pub fn check(&self, user_id: &str, interval_secs: u64) -> bool {
        let now = Instant::now();
        let mut map = self.last_access.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(last) = map.get(user_id) {
            if now.duration_since(*last).as_secs() < interval_secs {
                return false;
            }
        }
        map.insert(user_id.to_string(), now);
        true
    }
}

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub inventory_limiter: UserRateLimiter,
}

pub fn create_router(pool: SqlitePool) -> Router {
    let state = AppState {
        pool,
        inventory_limiter: UserRateLimiter::default(),
    };

    Router::new()
        .merge(health::router())
        .merge(users::router())
        .merge(scores::router())
        .merge(inventory::router())
        .merge(missions::router())
        .merge(companions::router())
        .merge(telemetry::router())
        .with_state(state)
}
