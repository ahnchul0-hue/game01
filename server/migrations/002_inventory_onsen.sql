CREATE TABLE IF NOT EXISTS inventories (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    mandarin INTEGER NOT NULL DEFAULT 0,
    watermelon INTEGER NOT NULL DEFAULT 0,
    hotspring_material INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS onsen_layouts (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    layout_json TEXT NOT NULL DEFAULT '{"placedItems":[]}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_skins (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    selected_skin TEXT NOT NULL DEFAULT 'default',
    unlocked_skins TEXT NOT NULL DEFAULT '["default"]',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
