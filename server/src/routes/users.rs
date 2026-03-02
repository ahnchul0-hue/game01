use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Serialize;

use crate::error::AppError;
use crate::models::user;
use crate::routes::AppState;

#[derive(Serialize)]
pub struct PublicUser {
    pub id: String,
    pub created_at: String,
}

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
) -> Result<Json<PublicUser>, AppError> {
    let u = user::find_by_id(&state.pool, &id).await?;
    Ok(Json(PublicUser {
        id: u.id,
        created_at: u.created_at,
    }))
}
