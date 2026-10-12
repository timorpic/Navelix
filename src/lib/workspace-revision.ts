import { createHash } from "node:crypto";
import { db } from "./db.ts";

/** Content revision requires no new schema and also observes writes from extensions/AI. */
export function getWorkspaceRevision(userId: string): string {
  const hash = createHash("sha256");
  for (const table of ["user_categories", "user_links", "projects", "user_todos"] as const) {
    hash.update(JSON.stringify(db.prepare(`SELECT * FROM ${table} WHERE user_id = ? ORDER BY id`).all(userId)));
  }
  return hash.digest("hex");
}

export class WorkspaceConflictError extends Error {
  constructor() { super("工作区已在其他页面更新，请刷新后重试"); }
}

/** Called inside the same write transaction as the full snapshot replacement. */
export function requireWorkspaceRevision(userId: string, revision: unknown): void {
  if (typeof revision !== "string" || revision !== getWorkspaceRevision(userId)) throw new WorkspaceConflictError();
}
