import type { DatabaseSync } from "node:sqlite";
import { ensureFunctionalLogSchema } from "../logging-schema.ts";

/** v2.10.13 already advanced some deployed databases to v20 before the code rollback. */
export function migrateV21(db: DatabaseSync): void {
  db.exec("BEGIN IMMEDIATE");
  try {
    ensureFunctionalLogSchema(db);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
