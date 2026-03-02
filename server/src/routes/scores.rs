use axum::extract::{Query, State};
use axum::http::HeaderMap;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;

use crate::error::AppError;
use crate::models::{score, user};
use crate::routes::AppState;

#[derive(Deserialize)]
struct TopScoresQuery {
    limit: Option<i64>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/scores", post(create_score))
        .route("/api/scores/top", get(get_top_scores))
}

async fn create_score(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<score::CreateScoreRequest>,
) -> Result<Json<score::Score>, AppError> {
    // Bearer token 추출
    let token = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(AppError::Unauthorized)?;

    // 토큰으로 유저 조회
    let u = user::find_by_token(&state.pool, token)
        .await
        .map_err(|_| AppError::Unauthorized)?;

    // 점수 저장
    let s = score::create_score(&state.pool, &u.id, &req).await?;
    Ok(Json(s))
}

async fn get_top_scores(
    State(state): State<AppState>,
    Query(params): Query<TopScoresQuery>,
) -> Result<Json<Vec<score::Score>>, AppError> {
    let limit = params.limit.unwrap_or(10);
    let scores = score::get_top_scores(&state.pool, limit).await?;
    Ok(Json(scores))
}
