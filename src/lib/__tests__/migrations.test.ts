import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import { USER_CONFIG_COLUMN_NAMES } from "../user-config-columns.ts";

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
  it("should keep all expected columns across core tables", () => {
    const userCfg = tableColumns("user_configs");
    for (const col of USER_CONFIG_COLUMN_NAMES) {
      assert.ok(userCfg.includes(col), `user_configs.${col} should exist`);
    }

    const ma = tableColumns("model_accounts");
    for (const col of ["project_id", "quota_summary", "refresh_token_enc", "id_token_enc", "last_error"]) {
      assert.ok(ma.includes(col), `model_accounts.${col} should exist`);
    }

    assert.ok(tableColumns("sessions").includes("last_active_at"), "sessions.last_active_at");
    assert.ok(tableColumns("sessions").includes("ip_address"), "sessions.ip_address");
    assert.ok(tableColumns("user_todos").includes("assignee_id"), "user_todos.assignee_id");
    assert.ok(tableColumns("user_todos").includes("updated_at"), "user_todos.updated_at");
    assert.ok(tableColumns("projects").includes("description"), "projects.description");
    assert.ok(tableColumns("notifications").includes("source"), "notifications.source");
  });

  it("should keep ON DELETE CASCADE foreign keys to users on core tables", () => {
    for (const t of ["sessions", "user_categories", "user_links", "user_configs", "user_todos", "projects", "notifications", "model_accounts"]) {
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

  it("should keep analytics_events table schema intact", () => {
    const cols = tableColumns("analytics_events");
    for (const col of ["event", "user_id", "instance_id", "meta", "ts"]) {
      assert.ok(cols.includes(col), `analytics_events.${col} should exist`);
    }
  });

  it("should be at the latest schema version", () => {
    const ver = (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
    assert.equal(ver, 13);
  });
});