//! Integration tests for the Capybara Runner API.
//!
//! Each test uses an in-memory SQLite DB with auto-applied migrations,
//! giving full isolation without filesystem artifacts.

use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use tower::ServiceExt;

// Re-import the server crate's public items.
// Cargo integration tests treat the crate as an external dependency.
use capybara_runner_server::routes;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/// Create a fresh in-memory SQLite pool with all migrations applied.
async fn test_pool() -> sqlx::SqlitePool {
    let opts = SqliteConnectOptions::new()
        .filename(":memory:")
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(opts)
        .await
        .expect("in-memory sqlite");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("migrations");

    pool
}

/// Build the Axum app (no CORS / rate-limit layers — pure handler tests).
fn app(pool: sqlx::SqlitePool) -> axum::Router {
    routes::create_router(pool)
}

/// Send a request with a JSON body — returns (StatusCode, parsed body).
async fn request_json(
    app: axum::Router,
    method: &str,
    uri: &str,
    body: Value,
    token: Option<&str>,
) -> (StatusCode, Value) {
    let mut builder = Request::builder().method(method).uri(uri);
    builder = builder.header("content-type", "application/json");
    if let Some(t) = token {
        builder = builder.header("authorization", format!("Bearer {t}"));
    }
    let req = builder
        .body(axum::body::Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    let status = resp.status();
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    (status, json)
}

/// POST JSON helper.
async fn post_json(
    app: axum::Router,
    uri: &str,
    body: Value,
    token: Option<&str>,
) -> (StatusCode, Value) {
    request_json(app, "POST", uri, body, token).await
}

/// PUT JSON helper.
async fn put_json(
    app: axum::Router,
    uri: &str,
    body: Value,
    token: Option<&str>,
) -> (StatusCode, Value) {
    request_json(app, "PUT", uri, body, token).await
}

/// GET helper — returns (StatusCode, parsed body).
async fn get_json(
    app: axum::Router,
    uri: &str,
    token: Option<&str>,
) -> (StatusCode, Value) {
    let mut builder = Request::builder().method("GET").uri(uri);
    if let Some(t) = token {
        builder = builder.header("authorization", format!("Bearer {t}"));
    }
    let req = builder.body(axum::body::Body::empty()).unwrap();

    let resp = app.oneshot(req).await.unwrap();
    let status = resp.status();
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    (status, json)
}

/// Create a user and return the token.
async fn create_user(pool: &sqlx::SqlitePool) -> String {
    let a = app(pool.clone());
    let (status, body) = post_json(a, "/api/users", json!({}), None).await;
    assert_eq!(status, StatusCode::CREATED, "create_user failed: {body}");
    body["token"].as_str().unwrap().to_string()
}

// ===========================================================================
// Health
// ===========================================================================

#[tokio::test]
async fn health_check_returns_ok() {
    let pool = test_pool().await;
    let (status, body) = get_json(app(pool), "/api/health", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["status"], "ok");
    assert_eq!(body["db"], "connected");
}

// ===========================================================================
// Users
// ===========================================================================

#[tokio::test]
async fn create_user_returns_id_and_token() {
    let pool = test_pool().await;
    let (status, body) = post_json(app(pool), "/api/users", json!({}), None).await;
    assert_eq!(status, StatusCode::CREATED);
    assert!(body["id"].is_string());
    assert!(body["token"].is_string());
    // UUID v4 format: 36 chars
    assert_eq!(body["token"].as_str().unwrap().len(), 36);
}

// ===========================================================================
// Scores
// ===========================================================================

#[tokio::test]
async fn submit_and_retrieve_scores() {
    let pool = test_pool().await;
    let token = create_user(&pool).await;

    // Submit a score
    let (status, body) = post_json(
        app(pool.clone()),
        "/api/scores",
        json!({ "score": 1500, "distance": 3000, "items_collected": 42 }),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(body["score"], 1500);
    assert_eq!(body["distance"], 3000);
    assert_eq!(body["items_collected"], 42);

    // Get top scores
    let (status, top) = get_json(app(pool.clone()), "/api/scores/top?limit=10", None).await;
    assert_eq!(status, StatusCode::OK);
    let arr = top.as_array().unwrap();
    assert_eq!(arr.len(), 1);
    assert_eq!(arr[0]["score"], 1500);
    // PublicScore should NOT include user_id
    assert!(arr[0].get("user_id").is_none());
}

#[tokio::test]
async fn score_rejects_negative_values() {
    let pool = test_pool().await;
    let token = create_user(&pool).await;

    let (status, body) = post_json(
        app(pool),
        "/api/scores",
        json!({ "score": -1, "distance": 100, "items_collected": 0 }),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body["error"].as_str().unwrap().contains("non-negative"));
}

#[tokio::test]
async fn score_rejects_excessive_values() {
    let pool = test_pool().await;
    let token = create_user(&pool).await;

    let (status, _) = post_json(
        app(pool),
        "/api/scores",
        json!({ "score": 99_999_999, "distance": 100, "items_collected": 0 }),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn score_requires_auth() {
    let pool = test_pool().await;

    let (status, _) = post_json(
        app(pool),
        "/api/scores",
        json!({ "score": 100, "distance": 100, "items_collected": 0 }),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn score_rejects_invalid_token() {
    let pool = test_pool().await;

    let (status, _) = post_json(
        app(pool),
        "/api/scores",
        json!({ "score": 100, "distance": 100, "items_collected": 0 }),
        Some("invalid-token-that-does-not-exist"),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

// ===========================================================================
// Inventory
// ===========================================================================

#[tokio::test]
async fn inventory_add_and_get() {
    let pool = test_pool().await;
    let token = create_user(&pool).await;

    // Add items (PUT /api/inventory)
    let (status, body) = put_json(
        app(pool.clone()),
        "/api/inventory",
        json!({ "add_mandarin": 10, "add_watermelon": 5, "add_hotspring_material": 3 }),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["mandarin"], 10);
    assert_eq!(body["watermelon"], 5);
    assert_eq!(body["hotspring_material"], 3);

    // Get inventory
    let (status, body) = get_json(app(pool.clone()), "/api/inventory", Some(&token)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["mandarin"], 10);
    // user_id should be hidden
    assert!(body.get("user_id").is_none());
}

#[tokio::test]
async fn inventory_rejects_negative_add() {
    let pool = test_pool().await;
    let token = create_user(&pool).await;

    let (status, _) = put_json(
        app(pool),
        "/api/inventory",
        json!({ "add_mandarin": -5, "add_watermelon": 0, "add_hotspring_material": 0 }),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

// ===========================================================================
// Missions
// ===========================================================================

#[tokio::test]
async fn daily_missions_generated_on_first_fetch() {
    let pool = test_pool().await;
    let token = create_user(&pool).await;

    let (status, body) =
        get_json(app(pool.clone()), "/api/missions/daily", Some(&token)).await;
    assert_eq!(status, StatusCode::OK);

    let missions = body["missions"].as_array().unwrap();
    assert_eq!(missions.len(), 3, "should generate 3 daily missions");
    assert!(body["today"].is_string());
    assert!(body["streak"].is_object());
    // user_id should be hidden in missions
    for m in missions {
        assert!(m.get("user_id").is_none());
    }
}

#[tokio::test]
async fn mission_progress_and_claim() {
    let pool = test_pool().await;
    let token = create_user(&pool).await;

    // Fetch missions to trigger creation
    let (_, body) = get_json(app(pool.clone()), "/api/missions/daily", Some(&token)).await;
    let missions = body["missions"].as_array().unwrap();
    let first_type = missions[0]["mission_type"].as_str().unwrap().to_string();
    let first_target = missions[0]["target_value"].as_i64().unwrap();

    // Get mission_id directly from DB (since it's skip_serialized in JSON)
    let mission_id: i64 = sqlx::query_scalar(
        "SELECT id FROM daily_missions WHERE mission_type = ? ORDER BY id ASC LIMIT 1",
    )
    .bind(&first_type)
    .fetch_one(&pool)
    .await
    .unwrap();

    // Update progress to meet target
    let (status, _) = post_json(
        app(pool.clone()),
        "/api/missions/progress",
        json!({ "mission_type": first_type, "progress": first_target }),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    // Claim reward
    let (status, body) = post_json(
        app(pool.clone()),
        &format!("/api/missions/claim/{mission_id}"),
        json!({}),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    // SQLite stores boolean as integer (1/0)
    assert_eq!(body["mission"]["reward_claimed"], 1);

    // Double claim should fail
    let (status, body) = post_json(
        app(pool.clone()),
        &format!("/api/missions/claim/{mission_id}"),
        json!({}),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body["error"].as_str().unwrap().contains("already claimed"));
}

#[tokio::test]
async fn mission_progress_rejects_invalid_type() {
    let pool = test_pool().await;
    let token = create_user(&pool).await;

    // Ensure missions exist first
    get_json(app(pool.clone()), "/api/missions/daily", Some(&token)).await;

    let (status, body) = post_json(
        app(pool),
        "/api/missions/progress",
        json!({ "mission_type": "hack_the_planet", "progress": 1 }),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body["error"].as_str().unwrap().contains("Invalid"));
}

#[tokio::test]
async fn mission_progress_rejects_non_positive() {
    let pool = test_pool().await;
    let token = create_user(&pool).await;

    get_json(app(pool.clone()), "/api/missions/daily", Some(&token)).await;

    let (status, _) = post_json(
        app(pool),
        "/api/missions/progress",
        json!({ "mission_type": "collect_mandarins", "progress": 0 }),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

// ===========================================================================
// Streak
// ===========================================================================

#[tokio::test]
async fn streak_claim_works_once_per_day() {
    let pool = test_pool().await;
    let token = create_user(&pool).await;

    // S-1: Must submit a score first — that sets last_play_date = today via update_streak.
    let (score_status, _) = post_json(
        app(pool.clone()),
        "/api/scores",
        json!({ "score": 100, "distance": 100, "items_collected": 1 }),
        Some(&token),
    )
    .await;
    assert_eq!(score_status, StatusCode::CREATED, "score submission must succeed");

    // First streak claim should succeed (last_play_date == today now)
    let (status, body) = post_json(
        app(pool.clone()),
        "/api/missions/streak/claim",
        json!({}),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(body["streak"]["today_reward_claimed"].as_bool().unwrap());

    // Second claim same day should fail
    let (status, body) = post_json(
        app(pool.clone()),
        "/api/missions/streak/claim",
        json!({}),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body["error"]
        .as_str()
        .unwrap()
        .contains("already claimed"));
}

// ===========================================================================
// Security: Token length
// ===========================================================================

#[tokio::test]
async fn rejects_oversized_token() {
    let pool = test_pool().await;
    let long_token = "a".repeat(65);

    let (status, _) = post_json(
        app(pool),
        "/api/scores",
        json!({ "score": 100, "distance": 100, "items_collected": 0 }),
        Some(&long_token),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

// ===========================================================================
// Companions
// ===========================================================================

#[tokio::test]
async fn companion_get_default() {
    let pool = test_pool().await;
    let token = create_user(&pool).await;

    let (status, body) = get_json(app(pool), "/api/companions", Some(&token)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["selected_companion"], "none");
    assert_eq!(body["unlocked_companions"], "[]");
    // user_id should be hidden
    assert!(body.get("user_id").is_none());
}

#[tokio::test]
async fn companion_save_and_get() {
    let pool = test_pool().await;
    let token = create_user(&pool).await;

    // Save companion selection
    let (status, body) = put_json(
        app(pool.clone()),
        "/api/companions",
        json!({
            "selected_companion": "otter",
            "unlocked_companions": ["otter", "duck"]
        }),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "PUT failed: {body}");
    assert_eq!(body["selected_companion"], "otter");

    // GET should return persisted data
    let (status, body) = get_json(app(pool), "/api/companions", Some(&token)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["selected_companion"], "otter");
    // unlocked_companions is stored as a JSON string in the DB
    let unlocked: Vec<String> =
        serde_json::from_str(body["unlocked_companions"].as_str().unwrap()).unwrap();
    assert!(unlocked.contains(&"otter".to_string()));
    assert!(unlocked.contains(&"duck".to_string()));
}

#[tokio::test]
async fn companion_rejects_invalid_id() {
    let pool = test_pool().await;
    let token = create_user(&pool).await;

    let (status, body) = put_json(
        app(pool),
        "/api/companions",
        json!({
            "selected_companion": "dragon",
            "unlocked_companions": []
        }),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body["error"].as_str().unwrap().contains("Invalid companion id"));
}
