import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createLogEvent, writeLog, flushLogGroups } from "../logging/events.ts";
import { sanitizeDetails } from "../logging/redact.ts";
import { readLogSettings, saveLogSettings, DEFAULT_LOG_SETTINGS, logDirectory } from "../logging/settings.ts";
import { listLogFiles, flushLogs, cleanupCandidates, removeLogFiles, readLogTail, enqueueLog, logStoreHealth } from "../logging/store.ts";
import { queryLogs, parseLogFilter } from "../logging/query.ts";
import { previewCleanup, executeCleanup, updateLogSettings } from "../logging/management.ts";
import { recordAuditLog } from "../audit.ts";
import { db } from "../db.ts";
import { migrateV20 } from "../migrations/versions/v20.ts";
import { updateProfile } from "../profile.ts";
import { createLogAlerts } from "../logging/alerts.ts";
import { hashPassword } from "../password.ts";
const marker = `logging-${Date.now()}`;
after(() => { saveLogSettings(DEFAULT_LOG_SETTINGS); db.prepare("DELETE FROM audit_logs WHERE user_id IN (?, ?)").run(marker, `${marker}-actor`); db.prepare("DELETE FROM users WHERE id = ?").run(marker); });

describe("Functional logs", () => {
  it("omits secrets, business bodies and nested objects before any output", () => {
    const details = sanitizeDetails({ password: "test-password", apiKey: "test-api-key", body: "private-body", reason: "Bearer abcdef", count: 5,
      items: [{ secret: "nested-secret" }], changes: [{ field: "aiApiKey", from: "old-key", to: "new-key" }, { field: "customHeadScripts", to: "private-script" }, { field: "allowRegistration", from: false, to: true }] });
    const json = JSON.stringify(details);
    for (const secret of ["test-password", "test-api-key", "private-body", "abcdef", "nested-secret", "old-key", "new-key", "private-script"]) assert.ok(!json.includes(secret));
    assert.equal(details.count, 5);
    assert.ok(json.includes('"to":true'));
  });
  it("writes safe events, queries by function and associates request/operation IDs", () => {
    writeLog({ category: "navigation", event: "navigation.test.created", kind: "business", operationId: marker, actorId: marker, details: { count: 3, content: "private-note" } }); flushLogs();
    const result = queryLogs({ category: "navigation", from: Date.now() - 60_000, to: Date.now(), operationId: marker });
    assert.equal(result.logs.length, 1); assert.equal(result.logs[0].details.count, 3);
    assert.ok(!JSON.stringify(result).includes("private-note"));
  });
  it("uses stable pagination without duplicating same-time events", () => {
    for (let i = 0; i < 4; i++) writeLog({ category: "ai", event: "ai.test.completed", actorId: marker, operationId: marker });
    const filter = { category: "ai" as const, from: Date.now() - 60_000, to: Date.now(), operationId: marker };
    const first = queryLogs(filter, 2); assert.equal(first.logs.length, 2); assert.ok(first.nextCursor);
    const second = queryLogs(filter, 2, first.nextCursor); assert.equal(second.logs.length, 2);
    assert.equal(first.total, 4); assert.equal(second.total, 4);
    assert.equal(second.nextCursor, null);
    assert.equal(new Set([...first.logs, ...second.logs].map(e => e.id)).size, 4);
    assert.throws(() => queryLogs({ ...filter, category: "security" }, 2, first.nextCursor));
  });
  it("counts audit records across pages and reports empty totals", () => {
    const actorId = `${marker}-pagination`;
    for (let i = 0; i < 3; i++) recordAuditLog({ userId: actorId, action: "auth.test.audit" });
    const filter = { actorId, kind: "audit" as const, from: 0, to: Date.now() };
    const first = queryLogs(filter, 2);
    assert.equal(first.total, 3); assert.ok(first.nextCursor);
    const second = queryLogs(filter, 2, first.nextCursor);
    assert.equal(second.total, 3); assert.equal(second.logs.length, 1); assert.equal(second.nextCursor, null);
    assert.equal(queryLogs({ ...filter, actorId: `${actorId}-missing` }).total, 0);
  });
  it("does not let category switches disable critical audits", () => {
    saveLogSettings({ ...DEFAULT_LOG_SETTINGS, categories: { ...DEFAULT_LOG_SETTINGS.categories, security: false } });
    assert.equal(writeLog({ category: "security", event: "security.optional" }), null);
    recordAuditLog({ userId: marker, action: "auth.test.audit" });
    const result = queryLogs({ category: "security", kind: "audit", actorId: marker, from: 0, to: Date.now() });
    assert.equal(result.logs.length, 1); saveLogSettings(DEFAULT_LOG_SETTINGS);
  });
  it("identifies scheduled and anonymous audits independently of request context", () => {
    recordAuditLog({ userId: "system", action: "logs.test.actor" });
    recordAuditLog({ userId: "", action: "auth.test.anonymous" });
    assert.equal(queryLogs({ event: "logs.test.actor", from: 0, to: Date.now() }).logs[0].actorType, "system");
    assert.equal(queryLogs({ event: "auth.test.anonymous", from: 0, to: Date.now() }).logs[0].actorType, "anonymous");
  });
  it("keeps unreadable or malformed data explicit and never exposes untrusted legacy details", () => {
    db.prepare("INSERT INTO audit_logs(id, user_id, action, target, details, created_at) VALUES (?, ?, ?, '', ?, ?)").run(`${marker}-old`, marker, "config.updated", "password=private-legacy", Date.now());
    const result = queryLogs({ actorId: marker, event: "config.updated", from: 0, to: Date.now() });
    assert.equal(result.logs[0].outcome, "unknown"); assert.ok(!JSON.stringify(result).includes("private-legacy"));
  });
  it("ignores legacy files outside the requested time range", () => {
    const file = path.join(logDirectory(), "navelix-2020-01-01.log");
    fs.writeFileSync(file, "legacy-record");
    try {
      assert.ok(!queryLogs({ from: Date.now() - 86400_000, to: Date.now() }).warnings.includes("legacy-files"));
      assert.ok(queryLogs({ from: 0, to: Date.now() }).warnings.includes("legacy-files"));
    } finally { fs.unlinkSync(file); }
  });
  it("marks valid JSON with an invalid event schema as incomplete", () => {
    flushLogs();
    const date = new Date().toISOString().slice(0, 10);
    const file = path.join(logDirectory(), `navelix-v1-runtime-${date}-123-1234abcd-99.jsonl`);
    fs.writeFileSync(file, JSON.stringify({ schemaVersion: 0, message: "untrusted-record" }) + "\n");
    try {
      const page = queryLogs({ from: 0, to: Date.now() });
      assert.equal(page.partial, true); assert.ok(page.warnings.includes("invalid-records"));
      assert.ok(!JSON.stringify(page.logs).includes("untrusted-record"));
    } finally { fs.unlinkSync(file); }
  });
  it("emits burst counts even if no further failure occurs", () => {
    writeLog({ category: "runtime", event: "runtime.test.burst", level: "error", actorId: marker });
    writeLog({ category: "runtime", event: "runtime.test.burst", level: "error", actorId: marker });
    flushLogGroups(Date.now() + 61_000); flushLogs();
    const events = queryLogs({ event: "runtime.test.burst", from: 0, to: Date.now() + 62_000 });
    assert.equal(events.logs.length, 2); assert.ok(events.logs.some(e => e.details.occurrences === 1));
  });
  it("protects cleanup with actor-bound, expiring, single-use previews", () => {
    const preview = previewCleanup(marker);
    assert.throws(() => executeCleanup(`${marker}-actor`, preview.token));
    executeCleanup(marker, preview.token);
    assert.throws(() => executeCleanup(marker, preview.token));
    assert.throws(() => updateLogSettings(marker, { auditRetentionDays: 90 }));
    const change = previewCleanup(marker, { auditRetentionDays: 90 });
    updateLogSettings(marker, { auditRetentionDays: 90 }, change.token);
    assert.equal(readLogSettings().auditRetentionDays, 90); saveLogSettings(DEFAULT_LOG_SETTINGS);
  });
  it("preserves previewed debug expiry when confirming a shorter audit retention", () => {
    const originalNow = Date.now;
    const now = originalNow();
    try {
      Date.now = () => now;
      const patch = { level: "debug", auditRetentionDays: 90 };
      const preview = previewCleanup(marker, patch);
      Date.now = () => now + 5000;
      assert.throws(() => updateLogSettings(marker, { ...patch, auditRetentionDays: 180 }, preview.token));
      const saved = updateLogSettings(marker, patch, preview.token);
      assert.equal(saved.debugUntil, preview.settings.debugUntil);
      assert.equal(saved.auditRetentionDays, 90);
    } finally { Date.now = originalNow; saveLogSettings(DEFAULT_LOG_SETTINGS); }
  });
  it("skips symlink files and settings and can clean expired ordinary files", () => {
    flushLogs();
    const outside = path.join(logDirectory(), "private-fixture.txt"); fs.writeFileSync(outside, "private-fixture");
    const name = "navelix-v1-runtime-2020-01-01-123-1234abcd-0.jsonl";
    const link = path.join(logDirectory(), name); fs.symlinkSync(outside, link);
    assert.ok(!listLogFiles().some(f => f.name === name));
    assert.throws(() => readLogTail({ name, bytes: 15, modified: 0, tier: "runtime" }, 1024));
    fs.unlinkSync(link); fs.writeFileSync(link, "{}\n"); fs.utimesSync(link, new Date(0), new Date(0));
    const candidates = cleanupCandidates(DEFAULT_LOG_SETTINGS); assert.ok(candidates.some(f => f.name === name));
    removeLogFiles(candidates.filter(f => f.name === name)); assert.ok(!fs.existsSync(link)); fs.unlinkSync(outside);
  });
  it("expires debug without extending it on reads", () => {
    saveLogSettings({ ...DEFAULT_LOG_SETTINGS, level: "debug", debugUntil: Date.now() - 1 });
    // In-process expiry must also apply to cached settings.
    assert.equal(readLogSettings().level, "info"); saveLogSettings(DEFAULT_LOG_SETTINGS);
  });
  it("upgrades old audit/delivery schemas idempotently without deleting history", () => {
    const old = new DatabaseSync(":memory:");
    try {
      old.exec("CREATE TABLE audit_logs(id TEXT, created_at INTEGER); INSERT INTO audit_logs VALUES ('old', 1); CREATE TABLE telegram_deliveries(event_key TEXT)");
      migrateV20(old); migrateV20(old);
      assert.equal(old.prepare("SELECT category, event_json FROM audit_logs WHERE id='old'").get()?.category, "");
      assert.ok(old.prepare("PRAGMA table_info(telegram_deliveries)").all().some(c => c.name === "outcome"));
    } finally { old.close(); }
  });
  it("rolls a password/profile change back if the audit write fails", () => {
    db.prepare("INSERT INTO users(id, username, password_hash, display_name, role, created_at) VALUES (?, ?, ?, 'Before', 'user', ?)").run(marker, marker, hashPassword("original-password"), Date.now());
    db.exec("CREATE TEMP TRIGGER reject_log_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT, 'test audit failure'); END");
    try { assert.throws(() => updateProfile(marker, { displayName: "After" })); }
    finally { db.exec("DROP TRIGGER reject_log_audit"); }
    assert.equal(db.prepare("SELECT display_name FROM users WHERE id=?").get(marker)?.display_name, "Before");
  });
  it("rejects invalid filters, prototype category keys and overlong cursors", () => {
    assert.throws(() => parseLogFilter(new URLSearchParams({ category: "__proto__" })));
    assert.throws(() => parseLogFilter(new URLSearchParams({ from: "NaN" })));
    assert.throws(() => queryLogs({ from: 0, to: Date.now() }, 50, "x".repeat(1001)));
    assert.ok(createLogEvent({ category: "ai", event: "ai.valid" }).id);
  });
});

