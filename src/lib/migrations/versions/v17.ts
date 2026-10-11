import type { DatabaseSync } from "node:sqlite";
import { ensureColumn } from "../../db/columns.ts";
import { TELEGRAM_DELIVERIES_SQL } from "../../notification-schema.ts";

export function migrateV17(db: DatabaseSync): void {
  for (const column of ["notify_todo", "notify_assignment", "notify_data_transfer"]) {
    ensureColumn(db, "user_notification_settings", column, `${column} INTEGER NOT NULL DEFAULT 0`);
  }
  // v5 historical table rebuild drops the compatibility column after schema repair.
  ensureColumn(db, "user_todos", "assigned_to", "assigned_to TEXT NOT NULL DEFAULT ''");
  db.exec(TELEGRAM_DELIVERIES_SQL);
}
