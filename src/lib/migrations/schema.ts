import type { DatabaseSync } from "node:sqlite";
import { ensureColumn } from "./shared.ts";
import { DEFAULT_SITE_TITLE } from "../constants.ts";

/**
 * Schema reconciliation (idempotent, always-run):
 * ensureColumn 补齐缺失列 + CREATE TABLE IF NOT EXISTS 确保表结构最新。
 * 多版本兼容：所有旧库升级时自动补齐新增列，新建库列已存在时安全跳过。
 */
export function ensureSchema(db: DatabaseSync): void {
  // ── user_configs 列补齐 ──
  ensureColumn(db, "user_configs", "ai_base_url", "ai_base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1'");
  ensureColumn(db, "user_configs", "ai_api_key", "ai_api_key TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_configs", "ai_model", "ai_model TEXT NOT NULL DEFAULT 'gpt-4o-mini'");
  ensureColumn(db, "user_configs", "social_github", "social_github TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_configs", "social_x", "social_x TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_configs", "social_linkedin", "social_linkedin TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_configs", "social_email", "social_email TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "users", "avatar", "avatar TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "users", "email", "email TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "users", "bio", "bio TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "sessions", "user_agent", "user_agent TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "sessions", "ip_address", "ip_address TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "sessions", "last_active_at", "last_active_at INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "notifications", "source", "source TEXT NOT NULL DEFAULT 'system'");

  db.exec(`
    CREATE TABLE IF NOT EXISTS api_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      token_prefix TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS user_category_subscriptions (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, category_id, owner_id)
    );
  `);

  ensureColumn(db, "user_categories", "is_team_shared", "is_team_shared INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "user_todos", "project_id", "project_id TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_todos", "assigned_to", "assigned_to TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_todos", "assignee_id", "assignee_id TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_todos", "assignee_name", "assignee_name TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_todos", "updated_at", "updated_at INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "projects", "description", "description TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "projects", "created_at", "created_at INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "projects", "updated_at", "updated_at INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "user_configs", "logo_image", "logo_image TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_configs", "site_title", `site_title TEXT NOT NULL DEFAULT '${DEFAULT_SITE_TITLE}'`);
  ensureColumn(db, "user_configs", "link_status_enabled", "link_status_enabled INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "user_configs", "link_status_interval", "link_status_interval INTEGER NOT NULL DEFAULT 60");
  ensureColumn(db, "user_configs", "weather_enabled", "weather_enabled INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "user_configs", "weather_api_key", "weather_api_key TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_configs", "weather_location", "weather_location TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_configs", "weather_api_base_url", "weather_api_base_url TEXT NOT NULL DEFAULT 'https://api.seniverse.com'");
  ensureColumn(db, "user_configs", "link_open_target", "link_open_target TEXT NOT NULL DEFAULT '_blank'");
  ensureColumn(db, "user_configs", "wallpaper_mode", "wallpaper_mode TEXT NOT NULL DEFAULT 'none'");
  ensureColumn(db, "user_configs", "custom_wallpaper_url", "custom_wallpaper_url TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_configs", "glassmorphism", "glassmorphism INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "user_configs", "sidebar_default_state", "sidebar_default_state TEXT NOT NULL DEFAULT 'expanded'");
  ensureColumn(db, "user_configs", "clock_widget_mode", "clock_widget_mode TEXT NOT NULL DEFAULT 'time'");
  ensureColumn(db, "user_configs", "allow_public_access", "allow_public_access INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "user_configs", "allow_registration", "allow_registration INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "user_configs", "security_setup_done", "security_setup_done INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "user_configs", "custom_head_scripts", "custom_head_scripts TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_configs", "custom_css", "custom_css TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_configs", "cliproxy_enabled", "cliproxy_enabled INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "user_configs", "cliproxy_url", "cliproxy_url TEXT NOT NULL DEFAULT 'http://127.0.0.1:8317'");
  ensureColumn(db, "user_configs", "cliproxy_key", "cliproxy_key TEXT NOT NULL DEFAULT ''");
}

/**
 * 后置 Schema 补齐（在版本迁移之后执行）：
 * 补齐 model_accounts 列 + user_configs 侧边栏小组件开关 + user_links.notes。
 * 需在 v12 创建 model_accounts 表之后才能安全执行。
 */
export function ensureSchemaPostMigrations(db: DatabaseSync): void {
  ensureColumn(db, "model_accounts", "project_id", "project_id TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "model_accounts", "quota_summary", "quota_summary TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_configs", "model_monitor_enabled", "model_monitor_enabled INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "user_configs", "ai_copilot_enabled", "ai_copilot_enabled INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "user_configs", "today_activity_enabled", "today_activity_enabled INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "user_configs", "recent_visits_enabled", "recent_visits_enabled INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "user_configs", "pending_reminders_enabled", "pending_reminders_enabled INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "user_configs", "today_summary_enabled", "today_summary_enabled INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "user_configs", "social_links_enabled", "social_links_enabled INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "user_links", "notes", "notes TEXT NOT NULL DEFAULT ''");
}