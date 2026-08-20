import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runDatabaseMaintenance, startBackgroundDaemon, stopBackgroundDaemon } from "../daemon.ts";
import { db } from "../db.ts";

describe("Background Daemon Lifecycle & Maintenance", () => {
  it("should clean expired sessions during database maintenance", () => {
    const expiredTokenHash = "expired_hash_123";
    const now = Date.now();

    // 插入测试用户与过期会话
    const testUser = "test_user_daemon";
    db.prepare("INSERT OR IGNORE INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)").run(
      testUser,
      "daemon_user",
      "hash",
      now,
    );

    db.prepare(
      "INSERT OR REPLACE INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    ).run(expiredTokenHash, testUser, now - 10000, now - 20000);

    runDatabaseMaintenance();

    const row = db.prepare("SELECT * FROM sessions WHERE token_hash = ?").get(expiredTokenHash);
    assert.equal(row, undefined);
  });

  it("should start and stop daemon cleanly without crashing", () => {
    startBackgroundDaemon();
    // Re-start idempotency check
    startBackgroundDaemon();

    stopBackgroundDaemon();
    assert.equal(globalThis.__navelix_daemon_started__, false);
  });
});
