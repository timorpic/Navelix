import type { DatabaseSync } from "node:sqlite";

/**
 * 初始 Schema：所有 CREATE TABLE / CREATE INDEX 语句（仅在表不存在时创建）。
 * 历史版本升级走 ../migrations/，本模块只负责初次建表。
 */
export function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user',
      avatar TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_agent TEXT NOT NULL DEFAULT '',
      ip_address TEXT NOT NULL DEFAULT '',
      last_active_at INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      token_prefix TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS user_categories (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      label TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      is_team_shared INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (id, user_id)
    );

    CREATE TABLE IF NOT EXISTS user_category_subscriptions (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, category_id, owner_id)
    );

    CREATE TABLE IF NOT EXISTS user_links (
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

    CREATE TABLE IF NOT EXISTS user_configs (
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
      cliproxy_key TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'system',
      created_at INTEGER NOT NULL,
      read INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user
      ON notifications(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      status_color TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (id, user_id)
    );

    CREATE TABLE IF NOT EXISTS user_todos (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      done INTEGER NOT NULL DEFAULT 0,
      due_date TEXT NOT NULL DEFAULT '',
      assigned_to TEXT NOT NULL DEFAULT '',
      assignee_name TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (id, user_id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL DEFAULT '',
      ip TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_user
      ON audit_logs(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS model_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      label TEXT NOT NULL DEFAULT '',
      access_token_enc TEXT NOT NULL DEFAULT '',
      refresh_token_enc TEXT NOT NULL DEFAULT '',
      id_token_enc TEXT NOT NULL DEFAULT '',
      token_expires_at INTEGER NOT NULL DEFAULT 0,
      plan_type TEXT NOT NULL DEFAULT '',
      subscription_start TEXT NOT NULL DEFAULT '',
      subscription_until TEXT NOT NULL DEFAULT '',
      credits_amount REAL,
      min_credit_amount REAL,
      credits_known INTEGER NOT NULL DEFAULT 0,
      project_id TEXT NOT NULL DEFAULT '',
      quota_summary TEXT NOT NULL DEFAULT '',
      last_error TEXT NOT NULL DEFAULT '',
      last_checked_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_model_accounts_user
      ON model_accounts(user_id, provider);

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL DEFAULT 0
    );
  `);
}
