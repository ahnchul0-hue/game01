use axum::extract::State;
use axum::http::StatusCode;
use axum::routing::post;
use axum::{Json, Router};
use tower_governor::{GovernorLayer, governor::GovernorConfigBuilder, key_extractor::SmartIpKeyExtractor};

use crate::error::AppError;
use crate::models::user;
use crate::routes::AppState;

pub fn router() -> Router<AppState> {
    // 유저 생성 전용 레이트리밋: 분당 5회 (12초당 1회, 버스트 5)
    let user_create_gov = GovernorConfigBuilder::default()
        .per_second(12)
        .burst_size(5)
        .key_extractor(SmartIpKeyExtractor)
        .finish()
        .expect("User creation rate limit config failed");

    Router::new().route("/api/users", post(create_user))
        .layer(GovernorLayer::new(user_create_gov))
}

async fn create_user(
    State(state): State<AppState>,
) -> Result<(StatusCode, Json<user::UserResponse>), AppError> {
    let resp = user::create_user(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(resp)))
}
