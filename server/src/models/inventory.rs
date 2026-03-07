use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use uuid::Uuid;

// --- Inventory ---

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct InventoryRow {
    #[serde(skip_serializing)]
    #[allow(dead_code)]
    pub id: String,
    #[serde(skip_serializing)]
    #[allow(dead_code)]
    pub user_id: String,
    pub mandarin: i64,
    pub watermelon: i64,
    pub hotspring_material: i64,
    pub gem: i64,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct AddInventoryRequest {
    #[serde(default)]
    pub add_mandarin: i64,
    #[serde(default)]
    pub add_watermelon: i64,
    #[serde(default)]
    pub add_hotspring_material: i64,
    #[serde(default)]
    pub add_gem: i64,
}

pub async fn get_inventory(pool: &SqlitePool, user_id: &str) -> Result<InventoryRow, sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    sqlx::query("INSERT OR IGNORE INTO inventories (id, user_id) VALUES (?, ?)")
        .bind(&id)
        .bind(user_id)
        .execute(pool)
        .await?;
    sqlx::query_as::<_, InventoryRow>(
        "SELECT id, user_id, mandarin, watermelon, hotspring_material, gem, updated_at FROM inventories WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
}

pub async fn add_inventory(
    pool: &SqlitePool,
    user_id: &str,
    req: &AddInventoryRequest,
) -> Result<InventoryRow, sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO inventories (id, user_id, mandarin, watermelon, hotspring_material, gem, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET
           mandarin = MIN(mandarin + excluded.mandarin, 99999),
           watermelon = MIN(watermelon + excluded.watermelon, 99999),
           hotspring_material = MIN(hotspring_material + excluded.hotspring_material, 99999),
           gem = MIN(gem + excluded.gem, 99999),
           updated_at = datetime('now')",
    )
    .bind(&id)
    .bind(user_id)
    .bind(req.add_mandarin)
    .bind(req.add_watermelon)
    .bind(req.add_hotspring_material)
    .bind(req.add_gem)
    .execute(pool)
    .await?;

    get_inventory(pool, user_id).await
}

#[derive(Deserialize)]
pub struct SpendInventoryRequest {
    pub item_type: String,
    pub amount: i64,
}

pub async fn spend_inventory(
    pool: &SqlitePool,
    user_id: &str,
    req: &SpendInventoryRequest,
) -> Result<Option<InventoryRow>, sqlx::Error> {
    // 원자적 차감: 잔량 >= amount 인 경우에만 UPDATE 실행
    let column = match req.item_type.as_str() {
        "mandarin" => "mandarin",
        "watermelon" => "watermelon",
        "hotspring_material" => "hotspring_material",
        "gem" => "gem",
        _ => return Ok(None), // 유효하지 않은 아이템 타입
    };

    let query = format!(
        "UPDATE inventories SET {} = {} - ?, updated_at = datetime('now') WHERE user_id = ? AND {} >= ?",
        column, column, column
    );

    let result = sqlx::query(&query)
        .bind(req.amount)
        .bind(user_id)
        .bind(req.amount)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Ok(None); // 잔량 부족
    }

    get_inventory(pool, user_id).await.map(Some)
}

// --- Onsen Layout ---

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct OnsenLayoutRow {
    #[serde(skip_serializing)]
    #[allow(dead_code)]
    pub id: String,
    #[serde(skip_serializing)]
    #[allow(dead_code)]
    pub user_id: String,
    pub layout_json: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct SaveLayoutRequest {
    pub layout_json: String,
}

pub async fn get_layout(pool: &SqlitePool, user_id: &str) -> Result<OnsenLayoutRow, sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    sqlx::query("INSERT OR IGNORE INTO onsen_layouts (id, user_id) VALUES (?, ?)")
        .bind(&id)
        .bind(user_id)
        .execute(pool)
        .await?;
    sqlx::query_as::<_, OnsenLayoutRow>(
        "SELECT id, user_id, layout_json, updated_at FROM onsen_layouts WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
}

pub async fn upsert_layout(
    pool: &SqlitePool,
    user_id: &str,
    req: &SaveLayoutRequest,
) -> Result<OnsenLayoutRow, sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO onsen_layouts (id, user_id, layout_json, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET
           layout_json = excluded.layout_json,
           updated_at = datetime('now')",
    )
    .bind(&id)
    .bind(user_id)
    .bind(&req.layout_json)
    .execute(pool)
    .await?;

    get_layout(pool, user_id).await
}

// --- User Skins ---

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct UserSkinRow {
    #[serde(skip_serializing)]
    #[allow(dead_code)]
    pub id: String,
    #[serde(skip_serializing)]
    #[allow(dead_code)]
    pub user_id: String,
    pub selected_skin: String,
    pub unlocked_skins: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct SaveSkinsRequest {
    pub selected_skin: String,
    pub unlocked_skins: String,
}

pub async fn get_skins(pool: &SqlitePool, user_id: &str) -> Result<UserSkinRow, sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    sqlx::query("INSERT OR IGNORE INTO user_skins (id, user_id) VALUES (?, ?)")
        .bind(&id)
        .bind(user_id)
        .execute(pool)
        .await?;
    sqlx::query_as::<_, UserSkinRow>(
        "SELECT id, user_id, selected_skin, unlocked_skins, updated_at FROM user_skins WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
}

pub async fn upsert_skins(
    pool: &SqlitePool,
    user_id: &str,
    req: &SaveSkinsRequest,
) -> Result<UserSkinRow, sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO user_skins (id, user_id, selected_skin, unlocked_skins, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET
           selected_skin = excluded.selected_skin,
           unlocked_skins = excluded.unlocked_skins,
           updated_at = datetime('now')",
    )
    .bind(&id)
    .bind(user_id)
    .bind(&req.selected_skin)
    .bind(&req.unlocked_skins)
    .execute(pool)
    .await?;

    get_skins(pool, user_id).await
}
