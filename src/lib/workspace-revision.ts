import { createHash } from "node:crypto";
import { db } from "./db.ts";

/**
 * 参与 revision 的表与显式列名。
 *
 * 显式列而不是 `SELECT *`：列名一旦随 schema 演进而变化（增删列），
 * `SELECT *` 会让同一个数据快照算出不同的哈希，造成无谓的冲突；
 * 显式列也让 revision 的语义稳定在「这些用户可见字段的内容」上。
 */
const REVISION_TABLES = {
  user_categories: "id, name, label, icon, color, is_team_shared",
  user_links: "id, title, url, description, icon, category, notes, is_quick_access",
  projects: "id, name, description, status, status_color, url, sort_order, created_at, updated_at",
  user_todos:
    "id, title, priority, done, due_date, project_id, assigned_to, assignee_id, assignee_name, created_at, sort_order, updated_at",
} as const;

/** Content revision requires no new schema and also observes writes from extensions/AI. */
export function getWorkspaceRevision(userId: string): string {
  const hash = createHash("sha256");
  for (const [table, columns] of Object.entries(REVISION_TABLES)) {
    hash.update(
      JSON.stringify(
        db.prepare(`SELECT ${columns} FROM ${table} WHERE user_id = ? ORDER BY id`).all(userId),
      ),
    );
  }
  return hash.digest("hex");
}

export class WorkspaceConflictError extends Error {
  constructor() { super("工作区已在其他页面更新，请刷新后重试"); }
}

/**
 * 从请求中读取客户端声明的 revision。
 *
 * 写接口的 body 携带 `expectedRevision`；DELETE 没有 body（或调用方不便构造），
 * 允许用 `?expectedRevision=` 查询参数等价表达。
 */
export function readExpectedRevision(
  searchParams: URLSearchParams,
  body?: unknown,
): string | undefined {
  const query = searchParams.get("expectedRevision");
  if (query) return query;
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const value = (body as Record<string, unknown>).expectedRevision;
    if (typeof value === "string") return value;
  }
  return undefined;
}

/** Called inside the same write transaction as the full snapshot replacement. */
export function requireWorkspaceRevision(userId: string, revision: unknown): void {
  if (typeof revision !== "string" || revision !== getWorkspaceRevision(userId)) throw new WorkspaceConflictError();
}

/**
 * 领域写操作的事务内 revision 守卫。
 *
 * 与 `requireWorkspaceRevision` 的区别：`expectedRevision` 缺省时**跳过**校验。
 * 这样公开 REST API 的 Token 客户端（PATCH /api/projects/{id} 不带 revision）
 * 保持向后兼容；Web 客户端由 Provider 统一注入，才能获得并发保护。
 *
 * 调用点必须位于 `BEGIN IMMEDIATE` 之后、任何写语句之前：SQLite 的单写者锁
 * 保证校验与写入之间不会插入其他写事务。
 */
export function guardWorkspaceRevision(userId: string, expectedRevision: unknown): void {
  if (expectedRevision === undefined || expectedRevision === null) return;
  requireWorkspaceRevision(userId, expectedRevision);
}

/**
 * 把「revision 校验 + 领域写入 + 新 revision 计算」放进同一个事务。
 *
 * 合并后的实体写接口（项目/待办的创建、修改、删除）此前完全绕过了并发保护：
 * 写成功而 Provider 的 revision 过期，用户下一次保存书签就会 409 丢编辑。
 * 统一经由本函数后，写操作与 revision 在同一次写锁内完成，路由把新 revision
 * 回传客户端即可消除这个窗口。
 *
 * 已在事务内时降级为 SAVEPOINT（与 v16 迁移、`saveTelegramSettings` 同一范式），
 * 使领域函数既可直接调用，也可被外层事务包裹。
 */
export function withWorkspaceRevision<T>(
  userId: string,
  expectedRevision: unknown,
  write: () => T,
): { result: T; revision: string } {
  const nested = db.isTransaction;
  db.exec(nested ? "SAVEPOINT workspace_write" : "BEGIN IMMEDIATE");
  try {
    guardWorkspaceRevision(userId, expectedRevision);
    const result = write();
    const revision = getWorkspaceRevision(userId);
    db.exec(nested ? "RELEASE workspace_write" : "COMMIT");
    return { result, revision };
  } catch (error) {
    db.exec(nested ? "ROLLBACK TO workspace_write; RELEASE workspace_write" : "ROLLBACK");
    throw error;
  }
}
