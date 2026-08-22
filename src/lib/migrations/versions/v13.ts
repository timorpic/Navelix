import type { DatabaseSync } from "node:sqlite";

/**
 * v13：一次性迁移 —— 创建 analytics_events 表（可选遥测事件采集）。
 * 纯新增表，无破坏性变更，无需 performDatabaseBackup（ADR-005 仅限删列/删表）。
 * 规范见 wiki/Analytics-使用统计与埋点规范.md §3。
 */
export function migrateV13(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      event       TEXT    NOT NULL,
      user_id     TEXT    NOT NULL,
      instance_id TEXT    NOT NULL,
      meta        TEXT    NOT NULL DEFAULT '{}',
      ts          INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_analytics_event_ts ON analytics_events (event, ts);
    CREATE INDEX IF NOT EXISTS idx_analytics_user_ts  ON analytics_events (user_id, ts);
  `);
}
