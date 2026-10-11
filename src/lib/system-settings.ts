import { db } from "./db.ts";

/**
 * 全局系统设置（key-value，存数据库）。
 * 仅服务端使用：系统配置等需要持久化且不宜放 .env 的配置。
 */

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
