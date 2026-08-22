import type { DatabaseSync } from "node:sqlite";
import { performDatabaseBackup } from "../../db-backup.ts";
import { dropColumn } from "../shared.ts";

/**
 * v11：一次性迁移 —— 删除已废弃的商汤 SenseNova 模型用量监控配置列。
 * 破坏性结构变更前自动生成物理热备份，确保已部署库凭据数据可回滚。
 */
export function migrateV11(db: DatabaseSync): void {
  performDatabaseBackup("migration-v11");
  dropColumn(db, "user_configs", "sensenova_enabled");
  dropColumn(db, "user_configs", "sensenova_username");
  dropColumn(db, "user_configs", "sensenova_password");
  dropColumn(db, "user_configs", "sensenova_account_id");
  dropColumn(db, "user_configs", "sensenova_token_key");
}