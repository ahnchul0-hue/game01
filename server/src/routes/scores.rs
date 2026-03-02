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

async fn create_score(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<score::CreateScoreRequest>,
) -> Result<Json<score::Score>, AppError> {
    // Bearer token 추출
    let token = extract_token(&headers)?;

    // 입력 값 검증
    if req.score < 0 || req.distance < 0 || req.items_collected < 0 {
        return Err(AppError::BadRequest(
            "Score values must be non-negative".to_string(),
        ));
    }
    if req.score > 10_000_000 || req.distance > 1_000_000 || req.items_collected > 100_000 {
        return Err(AppError::BadRequest(
            "Score values exceed maximum allowed".to_string(),
        ));
    }

    // 토큰으로 유저 조회
    let u = user::find_by_token(&state.pool, token)
        .await
        .map_err(|_| AppError::Unauthorized)?;

    // 점수 제출 빈도 제한: 60초 내 5회 초과 시 429
    let recent_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM scores WHERE user_id = ? AND created_at > datetime('now', '-60 seconds')",
    )
    .bind(&u.id)
    .fetch_one(&state.pool)
    .await?;

    if recent_count >= 5 {
        return Err(AppError::TooManyRequests);
    }

    // 점수 저장
    let s = score::create_score(&state.pool, &u.id, &req).await?;
    Ok(Json(s))
}

async fn get_top_scores(
    State(state): State<AppState>,
    Query(params): Query<TopScoresQuery>,
) -> Result<Json<Vec<score::PublicScore>>, AppError> {
    let limit = params.limit.unwrap_or(10).min(100);
    let scores = score::get_top_scores(&state.pool, limit).await?;
    let public_scores = scores
        .into_iter()
        .map(|s| score::PublicScore {
            score: s.score,
            distance: s.distance,
            items_collected: s.items_collected,
            created_at: s.created_at,
        })
        .collect();
    Ok(Json(public_scores))
}