it("bounds serialized events before console output", () => {
  const fields = Array.from({ length: 20 }, () => "x".repeat(2000));
  const event = createLogEvent({ category: "ai", event: "ai.large", details: { items: fields, fieldNames: fields, changes: fields } });
  assert.ok(Buffer.byteLength(JSON.stringify(event)) < 16 * 1024);
});

it("deduplicates alerts, reports recovery and excludes notification/frontend failures", async () => {
  const messages: string[] = [];
  const alert = createLogAlerts(async message => { messages.push(message); });
  const failure = createLogEvent({ category: "backup", event: "backup.cloud.failed", level: "error", outcome: "failed" });
  alert(failure); alert(failure); assert.equal(messages.length, 0);
  alert(failure); alert(failure); assert.equal(messages.length, 1);
  alert({ ...failure, outcome: "succeeded" }); assert.equal(messages.length, 2); assert.ok(messages[1].includes("recovered"));
  for (let i = 0; i < 4; i++) { alert({ ...failure, category: "notification" }); alert({ ...failure, source: "frontend" }); }
  assert.equal(messages.length, 2);
});

it("rotates bounded files and drops excess buffered diagnostics instead of growing memory", () => {
  flushLogs();
  saveLogSettings({ ...DEFAULT_LOG_SETTINGS, maxFileBytes: 1048576, maxTotalBytes: 10 * 1048576 });
  const startDrops = logStoreHealth().dropped;
  for (let batch = 0; batch < 5; batch++) {
    for (let i = 0; i < 400; i++) enqueueLog(createLogEvent({ category: "runtime", event: "runtime.capacity", details: { reason: "x".repeat(256) } }));
    flushLogs();
  }
  assert.ok(listLogFiles().length >= 2);
  for (const file of listLogFiles().filter(file => file.name.endsWith("jsonl"))) assert.ok(file.bytes <= 1048576);
  for (let i = 0; i < 4000; i++) enqueueLog(createLogEvent({ category: "runtime", event: "runtime.buffer", details: { reason: "x".repeat(256) } }));
  const health = logStoreHealth();
  assert.ok(health.bufferedBytes <= 2 * 1048576); assert.ok(health.dropped > startDrops);
  flushLogs(); saveLogSettings(DEFAULT_LOG_SETTINGS);
});

