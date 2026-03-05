use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono;
use serde::Deserialize;

use crate::error::AppError;
use crate::models::{missions, score, user};
use crate::routes::{extract_token, AppState};

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
) -> Result<(StatusCode, Json<score::Score>), AppError> {
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

    // S1: Score plausibility check — cap score based on distance + items
    // Max ~2 points/meter (distance bonus) + ~200 points/item (combo cap 3.0 × 50pt item × margin)
    let max_plausible = req.distance * 2 + req.items_collected * 200 + 500; // +500 base margin
    let req = if req.score > max_plausible {
        tracing::warn!(
            submitted = req.score,
            max = max_plausible,
            distance = req.distance,
            items = req.items_collected,
            "Score exceeds plausibility — capping"
        );
        score::CreateScoreRequest {
            score: max_plausible,
            ..req
        }
    } else {
        req
    };

    // 토큰으로 유저 조회
    let u = user::find_by_token(&state.pool, token)
        .await
        .map_err(|e| {
            tracing::warn!("Unauthorized score attempt: {:?}", e);
            AppError::Unauthorized
        })?;

    // 점수 제출 빈도 제한: 60초 내 5회 초과 시 429
    let recent_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM scores WHERE user_id = ? AND created_at > datetime('now', '-60 seconds')",
    )
    .bind(&u.id)
    .fetch_one(&state.pool)
    .await?;

    if recent_count >= 5 {
        tracing::warn!(user_id = %u.id, "Rate limit exceeded for scores");
        return Err(AppError::TooManyRequests);
    }

    // 점수 저장
    let s = score::create_score(&state.pool, &u.id, &req).await?;

    // S-1: Update streak on every score submission so that streak_claim_reward
    // can verify the user has genuinely played today (last_play_date == today).
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    if let Err(e) = missions::update_streak(&state.pool, &u.id, &today).await {
        // Non-fatal: log but don't fail the score submission
        tracing::warn!(user_id = %u.id, "Failed to update streak after score: {:?}", e);
    }

    Ok((StatusCode::CREATED, Json(s)))
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
            user_id: s.user_id,
            score: s.score,
            distance: s.distance,
            items_collected: s.items_collected,
            created_at: s.created_at,
        })
        .collect();
    Ok(Json(public_scores))
}
