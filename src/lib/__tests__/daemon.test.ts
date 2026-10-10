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

  it("启动时注册本地自动备份的补检查（每天重启的实例也能备份）", async () => {
    // 回归：scheduleTask 的首次执行也在 delayMs 之后，若只注册 24 小时的周期任务，
    // 进程需连续运行满 24 小时才会首次备份 —— 每天重启的部署（如定时重建容器）
    // 将永远不做本地自动备份，即使最近快照早已过期。
    //
    // 这里用「拦截 setTimeout、只记录不触发」的方式取出各定时器的延迟，
    // 断言存在一个远短于 24 小时的启动补跑；比断言定时器总数稳健。
    const realSetTimeout = globalThis.setTimeout;
    const delays: number[] = [];
    const realSetTimeoutRef = realSetTimeout;
    // 用不可达的句柄替换，避免测试期间真的执行任务
    (globalThis as unknown as { setTimeout: unknown }).setTimeout = (fn: () => void, ms?: number) => {
      delays.push(ms ?? 0);
      void fn;
      return realSetTimeoutRef(() => {}, 10 ** 9);
    };

    try {
      stopBackgroundDaemon();
      startBackgroundDaemon();
    } finally {
      (globalThis as unknown as { setTimeout: unknown }).setTimeout = realSetTimeout;
      stopBackgroundDaemon();
    }

    const DAY_MS = 24 * 60 * 60 * 1000;
    const shortFires = delays.filter((d) => d > 0 && d < DAY_MS);
    assert.ok(
      shortFires.length > 0,
      `应存在远短于 24 小时的启动补跑定时器，实际延迟：${delays.join(", ")}`,
    );
    // 具体是 90 秒的本地自动备份补跑（另有一个 60 秒的周报补跑）
    assert.ok(
      delays.includes(90_000),
      `应注册 90 秒的自动备份补检查，实际延迟：${delays.join(", ")}`,
    );
  });
});
