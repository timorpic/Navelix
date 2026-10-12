import { beforeEach, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { db } from "../db.ts";
import { updateUser, deleteUserCascade, adminCount } from "../admin-users.ts";
import { createSession, getSessionUser, issueApiToken, renewSession } from "../auth.ts";
import { saveTelegramSettings, isPersonalTelegramEnabled, getSystemTelegramRecipients } from "../user-notifications.ts";
import { migrateV18 } from "../migrations/versions/v18.ts";

const actor = "status-test-admin";
const member = "status-test-member";
function cleanup() {
  for (const id of [member, actor]) db.prepare("DELETE FROM users WHERE id = ?").run(id);
  db.prepare("DELETE FROM audit_logs WHERE user_id = ?").run(actor);
}
beforeEach(() => {
  cleanup();
  for (const [id, role] of [[actor, "admin"], [member, "user"]]) {
    db.prepare("INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, 'hash', ?, ?)").run(id, id, role, Date.now());
  }
  db.prepare("INSERT INTO user_links (id, user_id, title, url, category) VALUES ('status-link', ?, 'retained', 'https://example.com', 'test')").run(member);
});
after(cleanup);
const change = (disabled: boolean) => updateUser(member, { disabled }, { actorId: actor, targetRole: "user" });
const bearer = (token: string) => new Request("http://localhost/api/user/data", { headers: { authorization: `Bearer ${token}` } });

describe("account disable lifecycle", () => {
  it("revokes browser sessions and API tokens, preserves data, audits changes and requires fresh credentials after enabling", async () => {
    const session = await createSession(member);
    const api = issueApiToken(member, "fixture");
    assert.equal((await getSessionUser(bearer(api.token)))?.id, member);
    assert.deepEqual(change(true), ["disabled"]);
    assert.equal(db.prepare("SELECT disabled FROM users WHERE id = ?").get(member)?.disabled, 1);
    assert.equal(db.prepare("SELECT 1 FROM sessions WHERE user_id = ?").get(member), undefined);
    assert.equal(db.prepare("SELECT 1 FROM api_tokens WHERE user_id = ?").get(member), undefined);
    assert.equal(db.prepare("SELECT title FROM user_links WHERE user_id = ?").get(member)?.title, "retained");
    assert.equal(await getSessionUser(bearer(api.token)), null);
    assert.equal(renewSession(session), null);
    await assert.rejects(createSession(member), /停用/);
    assert.throws(() => issueApiToken(member, "new"), /停用/);
    assert.deepEqual(change(false), ["disabled"]);
    assert.equal(await getSessionUser(bearer(api.token)), null);
    assert.equal(renewSession(session), null);
    const fresh = issueApiToken(member, "fresh");
    assert.equal((await getSessionUser(bearer(fresh.token)))?.id, member);
    const audit = db.prepare("SELECT action FROM audit_logs WHERE user_id = ? ORDER BY rowid").all(actor);
    assert.deepEqual(audit.map(row => row.action), ["user.disabled", "user.enabled"]);
  });
  it("checks live status for tokens and renewal even when credential rows were not deleted", async () => {
    const session = await createSession(member);
    const token = issueApiToken(member, "fixture");
    db.prepare("UPDATE users SET disabled = 1 WHERE id = ?").run(member);
    assert.equal(await getSessionUser(bearer(token.token)), null);
    assert.equal(renewSession(session), null);
  });
  it("rejects self-disable and invalid types without partial edits", () => {
    assert.throws(() => updateUser(actor, { disabled: true, displayName: "bad" }, { actorId: actor, targetRole: "admin" }), /当前登录/);
    assert.throws(() => updateUser(member, { disabled: "true" } as unknown as { disabled: boolean }, { actorId: actor, targetRole: "user" }), /布尔/);
    assert.equal(db.prepare("SELECT disabled FROM users WHERE id = ?").get(actor)?.disabled, 0);
  });
  it("protects the final enabled administrator even when disabled administrators exist", () => {
    db.prepare("UPDATE users SET role = 'admin', disabled = 1 WHERE id = ?").run(member);
    const others = db.prepare("SELECT id, disabled FROM users WHERE role = 'admin' AND id != ?").all(actor);
    try {
      db.prepare("UPDATE users SET disabled = 1 WHERE role = 'admin' AND id != ?").run(actor);
      assert.equal(adminCount(), 1);
      assert.throws(() => updateUser(actor, { disabled: true }, { actorId: "other", targetRole: "user" }), /最后一个可用管理员/);
      assert.throws(() => updateUser(actor, { role: "user" }, { actorId: "other", targetRole: "user" }), /最后一个可用管理员/);
      assert.throws(() => deleteUserCascade(actor), /最后一个可用管理员/);
      deleteUserCascade(member); // inactive administrators do not count toward protection
    } finally {
      for (const row of others) db.prepare("UPDATE users SET disabled = ? WHERE id = ?").run(row.disabled, row.id);
    }
  });
  it("rolls back status, revocation and profile changes together when a write fails", async () => {
    await createSession(member);
    const token = issueApiToken(member, "fixture");
    db.exec("CREATE TEMP TRIGGER reject_status_revoke BEFORE DELETE ON api_tokens BEGIN SELECT RAISE(ABORT, 'rollback status'); END");
    try {
      assert.throws(() => updateUser(member, { disabled: true, displayName: "bad" }, { actorId: actor, targetRole: "user" }), /rollback status/);
      assert.equal(db.prepare("SELECT disabled FROM users WHERE id = ?").get(member)?.disabled, 0);
      assert.ok(db.prepare("SELECT 1 FROM sessions WHERE user_id = ?").get(member));
      assert.equal((await getSessionUser(bearer(token.token)))?.id, member);
      assert.notEqual(db.prepare("SELECT display_name FROM users WHERE id = ?").get(member)?.display_name, "bad");
    } finally { db.exec("DROP TRIGGER reject_status_revoke"); }
  });
  it("stops personal and system Telegram notifications while disabled", () => {
    saveTelegramSettings(member, { enabled: true, botToken: "fixture", chatId: "123", notifyTodo: true });
    saveTelegramSettings(actor, { enabled: true, botToken: "fixture", chatId: "123", notifySystem: true });
    assert.equal(isPersonalTelegramEnabled(member, "todo"), true);
    change(true);
    assert.equal(isPersonalTelegramEnabled(member, "todo"), false);
    db.prepare("UPDATE users SET disabled = 1 WHERE id = ?").run(actor);
    assert.ok(!getSystemTelegramRecipients("system").includes(actor));
  });
});

it("v18 migration preserves existing accounts as enabled and can run twice", () => {
  const old = new DatabaseSync(":memory:");
  try {
    old.exec("CREATE TABLE users (id TEXT PRIMARY KEY); INSERT INTO users VALUES ('existing')");
    migrateV18(old); migrateV18(old);
    assert.equal(old.prepare("SELECT disabled FROM users").get()?.disabled, 0);
    old.exec("UPDATE users SET disabled = 1"); migrateV18(old);
    assert.equal(old.prepare("SELECT disabled FROM users").get()?.disabled, 1);
  } finally { old.close(); }
});
