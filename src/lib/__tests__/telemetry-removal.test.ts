import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { initSchema } from "../db/schema.ts";
import { runMigrations } from "../migrations/index.ts";
import { restoreDatabaseSnapshot } from "../db-restore.ts";

function seedLegacyTelemetry(db: DatabaseSync) {
  db.exec(`CREATE TABLE analytics_events (id INTEGER PRIMARY KEY, event TEXT, user_id TEXT, instance_id TEXT, meta TEXT, ts INTEGER);
    INSERT INTO analytics_events VALUES (1, 'auth.login', 'legacy-user', 'legacy-instance', '{}', 1);
    INSERT INTO system_settings (key, value) VALUES
      ('analytics_enabled', '1'), ('analytics_instance_id', 'legacy-instance'),
      ('analytics_report_enabled', '1'), ('analytics_last_report_week', '2026-10-05'),
      ('telemetry_endpoint', 'https://fixture.invalid');
    PRAGMA user_version = 18;`);
}
function assertRetired(db: DatabaseSync) {
  assert.equal(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'analytics_events'").get(), undefined);
  assert.equal((db.prepare("SELECT COUNT(*) AS count FROM system_settings WHERE key GLOB 'analytics_*' OR key GLOB 'telemetry_*'").get() as { count: number }).count, 0);
  assert.equal((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version, 19);
}

describe("retiring usage analytics and telemetry", () => {
  it("upgrades v18, preserves unrelated settings and user data, and remains idempotent", () => {
    const db = new DatabaseSync(":memory:");
    try {
      initSchema(db); runMigrations(db);
      db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('weather_location', 'test-city')").run();
      const users = db.prepare("SELECT id, username FROM users").all();
      seedLegacyTelemetry(db);
      runMigrations(db); assertRetired(db);
      runMigrations(db); assertRetired(db);
      assert.deepEqual(db.prepare("SELECT id, username FROM users").all(), users);
      assert.equal((db.prepare("SELECT value FROM system_settings WHERE key = 'weather_location'").get() as { value: string }).value, "test-city");
    } finally { db.close(); }
  });
  it("migrates a legacy snapshot before restoring it without reviving telemetry", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "navelix-telemetry-restore-"));
    const snapshotPath = path.join(dir, "legacy.db");
    const snapshot = new DatabaseSync(snapshotPath);
    const target = new DatabaseSync(":memory:");
    try {
      initSchema(snapshot); runMigrations(snapshot); seedLegacyTelemetry(snapshot); snapshot.close();
      initSchema(target); runMigrations(target);
      restoreDatabaseSnapshot(target, snapshotPath);
      assertRetired(target);
      assert.ok(target.prepare("SELECT id FROM users").get());
    } finally { target.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
