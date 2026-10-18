import type { DatabaseSync } from "node:sqlite";
import { createPhysicalBackup } from "../../db-backup-core.ts";

/**
 * v11：一次性迁移 —— 删除已废弃的商汤 SenseNova 模型用量监控配置列。
 * 破坏性结构变更前自动生成物理热备份，确保已部署库凭据数据可回滚。
 *
 * 注意：此处刻意使用 `db-backup-core`（纯内核）而非 `db-backup`。
 * 迁移在 db/connection.ts 模块顶层同步执行，而 db-backup 依赖 db.ts，
 * 直接引用会形成 connection → migrations → v11 → db-backup → db → connection 的导入环。
 * 内核以参数接收 db，环被切断；代价是迁移前备份不写审计日志、不发 Telegram 通知
 * （启动期 DB 可能处于中间状态，此时写审计表本身也有风险）。
 */
export function migrateV11(db: DatabaseSync): void {
  const columns = ["sensenova_enabled", "sensenova_username", "sensenova_password", "sensenova_account_id", "sensenova_token_key"];
  const existing = new Set(db.prepare("PRAGMA table_info(user_configs)").all().map(row => row.name));
  if (!columns.some(column => existing.has(column))) return;
  const outcome = createPhysicalBackup(db);
  if (!outcome.ok) throw new Error("v11 迁移前保护性备份失败，已终止迁移");
  db.exec("BEGIN IMMEDIATE");
  try {
    const current = new Set(db.prepare("PRAGMA table_info(user_configs)").all().map(row => row.name));
    for (const column of columns) if (current.has(column)) db.exec(`ALTER TABLE user_configs DROP COLUMN ${column}`);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
