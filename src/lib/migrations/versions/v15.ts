import type { DatabaseSync } from "node:sqlite";
import { createPhysicalBackup } from "../../db-backup-core.ts";

/**
 * v15：一次性迁移 —— 删除已废弃的「模型账号与额度监控」功能。
 *
 * 模型监控（Antigravity / Codex 账号配额大盘）整体下线，涉及：
 * - 删除 model_accounts 表（v12 创建，现无任何读写方）；
 * - 删除 user_configs.model_monitor_enabled 列（右侧栏「模型监控」开关）。
 *
 * 破坏性结构变更前自动生成物理热备份（ADR-005 删列/删表需备份）。
 * 复用 v11 的「迁移内核以参数接收 db」方式，避免引入 db.ts 单例造成导入环。
 */
export function migrateV15(db: DatabaseSync): void {
  const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'model_accounts'").get();
  const hasColumn = db.prepare("PRAGMA table_info(user_configs)").all().some(row => row.name === "model_monitor_enabled");
  if (!hasTable && !hasColumn) return;
  const outcome = createPhysicalBackup(db);
  if (!outcome.ok) throw new Error("v15 迁移前保护性备份失败，已终止迁移");
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec("DROP TABLE IF EXISTS model_accounts");
    if (db.prepare("PRAGMA table_info(user_configs)").all().some(row => row.name === "model_monitor_enabled")) {
      db.exec("ALTER TABLE user_configs DROP COLUMN model_monitor_enabled");
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
