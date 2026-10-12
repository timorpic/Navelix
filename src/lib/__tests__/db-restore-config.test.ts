import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initSchema } from "../db/schema.ts";
import { runMigrations } from "../migrations/index.ts";
import { restoreDatabaseSnapshot } from "../db-restore.ts";

describe("database restore scoped settings", () => {
  it("upgrades a v15 snapshot and restores site, personal and notification settings together", () => {
    const dir = mkdtempSync(join(tmpdir(), "navelix-restore-config-"));
    const file = join(dir, "snapshot.db");
    const source = new DatabaseSync(file);
    const target = new DatabaseSync(":memory:");
    try {
      initSchema(source);
      source.prepare("INSERT INTO users (id, username, password_hash, role, created_at) VALUES ('restore-admin','restore-admin','hash','admin',1)").run();
      runMigrations(source);
      source.prepare("DELETE FROM system_settings").run();
      source.prepare("INSERT OR REPLACE INTO user_configs (user_id, weather_location, theme, link_open_target) VALUES ('restore-admin','snapshot-city','dark','_self')").run();
      source.prepare("INSERT INTO system_settings (key,value) VALUES ('global_config_user_id','restore-admin'),('telegram_bot_token','legacy-token'),('telegram_chat_id','123'),('telegram_enabled','1')").run();
      source.exec("PRAGMA user_version=15"); source.close();
      initSchema(target); runMigrations(target);
      target.prepare("INSERT OR REPLACE INTO system_settings (key,value) VALUES ('weather_location','current-city')").run();
      restoreDatabaseSnapshot(target, file);
      assert.equal(target.prepare("SELECT value FROM system_settings WHERE key='weather_location'").get()?.value, "snapshot-city");
      assert.equal(target.prepare("SELECT theme FROM user_configs WHERE user_id='restore-admin'").get()?.theme, "dark");
      assert.equal(target.prepare("SELECT link_open_target FROM user_configs WHERE user_id='restore-admin'").get()?.link_open_target, "_self");
      assert.equal(target.prepare("SELECT user_id FROM user_notification_settings").get()?.user_id, "restore-admin");
      assert.equal(target.prepare("SELECT 1 FROM system_settings WHERE key='global_config_user_id'").get(), undefined);
      assert.equal(target.prepare("SELECT value FROM system_settings WHERE key='custom_head_scripts'").get()?.value, "");
    } finally { if (source.isOpen) source.close(); target.close(); rmSync(dir, { recursive: true, force: true }); }
  });
});

it("database restore preserves disabled account status", () => {
  const dir = mkdtempSync(join(tmpdir(), "navelix-restore-status-"));
  const file = join(dir, "snapshot.db");
  const source = new DatabaseSync(file);
  const target = new DatabaseSync(":memory:");
  try {
    initSchema(source); runMigrations(source);
    source.prepare("UPDATE users SET disabled = 1 WHERE username = 'admin'").run();
    source.close();
    initSchema(target); runMigrations(target);
    restoreDatabaseSnapshot(target, file);
    assert.equal(target.prepare("SELECT disabled FROM users WHERE username = 'admin'").get()?.disabled, 1);
  } finally {
    if (source.isOpen) source.close();
    target.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
