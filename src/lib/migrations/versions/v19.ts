import type { DatabaseSync } from "node:sqlite";
import { createPhysicalBackup } from "../../db-backup-core.ts";

/** Retire usage event collection and anonymous reports, preserving a pre-upgrade snapshot. */
export function migrateV19(db: DatabaseSync): void {
  const events = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'analytics_events'").get();
  if (events) {
    const backup = createPhysicalBackup(db);
    if (!backup.ok) throw new Error(`v19 迁移前备份失败：${backup.error}`);
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec("DROP TABLE IF EXISTS analytics_events");
    db.prepare("DELETE FROM system_settings WHERE key GLOB 'analytics_*' OR key GLOB 'telemetry_*'").run();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
