use axum::{Router, Json, http::StatusCode};
use serde::Deserialize;
use super::AppState;

const MAX_ERRORS_PER_BATCH: usize = 10;
const MAX_MESSAGE_LEN: usize = 512;
const MAX_STACK_LEN: usize = 1024;

#[derive(Deserialize)]
struct TelemetryPayload {
    errors: Vec<ClientError>,
}

#[derive(Deserialize)]
struct ClientError {
    #[serde(rename = "type")]
    error_type: String,
    message: String,
    source: Option<String>,
    line: Option<u32>,
    col: Option<u32>,
    stack: Option<String>,
    ts: Option<u64>,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/api/telemetry", axum::routing::post(receive_telemetry))
}

async fn receive_telemetry(
    Json(payload): Json<TelemetryPayload>,
) -> StatusCode {
    let count = payload.errors.len().min(MAX_ERRORS_PER_BATCH);

    for err in payload.errors.into_iter().take(count) {
        let msg = truncate(&err.message, MAX_MESSAGE_LEN);
        let stack = err.stack.as_deref().map(|s| truncate(s, MAX_STACK_LEN));
        let source = err.source.as_deref().unwrap_or("unknown");
        let line = err.line.unwrap_or(0);
        let col = err.col.unwrap_or(0);

        tracing::warn!(
            target: "telemetry",
            error_type = %err.error_type,
            message = %msg,
            source = %source,
            line = line,
            col = col,
            stack = %stack.unwrap_or_default(),
            ts = err.ts.unwrap_or(0),
            "client_error"
        );
    }

    StatusCode::NO_CONTENT
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        format!("{}...", &s[..max])
    }
}
