import type { DatabaseSync } from "node:sqlite";
import { ensureColumn } from "../../db/columns.ts";

/** Existing accounts remain enabled; no data or credentials are changed on upgrade. */
export function migrateV18(db: DatabaseSync): void {
  ensureColumn(db, "users", "disabled", "disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0, 1))");
}
