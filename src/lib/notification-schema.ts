/** Shared DDL: no database singleton dependency. */
export const USER_NOTIFICATION_SETTINGS_SQL = `CREATE TABLE IF NOT EXISTS user_notification_settings (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'telegram',
  bot_token TEXT NOT NULL DEFAULT '',
  chat_id TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 0,
  notify_backup INTEGER NOT NULL DEFAULT 0,
  notify_system INTEGER NOT NULL DEFAULT 0,
  notify_todo INTEGER NOT NULL DEFAULT 0,
  notify_assignment INTEGER NOT NULL DEFAULT 0,
  notify_data_transfer INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, channel)
);`;

/** Persistent delivery ledger; task data is read again immediately before delivery. */
export const TELEGRAM_DELIVERIES_SQL = `CREATE TABLE IF NOT EXISTS telegram_deliveries (
  event_key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  todo_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  due_date TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  next_attempt INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  finished INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_telegram_deliveries_pending ON telegram_deliveries(finished, next_attempt);`;
