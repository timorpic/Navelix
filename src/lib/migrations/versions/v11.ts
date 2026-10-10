import type { DatabaseSync } from "node:sqlite";
import { createPhysicalBackup } from "../../db-backup-core.ts";
import { logger } from "../../logger.ts";
import { dropColumn } from "../shared.ts";

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
  const outcome = createPhysicalBackup(db);
  if (!outcome.ok) {
    logger.warn("v11 迁移前自动备份失败，继续执行迁移", { error: outcome.error });
  }
  dropColumn(db, "user_configs", "sensenova_enabled");
  dropColumn(db, "user_configs", "sensenova_username");
  dropColumn(db, "user_configs", "sensenova_password");
  dropColumn(db, "user_configs", "sensenova_account_id");
  dropColumn(db, "user_configs", "sensenova_token_key");
}
