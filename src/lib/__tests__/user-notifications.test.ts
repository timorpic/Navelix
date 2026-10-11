import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import { saveTelegramSettings, getTelegramSettings, getTelegramConfigStatus, getSystemTelegramRecipients } from "../user-notifications.ts";
import { decryptSecret } from "../secret.ts";
import { getUserData, saveUserConfigs } from "../user-data.ts";
import { saveGlobalConfig, getGlobalConfigRow } from "../global-config.ts";
import { personalBackupConfig } from "../admin-system.ts";
import { validateConfigPatch } from "../config-validation.ts";
const ids = ["scope-admin", "scope-user"] as const;
function cleanup() { for (const id of ids) { db.prepare("DELETE FROM users WHERE id=?").run(id); db.prepare("DELETE FROM audit_logs WHERE user_id=?").run(id); } }
beforeEach(() => {
  cleanup();
  ids.forEach((id, index) => db.prepare("INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, 'hash', ?, ?)").run(id, id, index ? "user" : "admin", Date.now()));
});
after(cleanup);
describe("user notification ownership", () => {
  it("isolates credentials, supports empty-as-unchanged and explicit clearing, and masks status/audit", () => {
    saveTelegramSettings(ids[0], { botToken: "admin-secret", chatId: "123", enabled: true });
    saveTelegramSettings(ids[1], { botToken: "user-secret", chatId: "456", enabled: true });
    assert.equal(decryptSecret(getTelegramSettings(ids[0]).bot_token), "admin-secret");
    saveTelegramSettings(ids[1], { botToken: "", chatId: "789" });
    assert.equal(decryptSecret(getTelegramSettings(ids[1]).bot_token), "user-secret");
    assert.equal(getTelegramSettings(ids[0]).chat_id, "123");
    assert.ok(!JSON.stringify(getTelegramConfigStatus(ids[1])).includes("user-secret"));
    const audit = db.prepare("SELECT details FROM audit_logs WHERE user_id=?").all(ids[1]);
    assert.ok(!JSON.stringify(audit).includes("user-secret"));
    saveTelegramSettings(ids[1], { clearBotToken: true });
    assert.equal(getTelegramConfigStatus(ids[1]).configured, false);
  });
  it("requires explicit subscriptions, rejects member system subscriptions and filters demoted administrators", () => {
    saveTelegramSettings(ids[0], { enabled: true });
    assert.ok(!getSystemTelegramRecipients("system").includes(ids[0]));
    assert.throws(() => saveTelegramSettings(ids[1], { enabled: true, notifySystem: true }));
    saveTelegramSettings(ids[0], { notifySystem: true, notifyBackup: true });
    assert.ok(getSystemTelegramRecipients("system").includes(ids[0]));
    db.prepare("UPDATE users SET role='user' WHERE id=?").run(ids[0]);
    assert.ok(!getSystemTelegramRecipients("system").includes(ids[0]));
    assert.equal(getTelegramConfigStatus(ids[0]).notifySystem, false);
  });
  it("rejects unknown inputs and cascades on account deletion", () => {
    assert.throws(() => saveTelegramSettings(ids[1], { userId: ids[0] }));
    saveTelegramSettings(ids[1], { enabled: true });
    db.prepare("DELETE FROM users WHERE id=?").run(ids[1]);
    assert.equal(db.prepare("SELECT 1 FROM user_notification_settings WHERE user_id=?").get(ids[1]), undefined);
  });
});
describe("system and personal configuration", () => {
  it("merges site values after personal preferences and rejects member writes before any mutation", () => {
    saveGlobalConfig({ weatherLocation: "new-system-city" });
    db.prepare("INSERT INTO user_configs (user_id, weather_location, theme, link_open_target) VALUES (?, 'old-city', 'dark', '_self')").run(ids[1]);
    const config = getUserData(ids[1]).config;
    assert.equal(config.weatherLocation, "new-system-city"); assert.equal(config.theme, "dark"); assert.equal(config.linkOpenTarget, "_self");
    assert.throws(() => saveUserConfigs(ids[1], { weatherLocation: "attack", theme: "light" }));
    assert.equal(getUserData(ids[1]).config.theme, "dark");
    saveUserConfigs(ids[0], { aiApiKey: "clearable" });
    saveUserConfigs(ids[0], { aiApiKey: null });
    assert.equal(getGlobalConfigRow().ai_api_key, "");
  });
  it("personal backups whitelist preferences and normalize old snake_case booleans", () => {
    assert.deepEqual(personalBackupConfig({ siteTitle: "global", aiApiKey: "secret", theme: "dark", link_open_target: "_self", show_search_bar: 0, botToken: "secret" }), { theme: "dark", linkOpenTarget: "_self", showSearchBar: false });
    assert.throws(() => validateConfigPatch({ unknownField: true }));
    assert.throws(() => validateConfigPatch({ linkOpenTarget: "_parent" }));
    assert.throws(() => validateConfigPatch({ weatherEnabled: "true" }));
  });
});
