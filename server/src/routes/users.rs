use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};

use crate::error::AppError;
use crate::models::user;
use crate::routes::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/users", post(create_user))
        .route("/api/users/{id}", get(get_user))
}

async fn create_user(State(state): State<AppState>) -> Result<Json<user::UserResponse>, AppError> {
    let resp = user::create_user(&state.pool).await?;
    Ok(Json(resp))
}

async fn get_user(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<user::User>, AppError> {
    let u = user::find_by_id(&state.pool, &id).await?;
    Ok(Json(u))
}
