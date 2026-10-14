import { db } from "./db.ts";

export class AssignmentError extends Error {}
// Collaboration is limited to existing shared-category relationships. Administrators
// can delegate to enabled accounts; ordinary users cannot enumerate the whole instance.
const MEMBERS_SQL = `SELECT u.id, u.username, u.display_name AS displayName, u.avatar
  FROM users u WHERE u.disabled = 0 AND (
    u.id = ? OR EXISTS (SELECT 1 FROM users actor WHERE actor.id = ? AND actor.disabled = 0 AND actor.role = 'admin')
    OR EXISTS (SELECT 1 FROM user_category_subscriptions s
      JOIN user_categories c ON c.id = s.category_id AND c.user_id = s.owner_id AND c.is_team_shared = 1
      WHERE (s.user_id = ? AND s.owner_id = u.id) OR (s.owner_id = ? AND s.user_id = u.id))
  )`;
export interface AssignableMember { id: string; username: string; displayName: string; avatar: string }
export function listWorkspaceMembers(userId: string): AssignableMember[] {
  return db.prepare(MEMBERS_SQL + " ORDER BY u.created_at, u.id").all(userId, userId, userId, userId) as unknown as AssignableMember[];
}
export function validateAssignee(userId: string, value: unknown): { id: string; name: string } {
  const id = String(value || "").trim();
  if (!id) return { id: "", name: "" };
  const member = db.prepare(MEMBERS_SQL + " AND u.id = ?").get(userId, userId, userId, userId, id) as unknown as AssignableMember | undefined;
  if (!member) throw new AssignmentError("无权向该成员指派任务");
  return { id, name: member.displayName || member.username };
}

/** Preserve an owned task's existing assignment even if collaboration has ended. */
export function resolveTodoAssignee(userId: string, todoId: string, value: unknown): { id: string; name: string } {
  const id = String(value || "").trim();
  const existing = db.prepare("SELECT COALESCE(NULLIF(assignee_id, ''), assigned_to) AS id, assignee_name AS name FROM user_todos WHERE id = ? AND user_id = ?")
    .get(todoId, userId) as { id: string; name: string } | undefined;
  if (id && existing?.id === id) {
    const member = db.prepare("SELECT username, display_name FROM users WHERE id = ?").get(id) as { username: string; display_name: string } | undefined;
    return { id, name: member ? member.display_name || member.username : existing.name || "" };
  }
  return validateAssignee(userId, id);
}
