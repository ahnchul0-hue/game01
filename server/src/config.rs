use std::env;

pub struct Config {
    pub database_url: String,
    pub host: String,
    pub port: u16,
    pub cors_origins: Vec<String>,
}

impl Config {
    pub fn from_env() -> Self {
        let database_url = env::var("DATABASE_URL")
            .unwrap_or_else(|_| "sqlite:./data.db?mode=rwc".to_string());
        let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port: u16 = env::var("PORT")
            .unwrap_or_else(|_| "3000".to_string())
            .parse()
            .expect("PORT must be a number");

        let cors_origins: Vec<String> = env::var("CORS_ORIGINS")
            .unwrap_or_else(|_| "http://localhost:5173,http://localhost".to_string())
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        Config {
            database_url,
            host,
            port,
            cors_origins,
        }
    }
}
