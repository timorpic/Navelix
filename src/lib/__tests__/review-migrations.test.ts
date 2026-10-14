import { it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { migrateV20 } from "../migrations/versions/v20.ts";
import { API_TOKEN_TTL_MS } from "../token-policy.ts";
import { backupPolicy } from "../db-backup-core.ts";
import { normalizeProjectStatus, projectStatusLabel, isActiveProjectStatus } from "../project-status.ts";
import { translateText } from "../server-translations.ts";

it("v20 upgrades old tokens once and preserves custom status labels", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE api_tokens(id TEXT, created_at INTEGER); INSERT INTO api_tokens VALUES ('old', 1); CREATE TABLE projects(id TEXT, status TEXT); INSERT INTO projects VALUES ('builtin','研究中'), ('custom','完成研究开发');");
    const before = Date.now();
    migrateV20(db);
    const deadline = Number(db.prepare("SELECT expires_at FROM api_tokens").get()?.expires_at);
    assert.ok(deadline >= before + API_TOKEN_TTL_MS);
    assert.equal(db.prepare("SELECT status FROM projects WHERE id='builtin'").get()?.status, "research");
    assert.equal(db.prepare("SELECT status FROM projects WHERE id='custom'").get()?.status, "完成研究开发");
    migrateV20(db);
    assert.equal(db.prepare("SELECT expires_at FROM api_tokens").get()?.expires_at, deadline);
  } finally { db.close(); }
});
it("status normalization preserves arbitrary labels and provides localized display sources", () => {
  assert.equal(normalizeProjectStatus("进行中"), "in-progress");
  assert.equal(projectStatusLabel("research"), "研究中");
  assert.equal(normalizeProjectStatus("Custom Status"), "Custom Status");
  assert.equal(isActiveProjectStatus("研究中"), true);
  assert.equal(isActiveProjectStatus("research"), true);
  assert.equal(isActiveProjectStatus("completed"), false);
});
it("migrates every status written by the old English UI without changing custom labels or token deadlines", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE api_tokens(id TEXT, expires_at INTEGER); INSERT INTO api_tokens VALUES ('issued', 12345); CREATE TABLE projects(id TEXT, status TEXT)");
    const labels = [["进行中", "in-progress"], ["研究中", "research"], ["维护中", "maintenance"], ["已完成", "completed"]];
    for (const [label, status] of labels) {
      const oldValue = translateText("en", label);
      db.prepare("INSERT INTO projects VALUES (?, ?)").run(status, oldValue);
      assert.equal(normalizeProjectStatus(oldValue), status);
    }
    for (const custom of ["Completed research", "Research review", "researching", "toString", "__proto__"]) {
      db.prepare("INSERT INTO projects VALUES (?, ?)").run(custom, custom);
      assert.equal(normalizeProjectStatus(custom), custom);
    }
    migrateV20(db);
    for (const [, status] of labels) assert.equal(db.prepare("SELECT status FROM projects WHERE id = ?").get(status)?.status, status);
    assert.equal(isActiveProjectStatus("In progress"), true);
    assert.equal(isActiveProjectStatus("Research"), true);
    assert.equal(isActiveProjectStatus("Completed"), false);
    assert.equal(db.prepare("SELECT expires_at FROM api_tokens").get()?.expires_at, 12345);
  } finally { db.close(); }
});
it("backup configuration rejects invalid or unbounded values", () => {
  assert.deepEqual(backupPolicy({ NAVELIX_MAX_BACKUPS: "3", NAVELIX_BACKUP_INTERVAL_HOURS: "6" }), { maxBackups: 3, intervalMs: 21600000 });
  assert.deepEqual(backupPolicy({ NAVELIX_MAX_BACKUPS: "-1", NAVELIX_BACKUP_INTERVAL_HOURS: "0" }), { maxBackups: 7, intervalMs: 86400000 });
  assert.deepEqual(backupPolicy({ NAVELIX_MAX_BACKUPS: "1001", NAVELIX_BACKUP_INTERVAL_HOURS: "Infinity" }), backupPolicy({}));
});
