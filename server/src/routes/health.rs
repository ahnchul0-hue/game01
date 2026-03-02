use axum::{Router, Json, extract::State, http::StatusCode};
use serde::Serialize;
use super::AppState;

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    db: &'static str,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/api/health", axum::routing::get(health_check))
}

async fn health_check(State(state): State<AppState>) -> (StatusCode, Json<HealthResponse>) {
    match sqlx::query("SELECT 1").fetch_one(&state.pool).await {
        Ok(_) => (StatusCode::OK, Json(HealthResponse { status: "ok", db: "connected" })),
        Err(_) => (StatusCode::SERVICE_UNAVAILABLE, Json(HealthResponse { status: "error", db: "disconnected" })),
    }
}
