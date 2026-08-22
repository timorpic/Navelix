import type { DatabaseSync } from "node:sqlite";
import { dropColumn } from "../shared.ts";

/**
 * v10：一次性迁移 —— 删除已废弃的外部搜索引擎配置列。
 */
export function migrateV10(db: DatabaseSync): void {
  dropColumn(db, "user_configs", "search_engine");
  dropColumn(db, "user_configs", "custom_search_name");
  dropColumn(db, "user_configs", "custom_search_url");
}