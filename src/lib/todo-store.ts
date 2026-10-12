import { db } from "./db.ts";
import type { TodoItem } from "../types/index.ts";

/** Shared by SSR, Provider and the list API; assignee_id is authoritative. */
export function getUserTodos(userId: string): TodoItem[] {
  const rows = db.prepare(`SELECT t.*, u.display_name AS owner_name, u.username AS owner_username,
    COALESCE(NULLIF(t.assignee_id, ''), t.assigned_to) AS recipient
    FROM user_todos t JOIN users u ON u.id = t.user_id
    WHERE t.user_id = ? OR COALESCE(NULLIF(t.assignee_id, ''), t.assigned_to) = ?
    ORDER BY t.done, t.sort_order, t.created_at`).all(userId, userId);
  return rows.map(r => ({
    id: String(r.id), title: String(r.title), priority: r.priority as TodoItem["priority"],
    done: r.done === 1, dueDate: String(r.due_date || "") || undefined,
    projectId: String(r.project_id || "") || undefined,
    assigneeId: String(r.recipient || "") || undefined,
    assigneeName: String(r.assignee_name || "") || undefined,
    ownerId: String(r.user_id), ownerName: String(r.owner_name || r.owner_username),
    isDelegated: r.user_id !== userId, createdAt: Number(r.created_at), sortOrder: Number(r.sort_order),
  }));
}

/** Never choose an arbitrary row when multiple accessible tasks share an ID. */
export function resolveTodoOwner(id: string, actorId: string, ownerId?: string): string | null {
  const rows = db.prepare(`SELECT user_id FROM user_todos WHERE id = ?
    AND (user_id = ? OR COALESCE(NULLIF(assignee_id, ''), assigned_to) = ?)
    AND (? IS NULL OR user_id = ?)`).all(id, actorId, actorId, ownerId ?? null, ownerId ?? null);
  if (rows.length !== 1) return null;
  return String(rows[0].user_id);
}
