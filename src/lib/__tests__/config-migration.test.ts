import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { initSchema } from "../db/schema.ts";
import { migrateV16 } from "../migrations/versions/v16.ts";
import { decryptSecret } from "../secret.ts";

function legacyDB() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON"); initSchema(db);
  for (const [id, role, time] of [["a", "admin", 1], ["b", "admin", 2], ["u", "user", 3]] as const) {
    db.prepare("INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, 'hash', ?, ?)").run(id, id, role, time);
    db.prepare("INSERT INTO user_configs (user_id, site_title, theme, link_open_target) VALUES (?, ?, ?, ?)").run(id, `site-${id}`, id === "a" ? "dark" : "light", id === "a" ? "_self" : "_blank");
  }
  const setting = db.prepare("INSERT INTO system_settings (key, value) VALUES (?, ?)");
  setting.run("global_config_user_id", "b"); setting.run("telegram_bot_token", "legacy-token");
  setting.run("telegram_chat_id", "123"); setting.run("telegram_enabled", "1");
  return db;
}
describe("v16 configuration migration", () => {
  it("uses the valid anchor, preserves existing system values and personal preferences, imports one encrypted Telegram channel", () => {
    const db = legacyDB();
    try {
      db.prepare("INSERT INTO system_settings (key, value) VALUES ('logo_text', 'already-new')").run();
      migrateV16(db); migrateV16(db);
      assert.equal(db.prepare("SELECT value FROM system_settings WHERE key='site_title'").get()?.value, "site-b");
      assert.equal(db.prepare("SELECT value FROM system_settings WHERE key='logo_text'").get()?.value, "already-new");
      assert.equal(db.prepare("SELECT theme FROM user_configs WHERE user_id='a'").get()?.theme, "dark");
      assert.equal(db.prepare("SELECT link_open_target FROM user_configs WHERE user_id='a'").get()?.link_open_target, "_self");
      const rows = db.prepare("SELECT user_id, bot_token FROM user_notification_settings").all();
      assert.equal(rows.length, 1); assert.equal(rows[0].user_id, "b");
      assert.equal(decryptSecret(String(rows[0].bot_token)), "legacy-token");
      assert.equal(db.prepare("SELECT 1 FROM system_settings WHERE key='global_config_user_id'").get(), undefined);
      assert.equal(db.prepare("SELECT 1 FROM system_settings WHERE key='telegram_bot_token'").get(), undefined);
    } finally { db.close(); }
  });
  it("invalid anchors fall back to earliest admin; an empty instance keeps unclaimed credentials", () => {
    const db = legacyDB();
    try {
      db.prepare("UPDATE system_settings SET value='u' WHERE key='global_config_user_id'").run();
      migrateV16(db);
      assert.equal(db.prepare("SELECT value FROM system_settings WHERE key='site_title'").get()?.value, "site-a");
      db.exec("DELETE FROM users; DELETE FROM system_settings");
      db.prepare("INSERT INTO system_settings (key, value) VALUES ('telegram_bot_token', 'unclaimed')").run();
      migrateV16(db);
      assert.equal(db.prepare("SELECT value FROM system_settings WHERE key='telegram_bot_token'").get()?.value, "unclaimed");
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM user_notification_settings").get()?.n, 0);
    } finally { db.close(); }
  });
});
