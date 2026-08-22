import type { DatabaseSync } from "node:sqlite";
import { ensureSchema, ensureSchemaPostMigrations } from "./schema.ts";
import {
  seedAdminIfEmpty,
  applyAlwaysDataFixes,
  backfillSecuritySetupDone,
} from "./data.ts";
import { VERSIONED_MIGRATIONS } from "./versions/index.ts";

/**
 * 全量迁移编排器。
 * 执行顺序：Schema 补齐 → 版本迁移（v1~v12，结构与业务数据分离）→ 后置 Schema 补齐。
 * 一次启动可连续应用多个版本升级；所有操作保持幂等与可重入。
 */
export function runMigrations(db: DatabaseSync): void {
  // 启动时版本快照：与旧实现一致，一次启动可连续应用多个版本升级
  const { user_version } = db.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };

  // ── 1. 通用 Schema 补齐（幂等，多版本兼容，始终执行）──
  ensureSchema(db);

  // 存量部署：默认标记安全设置引导已完成，避免打扰老用户（全新部署保持 0）
  backfillSecuritySetupDone(db, user_version);

  // 初装引导：无用户时创建默认 admin。
  // 必须位于版本迁移之前：v3 弱密码轮换依赖已存在的 admin（原实现位于 v2/v3 之间）。
  seedAdminIfEmpty(db);

  // ── 2. 版本迁移（结构与业务数据分离，仅当 user_version 落后时执行）──
  for (const migration of VERSIONED_MIGRATIONS) {
    if (user_version < migration.version) {
      migration.migrate(db);
      db.exec(`PRAGMA user_version = ${migration.version}`);
    }
  }

  // 始终执行的幂等数据修复（品牌文案 / 图标约定 / 通知清理）
  applyAlwaysDataFixes(db);

  // ── 3. 后置 Schema 补齐：依赖 v12 建表后补充的列与侧边栏组件开关 ──
  ensureSchemaPostMigrations(db);
}