it("manual cleanup deletes expired logs and keeps records inside the saved retention period", () => {
  saveLogSettings({ ...DEFAULT_LOG_SETTINGS, auditRetentionDays: 90 });
  const oldId = `${marker}-expired`; const freshId = `${marker}-fresh`;
  db.prepare("INSERT INTO audit_logs(id, user_id, action, created_at) VALUES (?, ?, 'config.updated', ?)").run(oldId, marker, Date.now() - 91 * 86400_000);
  db.prepare("INSERT INTO audit_logs(id, user_id, action, created_at) VALUES (?, ?, 'config.updated', ?)").run(freshId, marker, Date.now());
  const file = path.join(logDirectory(), "navelix-v1-runtime-2000-01-01-123-1234abcd-1.jsonl");
  fs.writeFileSync(file, "expired-log\n"); fs.utimesSync(file, new Date(0), new Date(0));
  try {
    const preview = previewCleanup(marker);
    assert.equal(preview.auditCount, 1); assert.ok(preview.files >= 1);
    const result = executeCleanup(marker, preview.token);
    assert.equal(result.auditCount, 1); assert.ok(result.removed >= 1); assert.ok(result.releasedBytes >= 12); assert.equal(result.partial, false);
    assert.equal(db.prepare("SELECT id FROM audit_logs WHERE id=?").get(oldId), undefined);
    assert.equal(db.prepare("SELECT id FROM audit_logs WHERE id=?").get(freshId)?.id, freshId);
    assert.equal(fs.existsSync(file), false);
    const empty = previewCleanup(marker); assert.equal(empty.auditCount, 0); assert.equal(empty.files, 0);
  } finally {
    saveLogSettings(DEFAULT_LOG_SETTINGS); db.prepare("DELETE FROM audit_logs WHERE id IN (?, ?)").run(oldId, freshId);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});
