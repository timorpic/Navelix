import type { DatabaseSync } from "node:sqlite";

/**
 * v9：一次性迁移 —— 清理历史遗留测试账号。
 */
export function migrateV9(db: DatabaseSync): void {
  db.prepare("DELETE FROM users WHERE username LIKE 'tokuser_%' OR username LIKE 'test-%' OR id LIKE 'user_token_test_%' OR id LIKE 'test-%'").run();
}