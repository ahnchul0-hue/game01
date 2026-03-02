use axum::extract::State;
use axum::http::HeaderMap;
use axum::routing::get;
use axum::{Json, Router};

use crate::error::AppError;
use crate::models::{inventory, user};
use crate::routes::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/inventory", get(get_inventory).put(add_inventory))
        .route("/api/onsen/layout", get(get_layout).put(save_layout))
        .route("/api/skins", get(get_skins).put(save_skins))
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

async fn get_inventory(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<inventory::InventoryRow>, AppError> {
    let token = extract_token(&headers)?;
    let u = user::find_by_token(&state.pool, token)
        .await
        .map_err(|_| AppError::Unauthorized)?;
    let inv = inventory::get_inventory(&state.pool, &u.id).await?;
    Ok(Json(inv))
}

async fn add_inventory(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<inventory::AddInventoryRequest>,
) -> Result<Json<inventory::InventoryRow>, AppError> {
    // 음수 값 방지
    if req.add_mandarin < 0 || req.add_watermelon < 0 || req.add_hotspring_material < 0 {
        return Err(AppError::BadRequest(
            "Inventory values must be non-negative".to_string(),
        ));
    }

    const MAX_ADD_PER_REQUEST: i64 = 1000;
    if req.add_mandarin > MAX_ADD_PER_REQUEST
        || req.add_watermelon > MAX_ADD_PER_REQUEST
        || req.add_hotspring_material > MAX_ADD_PER_REQUEST
    {
        return Err(AppError::BadRequest(
            "Inventory delta too large".to_string(),
        ));
    }

    let token = extract_token(&headers)?;
    let u = user::find_by_token(&state.pool, token)
        .await
        .map_err(|_| AppError::Unauthorized)?;
    let inv = inventory::add_inventory(&state.pool, &u.id, &req).await?;
    Ok(Json(inv))
}

async fn get_layout(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<inventory::OnsenLayoutRow>, AppError> {
    let token = extract_token(&headers)?;
    let u = user::find_by_token(&state.pool, token)
        .await
        .map_err(|_| AppError::Unauthorized)?;
    let layout = inventory::get_layout(&state.pool, &u.id).await?;
    Ok(Json(layout))
}

async fn save_layout(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<inventory::SaveLayoutRequest>,
) -> Result<Json<inventory::OnsenLayoutRow>, AppError> {
    // JSON 유효성 검증 + 크기 제한 (100KB)
    if req.layout_json.len() > 100_000 {
        return Err(AppError::BadRequest("Layout too large".to_string()));
    }
    serde_json::from_str::<serde_json::Value>(&req.layout_json)
        .map_err(|_| AppError::BadRequest("Invalid JSON in layout_json".to_string()))?;

    let token = extract_token(&headers)?;
    let u = user::find_by_token(&state.pool, token)
        .await
        .map_err(|_| AppError::Unauthorized)?;
    let layout = inventory::upsert_layout(&state.pool, &u.id, &req).await?;
    Ok(Json(layout))
}

async fn get_skins(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<inventory::UserSkinRow>, AppError> {
    let token = extract_token(&headers)?;
    let u = user::find_by_token(&state.pool, token)
        .await
        .map_err(|_| AppError::Unauthorized)?;
    let skins = inventory::get_skins(&state.pool, &u.id).await?;
    Ok(Json(skins))
}

async fn save_skins(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<inventory::SaveSkinsRequest>,
) -> Result<Json<inventory::UserSkinRow>, AppError> {
    const VALID_SKINS: &[&str] = &["default", "towel", "yukata", "santa"];
    if !VALID_SKINS.contains(&req.selected_skin.as_str()) {
        return Err(AppError::BadRequest("Invalid skin id".to_string()));
    }

    // Validate each skin in unlocked_skins JSON array
    let unlocked: Vec<String> = serde_json::from_str(&req.unlocked_skins)
        .map_err(|_| AppError::BadRequest("Invalid unlocked_skins JSON".to_string()))?;
    for skin in &unlocked {
        if !VALID_SKINS.contains(&skin.as_str()) {
            return Err(AppError::BadRequest(format!("Invalid skin id: {}", skin)));
        }
    }

    let token = extract_token(&headers)?;
    let u = user::find_by_token(&state.pool, token)
        .await
        .map_err(|_| AppError::Unauthorized)?;
    let skins = inventory::upsert_skins(&state.pool, &u.id, &req).await?;
    Ok(Json(skins))
}
