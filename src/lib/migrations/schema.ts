import { ensureFunctionalLogSchema } from "./logging-schema.ts";
import { USER_NOTIFICATION_SETTINGS_SQL, TELEGRAM_DELIVERIES_SQL } from "../notification-schema.ts";
import type { DatabaseSync } from "node:sqlite";
import { dropColumn, ensureColumn } from "./shared.ts";
import { ensureUserConfigColumns } from "../user-config-columns.ts";

/**
 * Schema reconciliation (idempotent, always-run):
 * ensureColumn 补齐缺失列 + CREATE TABLE IF NOT EXISTS 确保表结构最新。
 * 多版本兼容：所有旧库升级时自动跳过已存在的列/表，新建库则一步到位。
 *
 * 关于与 db/schema.ts 的关系：两张表的 DDL 曾在本文件与 db/schema.ts 各写一份
 * （内容逐字相同，靠人工同步），现统一为下面的常量，两处共用。
 */

/**
 * 这两张表建库时由 db/schema.ts 创建，但历史版本升级路径也要补建，
 * 因此 DDL 抽为常量供两处共用 —— 与 user-config-columns.ts 的
 * `createUserConfigsTableSql()` 同一思路。
 */
export const API_TOKENS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS api_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      token_prefix TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER
    );`;

export const CATEGORY_SUBSCRIPTIONS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS user_category_subscriptions (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, category_id, owner_id)
    );`;

/**
 * 工作区高频查询的索引（两处 schema 共用同一常量）。
 *
 * projects / user_todos / user_links / user_categories 的主键是复合 `(id, user_id)`，
 * 前缀为 id —— 所有 `WHERE user_id = ?` 的查询都无法走主键。这些索引服务：
 * 项目列表与 revision 快照、首页统计与 AI 每日计划、里程碑同步、分类页与级联删除。
 */
export const WORKSPACE_INDEXES_SQL = `
    CREATE INDEX IF NOT EXISTS idx_projects_user_sort
      ON projects(user_id, sort_order);

    CREATE INDEX IF NOT EXISTS idx_user_todos_user_done_created
      ON user_todos(user_id, done, created_at);

    CREATE INDEX IF NOT EXISTS idx_user_todos_user_project
      ON user_todos(user_id, project_id);

    CREATE INDEX IF NOT EXISTS idx_user_links_user_category
      ON user_links(user_id, category);

    CREATE INDEX IF NOT EXISTS idx_user_categories_user
      ON user_categories(user_id);`;

export function ensureSchema(db: DatabaseSync): void {
  db.exec(USER_NOTIFICATION_SETTINGS_SQL);
  db.exec(TELEGRAM_DELIVERIES_SQL);
  // ── user_configs 列补齐（元数据驱动，见 ../user-config-columns.ts）──
  ensureUserConfigColumns(db);
  ensureColumn(db, "users", "avatar", "avatar TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "users", "email", "email TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "users", "bio", "bio TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "sessions", "user_agent", "user_agent TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "sessions", "ip_address", "ip_address TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "sessions", "last_active_at", "last_active_at INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "notifications", "source", "source TEXT NOT NULL DEFAULT 'system'");

  db.exec(`${API_TOKENS_TABLE_SQL}\n\n    ${CATEGORY_SUBSCRIPTIONS_TABLE_SQL}`);

  ensureColumn(db, "user_categories", "is_team_shared", "is_team_shared INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "user_todos", "project_id", "project_id TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_todos", "assigned_to", "assigned_to TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_todos", "assignee_id", "assignee_id TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_todos", "assignee_name", "assignee_name TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_todos", "updated_at", "updated_at INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "projects", "description", "description TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "projects", "created_at", "created_at INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "projects", "updated_at", "updated_at INTEGER NOT NULL DEFAULT 0");

  // 索引必须在上述列补齐之后创建：旧库要等 ensureColumn 补出 project_id 等列，
  // 才能建立引用它们的索引（新建库上这些列已由建表 DDL 提供）。
  db.exec(WORKSPACE_INDEXES_SQL);
}

/**
 * 后置 Schema 补齐（在版本迁移之后执行）：
 * 补齐 user_links.notes。
 * user_configs 列在此重复补齐一次：v5 重建表会丢失其中的小组件开关等
 * 后置列，ensureUserConfigColumns 幂等，已存在列安全跳过。
 */
export function ensureSchemaPostMigrations(db: DatabaseSync): void {
  // Version numbers alone cannot establish structure after a rollback or restore.
  ensureFunctionalLogSchema(db);
  ensureUserConfigColumns(db);
  ensureColumn(db, "user_links", "notes", "notes TEXT NOT NULL DEFAULT ''");

  // 清理历史遗留死列：cliproxy_* 在运行时/EE 源中均无任何读写，仅残留于旧库
  // （v5 重建表 DDL 曾包含，此处幂等删除；新建库直接由元数据定义生成，不含这些列）
  for (const col of ["cliproxy_enabled", "cliproxy_url", "cliproxy_key"]) {
    dropColumn(db, "user_configs", col);
  }

  // 工作区索引放在**迁移之后**补齐：v5 会重建 projects/user_links/user_categories
  // 等表（DROP + RENAME），重建过程连同索引一起丢弃。前置 ensureSchema 里的同名
  // 语句对新库无效（随后被 v5 删除），因此这里必须再执行一次。
  db.exec(WORKSPACE_INDEXES_SQL);
}
