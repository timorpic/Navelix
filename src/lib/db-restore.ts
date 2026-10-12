import { DatabaseSync } from "node:sqlite";
import { initSchema } from "./db/schema.ts";
import { runMigrations } from "./migrations/index.ts";
import { applyEEGateToConfig } from "./ee-gate.ts";
import { mapUserConfigRow, USER_CONFIG_MAPPED_COLUMNS, isGlobalScoped } from "./user-config-columns.ts";

const RESTORE_TABLES = [
  "users", "user_configs", "user_notification_settings", "user_categories", "user_links",
  "user_category_subscriptions", "projects", "user_todos", "api_tokens", "notifications",
  "system_settings", "audit_logs", "telegram_deliveries",
] as const;

/** Upgrade the temporary snapshot first; restore all scoped settings atomically. */
export function restoreDatabaseSnapshot(db: DatabaseSync, snapshotPath: string): void {
  const snapshot = new DatabaseSync(snapshotPath);
  try {
    for (const table of ["users", "user_configs"]) {
      if (!snapshot.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)) throw new Error("备份缺少必要数据表");
    }
    snapshot.exec("PRAGMA foreign_keys = ON");
    initSchema(snapshot);
    runMigrations(snapshot);
  } finally { snapshot.close(); }
  db.prepare("ATTACH DATABASE ? AS config_restore").run(snapshotPath);
  try {
    db.exec("BEGIN IMMEDIATE");
    // Clear children before parents. Sessions are invalidated by the users cascade.
    for (const table of [...RESTORE_TABLES].reverse()) db.exec(`DELETE FROM main.${table}`);
    for (const table of RESTORE_TABLES) {
      const columns = (db.prepare(`PRAGMA main.table_info(${table})`).all() as { name: string }[]).map(row => `"${row.name}"`).join(", ");
      db.exec(`INSERT INTO main.${table} (${columns}) SELECT ${columns} FROM config_restore.${table}`);
    }
    // Gate persisted site settings as well as SSR reads.
    const row: Record<string, unknown> = Object.fromEntries((db.prepare("SELECT key, value FROM system_settings").all() as { key: string; value: string }[]).map(row => [row.key, row.value]));
    const config = applyEEGateToConfig(mapUserConfigRow(row));
    for (const col of USER_CONFIG_MAPPED_COLUMNS.filter(isGlobalScoped)) {
      if (!col.configKey || col.kind === "secret") continue;
      const value = config[col.configKey];
      db.prepare("UPDATE system_settings SET value = ?, updated_at = ? WHERE key = ?").run(typeof value === "boolean" ? String(Number(value)) : String(value ?? ""), Date.now(), col.column);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK"); throw error;
  } finally { db.exec("DETACH DATABASE config_restore"); }
}
