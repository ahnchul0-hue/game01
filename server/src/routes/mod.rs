pub mod health;
pub mod inventory;
pub mod scores;
pub mod users;

use axum::Router;
use sqlx::SqlitePool;

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
        .with_state(state)
}
