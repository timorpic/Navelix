import type { DatabaseSync } from "node:sqlite";
import { ensureFunctionalLogSchema } from "../logging-schema.ts";

/** Released in v2.10.16; v21 repairs databases whose historical v20 meant something else. */
export function migrateV20(db: DatabaseSync): void {
  ensureFunctionalLogSchema(db);
}
