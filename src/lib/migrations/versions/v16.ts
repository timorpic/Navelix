import type { DatabaseSync } from "node:sqlite";
import { USER_CONFIG_MAPPED_COLUMNS, isGlobalScoped } from "../../user-config-columns.ts";
import { USER_NOTIFICATION_SETTINGS_SQL } from "../../notification-schema.ts";
import { encryptSecret } from "../../secret.ts";

/** Move site settings off user rows; migrate legacy Telegram to one administrator only. */
export function migrateV16(db: DatabaseSync): void {
  const nested = db.isTransaction;
  db.exec(nested ? "SAVEPOINT config_v16" : "BEGIN IMMEDIATE");
  try {
    db.exec(USER_NOTIFICATION_SETTINGS_SQL);
    const read = (key: string) => (db.prepare("SELECT value FROM system_settings WHERE key = ?").get(key) as { value: string } | undefined)?.value;
    const anchor = read("global_config_user_id");
    const owner = (anchor ? db.prepare("SELECT id FROM users WHERE id = ? AND role = 'admin'").get(anchor) : undefined)
      ?? db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at, id LIMIT 1").get();
    const ownerId = (owner as { id: string } | undefined)?.id;
    const row = ownerId ? db.prepare("SELECT * FROM user_configs WHERE user_id = ?").get(ownerId) : undefined;
    const insert = db.prepare("INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)");
    for (const col of USER_CONFIG_MAPPED_COLUMNS.filter(isGlobalScoped)) {
      let value = row?.[col.column] ?? col.configDefault ?? "";
      if (typeof value === "boolean") value = Number(value);
      insert.run(col.column, col.kind === "secret" ? encryptSecret(String(value)) : String(value), Date.now());
    }
    // Environment values are imported once, never used as a shared runtime fallback.
    const legacyKeys = ["bot_token", "chat_id", "enabled", "notify_backup", "notify_system"] as const;
    const values = legacyKeys.map(key => process.env[`TELEGRAM_${key.toUpperCase()}`]?.trim() || read(`telegram_${key}`) || "");
    if (ownerId && values.some(Boolean)) {
      const flag = (v: string, fallback: number) => v === "1" || v === "true" ? 1 : v === "0" || v === "false" ? 0 : fallback;
      db.prepare(`INSERT OR IGNORE INTO user_notification_settings
        (user_id, channel, bot_token, chat_id, enabled, notify_backup, notify_system, updated_at)
        VALUES (?, 'telegram', ?, ?, ?, ?, ?, ?)`).run(ownerId, encryptSecret(values[0]), values[1], flag(values[2], 0), flag(values[3], 1), flag(values[4], 1), Date.now());
      for (const key of legacyKeys) db.prepare("DELETE FROM system_settings WHERE key = ?").run(`telegram_${key}`);
    }
    db.prepare("DELETE FROM system_settings WHERE key = 'global_config_user_id'").run();
    db.exec(nested ? "RELEASE config_v16" : "COMMIT");
  } catch (error) {
    db.exec(nested ? "ROLLBACK TO config_v16; RELEASE config_v16" : "ROLLBACK");
    throw error;
  }
}
