CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    category TEXT NOT NULL,
    sub_type TEXT NOT NULL,
    amount REAL NOT NULL,
    co2e REAL NOT NULL,
    logged_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activities_user_logged ON activities (user_id, logged_at);
