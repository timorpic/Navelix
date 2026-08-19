import { db } from "./db.ts";
import { decryptSecret, encryptSecret } from "./secret.ts";

/**
 * 全局系统设置（key-value，存数据库）。
 * 仅服务端使用：反重力 OAuth client secret 等需要持久化且不宜放 .env 的配置。
 */

export const SYSTEM_SETTING_KEYS = {
  antigravityClientSecret: "antigravity_client_secret",
} as const;

export function getSystemSetting(key: string): string {
  const row = db
    .prepare("SELECT value FROM system_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? "";
}

export function setSystemSetting(key: string, value: string): void {
  db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, String(value), Date.now());
}

/**
 * 官方 Antigravity Hub 客户端默认配套 Client Secret。
 * 与 ANTIGRAVITY_OAUTH.clientId (1071006060591-tmhssin2h21lcre235vtolojh4g403ep) 配对，
 * 实现开箱即用免配置授权。
 */
export const DEFAULT_ANTIGRAVITY_CLIENT_SECRET =
  "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";

/** 反重力 OAuth client secret（优先环境变量/数据库自定义配置，兜底使用官方默认配对密钥） */
export function getAntigravityClientSecret(): string {
  // 1. 优先读取环境变量
  if (
    process.env.ANTIGRAVITY_CLIENT_SECRET &&
    process.env.ANTIGRAVITY_CLIENT_SECRET.trim()
  ) {
    return process.env.ANTIGRAVITY_CLIENT_SECRET.trim();
  }

  // 2. 读取数据库自定义加密配置
  const raw = getSystemSetting(SYSTEM_SETTING_KEYS.antigravityClientSecret);
  if (raw) {
    const decrypted = decryptSecret(raw);
    if (decrypted) return decrypted;
  }

  // 3. 兜底使用官方配对默认值（开箱即用）
  return DEFAULT_ANTIGRAVITY_CLIENT_SECRET;
}

export function isCustomAntigravityClientSecretConfigured(): boolean {
  if (
    process.env.ANTIGRAVITY_CLIENT_SECRET &&
    process.env.ANTIGRAVITY_CLIENT_SECRET.trim()
  ) {
    return true;
  }
  const raw = getSystemSetting(SYSTEM_SETTING_KEYS.antigravityClientSecret);
  return Boolean(raw && decryptSecret(raw));
}

export function setAntigravityClientSecret(secret: string): void {
  const enc = encryptSecret(secret.trim());
  setSystemSetting(SYSTEM_SETTING_KEYS.antigravityClientSecret, enc);
}