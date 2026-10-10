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

export function ensureSchema(db: DatabaseSync): void {
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
}

/**
 * 后置 Schema 补齐（在版本迁移之后执行）：
 * 补齐 model_accounts 列 + user_links.notes。
 * 需在 v12 创建 model_accounts 表之后才能安全执行。
 * user_configs 列在此重复补齐一次：v5 重建表会丢失其中的小组件开关等
 * 后置列，ensureUserConfigColumns 幂等，已存在列安全跳过。
 */
export function ensureSchemaPostMigrations(db: DatabaseSync): void {
  ensureColumn(db, "model_accounts", "project_id", "project_id TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "model_accounts", "quota_summary", "quota_summary TEXT NOT NULL DEFAULT ''");
  ensureUserConfigColumns(db);
  ensureColumn(db, "user_links", "notes", "notes TEXT NOT NULL DEFAULT ''");

  // 清理历史遗留死列：cliproxy_* 在运行时/EE 源中均无任何读写，仅残留于旧库
  // （v5 重建表 DDL 曾包含，此处幂等删除；新建库直接由元数据定义生成，不含这些列）
  for (const col of ["cliproxy_enabled", "cliproxy_url", "cliproxy_key"]) {
    dropColumn(db, "user_configs", col);
  }
}
