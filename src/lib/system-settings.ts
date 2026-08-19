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

/** 反重力 OAuth client secret（管理员后台配置，AES-256-GCM 加密落库） */
export function getAntigravityClientSecret(): string {
  const raw = getSystemSetting(SYSTEM_SETTING_KEYS.antigravityClientSecret);
  if (!raw) return "";
  return decryptSecret(raw);
}

export function setAntigravityClientSecret(secret: string): void {
  const enc = encryptSecret(secret.trim());
  setSystemSetting(SYSTEM_SETTING_KEYS.antigravityClientSecret, enc);
}