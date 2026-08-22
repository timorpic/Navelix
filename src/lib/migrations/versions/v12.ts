import type { DatabaseSync } from "node:sqlite";

/**
 * v12：一次性迁移 —— 创建 model_accounts 表（模型账号与额度监控）。
 */
export function migrateV12(db: DatabaseSync): void {
  db.exec(`
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
      last_error TEXT NOT NULL DEFAULT '',
      last_checked_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_model_accounts_user
      ON model_accounts(user_id, provider);
  `);
}