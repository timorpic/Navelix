import type { DatabaseSync } from "node:sqlite";
import { ensureColumn } from "../../db/columns.ts";
export function migrateV20(db: DatabaseSync): void {
  ensureColumn(db, "audit_logs", "category", "category TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "audit_logs", "event_json", "event_json TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "telegram_deliveries", "outcome", "outcome TEXT NOT NULL DEFAULT 'unknown'");
  db.exec("CREATE INDEX IF NOT EXISTS idx_audit_logs_category_time ON audit_logs(category, created_at DESC)");
}
