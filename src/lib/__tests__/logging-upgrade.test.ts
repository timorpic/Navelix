import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { initSchema } from "../db/schema.ts";
import { runMigrations } from "../migrations/index.ts";

function legacyDatabase(version: number): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  initSchema(db);
  db.exec(`ALTER TABLE audit_logs DROP COLUMN category;
    ALTER TABLE audit_logs DROP COLUMN event_json;
    ALTER TABLE telegram_deliveries DROP COLUMN outcome;
    ALTER TABLE api_tokens ADD COLUMN expires_at INTEGER NOT NULL DEFAULT 0;
    PRAGMA user_version = ${version};`);
  db.prepare("INSERT INTO audit_logs (id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)")
    .run("legacy-event", "legacy-user", "legacy.fixture", "historical-record", Date.now());
  return db;
}
function assertLogSchema(db: DatabaseSync): void {
  for (const name of ["category", "event_json"]) {
    assert.ok(db.prepare("PRAGMA table_info(audit_logs)").all().some(row => row.name === name), `audit_logs.${name}`);
  }
  assert.ok(db.prepare("PRAGMA table_info(telegram_deliveries)").all().some(row => row.name === "outcome"));
  assert.equal(db.prepare("SELECT details FROM audit_logs WHERE id='legacy-event'").get()?.details, "historical-record");
  db.exec("INSERT OR REPLACE INTO audit_logs (id, user_id, action, created_at, category, event_json) VALUES ('new-event', 'test-user', 'test.created', 1, 'system', '{}')");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM audit_logs").get()?.count, 2);
}

describe("functional log upgrades from historical schema versions", () => {
  it("repairs the historical v20 marker used by v2.10.13 and preserves records", () => {
    const db = legacyDatabase(20);
    try {
      runMigrations(db); assertLogSchema(db);
      assert.equal(db.prepare("PRAGMA user_version").get()?.user_version, 21);
      runMigrations(db); assertLogSchema(db);
    } finally { db.close(); }
  });
  it("reconciles missing columns independently of a higher version marker", () => {
    const db = legacyDatabase(25);
    try {
      runMigrations(db); assertLogSchema(db);
      assert.equal(db.prepare("PRAGMA user_version").get()?.user_version, 25);
    } finally { db.close(); }
  });
  it("keeps already upgraded v20 events and repeated starts intact", () => {
    const db = new DatabaseSync(":memory:");
    try {
      initSchema(db);
      db.exec("PRAGMA user_version=20; INSERT INTO audit_logs(id,user_id,action,created_at,category,event_json) VALUES ('existing','user','test.event',1,'system','{\"schemaVersion\":1}')");
      runMigrations(db); runMigrations(db);
      assert.equal(db.prepare("SELECT event_json FROM audit_logs WHERE id='existing'").get()?.event_json, '{"schemaVersion":1}');
      assert.equal(db.prepare("PRAGMA user_version").get()?.user_version, 21);
    } finally { db.close(); }
  });
});
