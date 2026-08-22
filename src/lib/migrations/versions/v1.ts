import type { DatabaseSync } from "node:sqlite";

/**
 * v1：一次性迁移 —— 为旧库已有用户配置补上社交链接默认值。
 * 仅在首次升级时执行；之后用户在后台清空字段即为「隐藏」语义，不会被再次覆盖。
 */
export function migrateV1(db: DatabaseSync): void {
  db.prepare(`
    UPDATE user_configs SET
      social_github = CASE WHEN social_github = '' THEN ? ELSE social_github END,
      social_x = CASE WHEN social_x = '' THEN ? ELSE social_x END,
      social_linkedin = CASE WHEN social_linkedin = '' THEN ? ELSE social_linkedin END,
      social_email = CASE WHEN social_email = '' THEN ? ELSE social_email END
  `).run(
    "https://github.com",
    "https://x.com",
    "https://linkedin.com",
    "[邮箱]",
  );
}