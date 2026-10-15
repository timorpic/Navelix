import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import { USER_CONFIG_COLUMN_NAMES } from "../user-config-columns.ts";
import { DatabaseSync } from "node:sqlite";
import { migrateV5 } from "../migrations/versions/v5.ts";

/**
 * Schema 完整性自测：防止未来迁移把 db.ts 期望的列/外键悄悄改掉
 * （v5 重建表列清单与 db.ts 不同步曾导致外键约束从未生效）。
 * 在本地（真实 data 库）与 CI（无 data 目录时自动新建空库并跑全量迁移）均应通过。
 * user_configs 期望列由 user-config-columns.ts 元数据自动派生，
 * 新增配置列只需在该元数据文件追加一行，无需在此维护列清单。
 */
function tableColumns(table: string): string[] {
  return (
    db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  ).map((c) => c.name);
}

describe("Schema integrity after migrations", () => {
  it("does not rebuild tables when another worker already advanced the version", () => {
    const isolated = new DatabaseSync(":memory:");
    try {
      isolated.exec("PRAGMA user_version = 19; CREATE TABLE sessions (marker TEXT); INSERT INTO sessions VALUES ('preserved');");
      migrateV5(isolated);
      assert.equal(isolated.prepare("PRAGMA user_version").get()?.user_version, 19);
      assert.equal(isolated.prepare("SELECT marker FROM sessions").get()?.marker, "preserved");
    } finally { isolated.close(); }
  });

  it("propagates a failed table rebuild without advancing the version", () => {
    const isolated = new DatabaseSync(":memory:");
    try {
      assert.throws(() => migrateV5(isolated));
      assert.equal(isolated.prepare("PRAGMA user_version").get()?.user_version, 0);
      assert.equal(isolated.prepare("PRAGMA foreign_keys").get()?.foreign_keys, 1);
      assert.equal(isolated.prepare("SELECT 1 FROM sqlite_master WHERE name = 'sessions_new'").get(), undefined);
    } finally { isolated.close(); }
  });
  it("should keep all expected columns across core tables", () => {
    const userCfg = tableColumns("user_configs");
    for (const col of USER_CONFIG_COLUMN_NAMES) {
      assert.ok(userCfg.includes(col), `user_configs.${col} should exist`);
    }

    assert.ok(tableColumns("sessions").includes("last_active_at"), "sessions.last_active_at");
    assert.ok(tableColumns("sessions").includes("ip_address"), "sessions.ip_address");
    assert.ok(tableColumns("user_todos").includes("assignee_id"), "user_todos.assignee_id");
    assert.ok(tableColumns("user_todos").includes("updated_at"), "user_todos.updated_at");
    assert.ok(tableColumns("projects").includes("description"), "projects.description");
    assert.ok(tableColumns("notifications").includes("source"), "notifications.source");
  });

  it("should keep ON DELETE CASCADE foreign keys to users on core tables", () => {
    for (const t of ["sessions", "user_categories", "user_links", "user_configs", "user_notification_settings", "user_todos", "projects", "notifications"]) {
      const fks = db.prepare(`PRAGMA foreign_key_list(${t})`).all() as Array<{
        table: string;
        on_delete: string;
      }>;
      const cascade = fks.some(
        (f) => f.table === "users" && f.on_delete.toLowerCase() === "cascade",
      );
      assert.ok(cascade, `${t} should have ON DELETE CASCADE to users`);
    }
  });

  it("should remove the retired analytics table", () => {
    assert.deepEqual(tableColumns("analytics_events"), []);
  });

  it("should be at the latest schema version", () => {
    const ver = (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
    assert.equal(ver, 21);
  });
});
