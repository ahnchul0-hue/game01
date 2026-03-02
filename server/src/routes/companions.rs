use axum::extract::State;
use axum::http::HeaderMap;
use axum::routing::get;
use axum::{Json, Router};

use crate::error::AppError;
use crate::models::{companions, user};
use crate::routes::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/companions", get(get_companions).put(save_companions))
}

fn extract_token(headers: &HeaderMap) -> Result<&str, AppError> {
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

async fn get_companions(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<companions::CompanionRow>, AppError> {
    let token = extract_token(&headers)?;
    let u = user::find_by_token(&state.pool, token)
        .await
        .map_err(|_| AppError::Unauthorized)?;
    let row = companions::get_companions(&state.pool, &u.id).await?;
    Ok(Json(row))
}

async fn save_companions(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<companions::SaveCompanionRequest>,
) -> Result<Json<companions::CompanionRow>, AppError> {
    if !companions::VALID_IDS.contains(&req.selected_companion.as_str()) {
        return Err(AppError::BadRequest("Invalid companion id".to_string()));
    }
    for id in &req.unlocked_companions {
        if !companions::VALID_IDS.contains(&id.as_str()) {
            return Err(AppError::BadRequest(format!("Invalid companion id: {}", id)));
        }
    }

    let token = extract_token(&headers)?;
    let u = user::find_by_token(&state.pool, token)
        .await
        .map_err(|_| AppError::Unauthorized)?;
    let row = companions::save_companions(&state.pool, &u.id, &req).await?;
    Ok(Json(row))
}
