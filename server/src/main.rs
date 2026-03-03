mod config;
mod db;
mod error;
mod models;
mod routes;

use axum::http::{header, HeaderValue, Method};
use std::net::SocketAddr;
use tower_governor::{GovernorLayer, governor::GovernorConfigBuilder, key_extractor::SmartIpKeyExtractor};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::trace::TraceLayer;

use crate::config::Config;

#[tokio::main]
async fn main() {
    // S6: 구조화 로깅 초기화
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    dotenvy::dotenv().ok();

    let config = Config::from_env();
    let pool = db::init_db(&config.database_url).await;

    let origins: Vec<HeaderValue> = config.cors_origins.iter()
        .filter_map(|o| o.parse::<HeaderValue>().ok())
        .collect();
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([Method::GET, Method::POST, Method::PUT])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION]);

    // S1: IP별 레이트 리밋 — 10초당 30회 (초당 3회 버스트 30)
    let governor_conf = GovernorConfigBuilder::default()
        .per_second(3)          // 10초당 30회 = 초당 3회
        .burst_size(30)
        .key_extractor(SmartIpKeyExtractor)
        .finish()
        .expect("GovernorConfig build failed");

    let governor_limiter = governor_conf.limiter().clone();

    // 만료된 항목 주기적 정리 (메모리 누수 방지)
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
            governor_limiter.retain_recent();
        }
    });

    let app = routes::create_router(pool)
        .layer(GovernorLayer::new(governor_conf))
        .layer(RequestBodyLimitLayer::new(256 * 1024))
        .layer(TraceLayer::new_for_http())
        .layer(cors);

    let addr = format!("{}:{}", config.host, config.port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind");

    tracing::info!("Server running on {}", addr);
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
        .await
        .unwrap();
}
