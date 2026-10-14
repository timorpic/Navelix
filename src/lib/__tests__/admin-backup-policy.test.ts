import { it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { db } from "../db.ts";
import { performDatabaseBackup } from "../db-backup.ts";
import { unlinkSync } from "node:fs";
it("backs up actual persisted user data and emits an audit entry", () => {
  const id = "backup-policy-marker";
  db.prepare("INSERT INTO users (id,username,password_hash,created_at) VALUES (?,?,'hash',?)").run(id,id,Date.now());
  const file = performDatabaseBackup(id);
  assert.ok(file);
  try {
    const snapshot = new DatabaseSync(file, { readOnly: true });
    try {
      assert.equal(snapshot.prepare("SELECT username FROM users WHERE id = ?").get(id)?.username, id);
      assert.equal(snapshot.prepare("PRAGMA integrity_check").get()?.integrity_check, "ok");
    } finally { snapshot.close(); }
    assert.equal(db.prepare("SELECT action FROM audit_logs WHERE user_id = ?").get(id)?.action, "database.backup.created");
  } finally {
    unlinkSync(file);
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    db.prepare("DELETE FROM audit_logs WHERE user_id = ?").run(id);
  }
});
