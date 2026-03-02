mod config;
mod db;
mod error;
mod models;
mod routes;

use axum::http::{header, HeaderValue, Method};
use tower_http::cors::{AllowOrigin, CorsLayer};

use crate::config::Config;

#[tokio::main]
async fn main() {
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

    let app = routes::create_router(pool).layer(cors);

    let addr = format!("{}:{}", config.host, config.port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind");

    println!("Server running on {}", addr);
    axum::serve(listener, app).await.unwrap();
}
