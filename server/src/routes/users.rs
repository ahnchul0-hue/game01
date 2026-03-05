use axum::extract::State;
use axum::http::StatusCode;
use axum::routing::post;
use axum::{Json, Router};

use crate::error::AppError;
use crate::models::user;
use crate::routes::AppState;

/// Base router without rate limiting — rate limit applied in main.rs via GovernorLayer
pub fn router() -> Router<AppState> {
    Router::new().route("/api/users", post(create_user))
}

async fn create_user(
    State(state): State<AppState>,
) -> Result<(StatusCode, Json<user::UserResponse>), AppError> {
    let resp = user::create_user(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(resp)))
}
