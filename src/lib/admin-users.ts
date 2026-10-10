import { db } from "./db.ts";

/**
 * 管理员用户管理的领域逻辑（下沉自 src/app/api/admin/users/route.ts）。
 *
 * 下沉动机：级联删除此前是路由内 10 条裸 DELETE，**无事务包裹** —— 中途失败会
 * 留下半删状态（用户已删、其 projects 仍在）。事务边界属于领域不变量，不应由路由掌管。
 */

/** 统计管理员数量（用于「最后一个 admin」保护）。 */
export function adminCount(): number {
  return (
    db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get() as {
      c: number;
    }
  ).c;
}

/**
 * 与 users 表有 user_id 外键、但**需要显式清理**的表。
 *
 * 注：`user_category_subscriptions` 不在列表内 —— 它的 user_id / owner_id 都声明了
 * `ON DELETE CASCADE`（见 db/schema.ts），随 users 行删除自动清理。
 */
const CASCADE_TABLES = [
  "sessions",
  "user_categories",
  "user_links",
  "user_configs",
  "projects",
  "user_todos",
  "notifications",
  "api_tokens",
  "model_accounts",
  // analytics_events 无外键约束，必须显式删除，否则留下孤儿遥测行。
  // 隐私取向：遥测事件随用户一并清除。
  "analytics_events",
] as const;

/**
 * 级联删除用户及其全部关联数据（单事务，全成或全败）。
 *
 * **audit_logs 刻意保留**：审计日志记录「谁在何时删除了哪个账号」，属合规证据，
 * 不应随被删账号一起消失；该表的 user_id 无外键约束，保留不会破坏引用完整性。
 */
export function deleteUserCascade(userId: string): void {
  db.exec("BEGIN IMMEDIATE;");
  try {
    // users 行本身最后删：先清子表，避免外键约束在删除瞬间拒绝
    for (const table of CASCADE_TABLES) {
      db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
    }
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    db.exec("COMMIT;");
  } catch (err) {
    try {
      db.exec("ROLLBACK;");
    } catch {
      // rollback 失败时保留原始错误
    }
    throw err;
  }
}

/** 管理员可修改的用户字段 */
export interface UserUpdateInput {
  role?: string;
  username?: string;
  displayName?: string;
  /** 已哈希的密码；调用方负责校验与哈希 */
  passwordHash?: string;
  avatar?: string;
}

/** 校验失败时抛出的领域错误，由路由转换为 400 响应 */
export class UserUpdateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserUpdateError";
  }
}

/**
 * 应用管理员对用户的修改（单事务，全成或全败）。
 *
 * 事务边界属于领域不变量：此前 5 条独立 UPDATE 逐条提交，
 * 中途失败会留下「角色已改、密码未改」之类的部分更新。
 *
 * 校验（用户名格式与唯一性、头像协议、密码长度、最后一个 admin 保护）
 * 在事务内一并进行，失败即整体回滚。
 *
 * @returns 实际发生变更的字段名列表（空数组表示无字段需要更新）
 */
export function updateUser(
  userId: string,
  input: UserUpdateInput,
  options: { actorId: string; targetRole: string },
): string[] {
  const changed: string[] = [];

  db.exec("BEGIN IMMEDIATE;");
  try {
    if (typeof input.username === "string") {
      const newUsername = input.username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(newUsername)) {
        throw new UserUpdateError(
          "Username must be 3-20 characters (letters, numbers, underscore)",
        );
      }
      const existing = db
        .prepare("SELECT id FROM users WHERE username = ? AND id != ?")
        .get(newUsername, userId);
      if (existing) {
        throw new UserUpdateError("Username already taken");
      }
      db.prepare("UPDATE users SET username = ? WHERE id = ?").run(newUsername, userId);
      changed.push("username");
    }

    if (input.role && (input.role === "admin" || input.role === "user")) {
      // 禁止把自己降级
      if (userId === options.actorId && input.role === "user") {
        throw new UserUpdateError("You cannot demote your own admin account");
      }
      // 禁止把最后一个 admin 降级
      if (options.targetRole === "admin" && input.role === "user" && adminCount() <= 1) {
        throw new UserUpdateError("Cannot demote the last remaining admin account");
      }
      db.prepare("UPDATE users SET role = ? WHERE id = ?").run(input.role, userId);
      changed.push("role");
    }

    if (typeof input.displayName === "string") {
      db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(
        input.displayName.trim(),
        userId,
      );
      changed.push("displayName");
    }

    if (typeof input.avatar === "string") {
      const trimmedAvatar = input.avatar.trim();
      if (trimmedAvatar && !/^(preset:|https?:\/\/|data:image\/)/i.test(trimmedAvatar)) {
        throw new UserUpdateError(
          "Avatar must be an http(s) URL or an image data URL",
        );
      }
      db.prepare("UPDATE users SET avatar = ? WHERE id = ?").run(trimmedAvatar, userId);
      changed.push("avatar");
    }

    if (typeof input.passwordHash === "string") {
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
        input.passwordHash,
        userId,
      );
      changed.push("password");
    }

    db.exec("COMMIT;");
    return changed;
  } catch (err) {
    try {
      db.exec("ROLLBACK;");
    } catch {
      // rollback 失败时保留原始错误
    }
    throw err;
  }
}
