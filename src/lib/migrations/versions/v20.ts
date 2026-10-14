import type { DatabaseSync } from "node:sqlite";
import { ensureColumn } from "../shared.ts";
import { API_TOKEN_TTL_MS } from "../../token-policy.ts";
import { LEGACY_PROJECT_STATUSES } from "../../project-status.ts";

export function migrateV20(db: DatabaseSync): void {
  db.exec("BEGIN IMMEDIATE");
  try {
    ensureColumn(db, "api_tokens", "expires_at", "expires_at INTEGER NOT NULL DEFAULT 0");
    // Existing integrations have 90 days to rotate; restarting cannot extend this deadline.
    db.prepare("UPDATE api_tokens SET expires_at = ? WHERE expires_at = 0").run(Date.now() + API_TOKEN_TTL_MS);
    const update = db.prepare("UPDATE projects SET status = ? WHERE status = ?");
    for (const [label, status] of Object.entries(LEGACY_PROJECT_STATUSES)) update.run(status, label);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
