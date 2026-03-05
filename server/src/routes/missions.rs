use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::models::missions::{self, ClaimError, Mission, StreakResponse};
use crate::models::user;
use crate::routes::{extract_token, AppState};

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct DailyMissionsResponse {
    pub missions: Vec<Mission>,
    pub streak: StreakResponse,
    pub today: String,
}

#[derive(Serialize)]
pub struct MissionClaimResponse {
    pub mission: Mission,
}

#[derive(Serialize)]
pub struct StreakClaimResponse {
    pub streak: StreakResponse,
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct ProgressRequest {
    pub mission_type: String,
    pub progress: i64,
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/missions/daily", get(get_daily_missions))
        .route("/api/missions/progress", post(update_progress))
        .route("/api/missions/claim/{mission_id}", post(claim_mission))
        // C1: Fixed URL — was "/api/missions/streak-claim", now "/api/missions/streak/claim"
        .route("/api/missions/streak/claim", post(claim_streak))
}

fn today_utc() -> String {
    Utc::now().format("%Y-%m-%d").to_string()
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /api/missions/daily
/// Returns today's 3 missions (generated if not yet existing) and streak info.
async fn get_daily_missions(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<DailyMissionsResponse>, AppError> {
    let token = extract_token(&headers)?;
    let u = user::find_by_token(&state.pool, token)
        .await
        .map_err(|e| {
            tracing::warn!("Unauthorized missions/daily access: {:?}", e);
            AppError::Unauthorized
        })?;

    let today = today_utc();

    let mission_list =
        missions::get_or_create_daily_missions(&state.pool, &u.id, &today).await?;
    let streak = missions::get_or_create_streak(&state.pool, &u.id).await?;

    // C2: Derive today_reward_claimed from last_reward_date
    let streak_response = StreakResponse::from_streak(streak, &today);

    Ok(Json(DailyMissionsResponse {
        missions: mission_list,
        streak: streak_response,
        today,
    }))
}

/// POST /api/missions/progress
/// Body: { "mission_type": "collect_mandarins", "progress": 5 }
/// Updates the named mission's progress for today.
async fn update_progress(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<ProgressRequest>,
) -> Result<Json<Mission>, AppError> {
    // Validate mission_type
    const VALID_TYPES: &[&str] = &["collect_mandarins", "run_distance", "dodge_obstacles"];
    if !VALID_TYPES.contains(&req.mission_type.as_str()) {
        return Err(AppError::BadRequest("Invalid mission_type".to_string()));
    }
    if req.progress <= 0 {
        return Err(AppError::BadRequest(
            "progress must be positive".to_string(),
        ));
    }
    if req.progress > 10_000 {
        return Err(AppError::BadRequest("progress delta too large".to_string()));
    }

    let token = extract_token(&headers)?;
    let u = user::find_by_token(&state.pool, token)
        .await
        .map_err(|e| {
            tracing::warn!("Unauthorized missions/progress attempt: {:?}", e);
            AppError::Unauthorized
        })?;

    let today = today_utc();

    // Rate limit: max 10 mission progress updates per user per 60 seconds
    // Only count non-completed missions to prevent bypass via already-completed missions
    let recent_update_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM daily_missions WHERE user_id = ? AND updated_at > datetime('now', '-60 seconds') AND completed = 0",
    )
    .bind(&u.id)
    .fetch_one(&state.pool)
    .await?;

    if recent_update_count >= 10 {
        tracing::warn!(user_id = %u.id, "Rate limit exceeded for missions");
        return Err(AppError::TooManyRequests);
    }

    // Ensure missions exist for today before updating
    missions::get_or_create_daily_missions(&state.pool, &u.id, &today).await?;

    // S1: The model's update_mission_progress returns early (idempotent) if
    // the mission is already completed, preventing unbounded progress spam.
    let mission = missions::update_mission_progress(
        &state.pool,
        &u.id,
        &today,
        &req.mission_type,
        req.progress,
    )
    .await?;

    Ok(Json(mission))
}

/// POST /api/missions/claim/:mission_id
/// Claims the reward for a completed mission.
async fn claim_mission(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(mission_id): Path<i64>,
) -> Result<Json<MissionClaimResponse>, AppError> {
    let token = extract_token(&headers)?;
    let u = user::find_by_token(&state.pool, token)
        .await
        .map_err(|e| {
            tracing::warn!("Unauthorized mission claim attempt: {:?}", e);
            AppError::Unauthorized
        })?;

    let mission = missions::claim_mission_reward(&state.pool, &u.id, mission_id)
        .await
        .map_err(|e| match e {
            ClaimError::NotFound => AppError::NotFound("Mission not found".to_string()),
            ClaimError::NotCompleted => {
                AppError::BadRequest("Mission not yet completed".to_string())
            }
            ClaimError::AlreadyClaimed => {
                AppError::BadRequest("Reward already claimed".to_string())
            }
            ClaimError::Db(db_err) => AppError::from(db_err),
        })?;

    Ok(Json(MissionClaimResponse { mission }))
}

/// POST /api/missions/streak/claim
/// Claims today's streak reward and updates last_play_date + last_reward_date.
async fn claim_streak(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<StreakClaimResponse>, AppError> {
    let token = extract_token(&headers)?;
    let u = user::find_by_token(&state.pool, token)
        .await
        .map_err(|e| {
            tracing::warn!("Unauthorized streak claim attempt: {:?}", e);
            AppError::Unauthorized
        })?;

    let today = today_utc();

    let streak = missions::claim_streak_reward(&state.pool, &u.id, &today)
        .await
        .map_err(|e| match e {
            ClaimError::NotFound => AppError::NotFound("Streak not found".to_string()),
            ClaimError::NotCompleted => AppError::BadRequest("Streak not active".to_string()),
            ClaimError::AlreadyClaimed => {
                AppError::BadRequest("Streak reward already claimed today".to_string())
            }
            ClaimError::Db(db_err) => AppError::from(db_err),
        })?;

    // C2: Derive today_reward_claimed from last_reward_date
    let streak_response = StreakResponse::from_streak(streak, &today);

    Ok(Json(StreakClaimResponse {
        streak: streak_response,
    }))
}
