import type { DatabaseSync } from "node:sqlite";
import { logger } from "../../logger.ts";

/**
 * v5：一次性迁移 —— 重建所有数据表，补齐外键约束与级联删除。
 * 仅对 user_version < 5 的旧库执行一次。失败时回滚但保留版本推进（与旧实现一致）。
 */
export function migrateV5(db: DatabaseSync): void {
  try {
    db.exec("PRAGMA foreign_keys = OFF;");
    db.exec("BEGIN TRANSACTION;");

    db.exec(REBUILD_SQL);

    db.exec("COMMIT;");
  } catch (err) {
    logger.error("v5 migration failed", {
      error: err instanceof Error ? err.message : err,
    });
    try { db.exec("ROLLBACK;"); } catch {}
  } finally {
    db.exec("PRAGMA foreign_keys = ON;");
  }
}

/** v5 重建表 DDL：DROP + CREATE + INSERT + RENAME，一次性事务执行 */
const REBUILD_SQL = `
  DROP TABLE IF EXISTS sessions_new;
  CREATE TABLE sessions_new (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_agent TEXT NOT NULL DEFAULT '',
    ip_address TEXT NOT NULL DEFAULT '',
    last_active_at INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  INSERT OR IGNORE INTO sessions_new (token_hash, user_id, user_agent, ip_address, last_active_at, expires_at, created_at)
  SELECT token_hash, user_id, user_agent, ip_address, last_active_at, expires_at, created_at FROM sessions;
  DROP TABLE sessions;
  ALTER TABLE sessions_new RENAME TO sessions;

  DROP TABLE IF EXISTS user_categories_new;
  CREATE TABLE user_categories_new (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    label TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    is_team_shared INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, user_id)
  );
  INSERT OR IGNORE INTO user_categories_new (id, user_id, name, label, icon, color)
  SELECT id, user_id, name, label, icon, color FROM user_categories;
  DROP TABLE user_categories;
  ALTER TABLE user_categories_new RENAME TO user_categories;

  DROP TABLE IF EXISTS user_links_new;
  CREATE TABLE user_links_new (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    is_quick_access INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, user_id)
  );
  INSERT OR IGNORE INTO user_links_new (id, user_id, title, url, description, icon, category, is_quick_access)
  SELECT id, user_id, title, url, description, icon, category, is_quick_access FROM user_links;
  DROP TABLE user_links;
  ALTER TABLE user_links_new RENAME TO user_links;

  DROP TABLE IF EXISTS user_configs_new;
  CREATE TABLE user_configs_new (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    logo_text TEXT NOT NULL DEFAULT 'Navelix',
    logo_image TEXT NOT NULL DEFAULT '',
    show_search_bar INTEGER NOT NULL DEFAULT 1,
    max_width TEXT NOT NULL DEFAULT '1200px',
    custom_footer TEXT NOT NULL DEFAULT '© 2026 Navelix. 保留所有权利。',
    language TEXT NOT NULL DEFAULT 'zh',
    theme TEXT NOT NULL DEFAULT 'light',
    ai_base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
    ai_api_key TEXT NOT NULL DEFAULT '',
    ai_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    site_title TEXT NOT NULL DEFAULT 'Navelix · Personal Digital Hub',
    link_status_enabled INTEGER NOT NULL DEFAULT 1,
    link_status_interval INTEGER NOT NULL DEFAULT 60,
    social_github TEXT NOT NULL DEFAULT '',
    social_x TEXT NOT NULL DEFAULT '',
    social_linkedin TEXT NOT NULL DEFAULT '',
    social_email TEXT NOT NULL DEFAULT '',
    cliproxy_enabled INTEGER NOT NULL DEFAULT 1,
    cliproxy_url TEXT NOT NULL DEFAULT 'http://[IP]:8317',
    cliproxy_key TEXT NOT NULL DEFAULT '',
    weather_enabled INTEGER NOT NULL DEFAULT 0,
    weather_api_key TEXT NOT NULL DEFAULT '',
    weather_location TEXT NOT NULL DEFAULT '',
    weather_api_base_url TEXT NOT NULL DEFAULT 'https://api.seniverse.com',
    link_open_target TEXT NOT NULL DEFAULT '_blank',
    wallpaper_mode TEXT NOT NULL DEFAULT 'none',
    custom_wallpaper_url TEXT NOT NULL DEFAULT '',
    glassmorphism INTEGER NOT NULL DEFAULT 0,
    sidebar_default_state TEXT NOT NULL DEFAULT 'expanded',
    clock_widget_mode TEXT NOT NULL DEFAULT 'time',
    allow_public_access INTEGER NOT NULL DEFAULT 0,
    allow_registration INTEGER NOT NULL DEFAULT 0,
    security_setup_done INTEGER NOT NULL DEFAULT 0,
    custom_head_scripts TEXT NOT NULL DEFAULT '',
    custom_css TEXT NOT NULL DEFAULT ''
  );
  INSERT OR IGNORE INTO user_configs_new (
    user_id, logo_text, logo_image, show_search_bar, max_width, custom_footer, language, theme,
    ai_base_url, ai_api_key, ai_model, site_title, link_status_enabled, link_status_interval,
    social_github, social_x, social_linkedin, social_email, cliproxy_enabled, cliproxy_url, cliproxy_key,
    weather_enabled, weather_api_key, weather_location, weather_api_base_url, link_open_target,
    wallpaper_mode, custom_wallpaper_url, glassmorphism, sidebar_default_state, clock_widget_mode,
    allow_public_access, allow_registration, security_setup_done, custom_head_scripts, custom_css
  )
  SELECT
    user_id, logo_text, logo_image, show_search_bar, max_width, custom_footer, language, theme,
    ai_base_url, ai_api_key, ai_model, site_title, link_status_enabled, link_status_interval,
    social_github, social_x, social_linkedin, social_email, cliproxy_enabled, cliproxy_url, cliproxy_key,
    weather_enabled, weather_api_key, weather_location, weather_api_base_url, link_open_target,
    wallpaper_mode, custom_wallpaper_url, glassmorphism, sidebar_default_state, clock_widget_mode,
    allow_public_access, allow_registration, security_setup_done, custom_head_scripts, custom_css
  FROM user_configs;
  DROP TABLE user_configs;
  ALTER TABLE user_configs_new RENAME TO user_configs;

  DROP TABLE IF EXISTS notifications_new;
  CREATE TABLE notifications_new (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'system',
    created_at INTEGER NOT NULL,
    read INTEGER NOT NULL DEFAULT 0
  );
  INSERT OR IGNORE INTO notifications_new (id, user_id, title, content, source, created_at, read)
  SELECT id, user_id, title, content, source, created_at, read FROM notifications;
  DROP TABLE notifications;
  ALTER TABLE notifications_new RENAME TO notifications;

  DROP TABLE IF EXISTS projects_new;
  CREATE TABLE projects_new (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    status_color TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, user_id)
  );
  INSERT OR IGNORE INTO projects_new (id, user_id, name, status, status_color, url, description, created_at, updated_at, sort_order)
  SELECT id, user_id, name, status, status_color, url, description, created_at, updated_at, sort_order FROM projects;
  DROP TABLE projects;
  ALTER TABLE projects_new RENAME TO projects;

  DROP TABLE IF EXISTS user_todos_new;
  CREATE TABLE user_todos_new (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    done INTEGER NOT NULL DEFAULT 0,
    due_date TEXT NOT NULL DEFAULT '',
    project_id TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL DEFAULT 0,
    assignee_id TEXT NOT NULL DEFAULT '',
    assignee_name TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, user_id)
  );
  INSERT OR IGNORE INTO user_todos_new (id, user_id, title, priority, done, due_date, project_id, updated_at, assignee_id, assignee_name, created_at, sort_order)
  SELECT id, user_id, title, priority, done, due_date, project_id, updated_at, assignee_id, assignee_name, created_at, sort_order FROM user_todos;
  DROP TABLE user_todos;
  ALTER TABLE user_todos_new RENAME TO user_todos;
`;