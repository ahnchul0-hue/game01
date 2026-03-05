use axum::extract::State;
use axum::http::HeaderMap;
use axum::routing::get;
use axum::{Json, Router};

use crate::error::AppError;
use crate::models::{companions, user};
use crate::routes::{extract_token, AppState};

pub fn router() -> Router<AppState> {
    Router::new().route("/api/companions", get(get_companions).put(save_companions))
}

async fn get_companions(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<companions::CompanionRow>, AppError> {
    let token = extract_token(&headers)?;
    let u = user::find_by_token(&state.pool, token)
        .await
        .map_err(|e| {
            tracing::warn!("Unauthorized companions access: {:?}", e);
            AppError::Unauthorized
        })?;
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

    // C2: Verify selected_companion is actually in the unlocked list (or is 'none')
    if req.selected_companion != "none"
        && !req.unlocked_companions.contains(&req.selected_companion)
    {
        return Err(AppError::BadRequest(
            "selected_companion is not in unlocked_companions".to_string(),
        ));
    }

    let token = extract_token(&headers)?;
    let u = user::find_by_token(&state.pool, token)
        .await
        .map_err(|e| {
            tracing::warn!("Unauthorized companions save attempt: {:?}", e);
            AppError::Unauthorized
        })?;
    let row = companions::save_companions(&state.pool, &u.id, &req).await?;
    Ok(Json(row))
}
