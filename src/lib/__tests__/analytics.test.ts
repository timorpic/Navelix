import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import {
  clearAnalyticsEvents,
  getAnalyticsInstanceId,
  getAnalyticsSummary,
  isAnalyticsEnabled,
  setAnalyticsEnabled,
  track,
} from "../analytics.ts";

/**
 * 可选遥测（Opt-in Analytics）单元测试：
 * 覆盖开关、track 写入、白名单拦截、汇总统计（价值时刻/WAU/激活率/Top榜/留存）。
 * 注：测试操作真实 db，但事件全部写入 analytics_events 表，结束后清理。
 */

const TEST_USER = `test-analytics-${Date.now()}`;

function createTestUser() {
  db.prepare(`
    INSERT OR IGNORE INTO users (id, username, password_hash, display_name, role, created_at)
    VALUES (?, ?, 'hash', 'Analytics Test', 'user', ?)
  `).run(TEST_USER, TEST_USER, Date.now());
}

function cleanup() {
  db.prepare("DELETE FROM users WHERE id = ?").run(TEST_USER);
  clearAnalyticsEvents();
  // 删除测试写入的全局设置记录，避免污染真实数据库默认值
  db.prepare("DELETE FROM system_settings WHERE key IN ('analytics_enabled', 'analytics_report_enabled', 'analytics_last_report_week')").run();
}

beforeEach(() => {
  cleanup();
  createTestUser();
  setAnalyticsEnabled(true);
});

afterEach(() => {
  cleanup();
});

describe("Analytics opt-in tracking", () => {
  it("should be enabled by default and toggleable off/on", () => {
    // 本地统计默认开启（数据仅存本机）；显式关闭后为 false，再开启恢复 true
    assert.equal(isAnalyticsEnabled(), true);
    setAnalyticsEnabled(false);
    assert.equal(isAnalyticsEnabled(), false);
    setAnalyticsEnabled(true);
    assert.equal(isAnalyticsEnabled(), true);
  });

  it("should persist an instance id on first use", () => {
    const id1 = getAnalyticsInstanceId();
    assert.ok(id1.length > 0);
    const id2 = getAnalyticsInstanceId();
    assert.equal(id1, id2, "instance id should be stable");
  });

  it("should write a known event with user and meta", () => {
    track("nav.link_click", {
      userId: TEST_USER,
      meta: { linkId: "lnk-1", categoryId: "cat-1" },
    });
    const row = db
      .prepare("SELECT * FROM analytics_events WHERE event = ? AND user_id = ?")
      .get("nav.link_click", TEST_USER) as {
      event: string;
      user_id: string;
      meta: string;
      instance_id: string;
      ts: number;
    };
    assert.ok(row, "event row should exist");
    assert.equal(row.event, "nav.link_click");
    assert.equal(row.user_id, TEST_USER);
    assert.ok(row.instance_id.length > 0);
    const meta = JSON.parse(row.meta);
    assert.equal(meta.linkId, "lnk-1");
    assert.ok(row.ts > 0);
  });

  it("should ignore unknown (unregistered) event names", () => {
    track("some.random.event", { userId: TEST_USER });
    const count = db
      .prepare("SELECT COUNT(*) AS c FROM analytics_events")
      .get() as { c: number };
    assert.equal(count.c, 0);
  });

  it("should write nothing when analytics is disabled", () => {
    setAnalyticsEnabled(false);
    track("nav.link_click", { userId: TEST_USER });
    const count = db
      .prepare("SELECT COUNT(*) AS c FROM analytics_events")
      .get() as { c: number };
    assert.equal(count.c, 0);
  });

  it("should produce a summary with today value moments, WAU and top events", () => {
    // 今日价值时刻：点击链接 + 完成待办
    track("nav.link_click", { userId: TEST_USER, meta: { linkId: "l1" } });
    track("todo.complete", { userId: TEST_USER });
    // 非价值时刻事件也应计入 Top 榜
    track("nav.search", { userId: TEST_USER });

    const summary = getAnalyticsSummary();
    assert.equal(summary.enabled, true);
    assert.ok(summary.collectedSince && summary.collectedSince > 0);
    assert.equal(summary.stats.todayValueMoments, 2);
    assert.equal(summary.stats.wau, 1);
    assert.equal(summary.stats.totalEvents, 3);

    const top = summary.topEvents.find((e) => e.event === "nav.link_click");
    assert.ok(top, "topEvents should include nav.link_click");
    assert.equal(top?.count, 1);

    const nav = summary.moduleBreakdown.find((m) => m.module === "导航");
    assert.ok(nav && nav.count === 2, "导航 module should count 2 events");
  });

  it("should compute activation rate from register + activation events", () => {
    // 注册用户 A：导入书签 → 激活
    track("auth.register", { userId: TEST_USER });
    track("nav.bookmark_import", { userId: TEST_USER });
    // 注册用户 B / C：仅注册，无激活动作
    const userB = `${TEST_USER}-b`;
    const userC = `${TEST_USER}-c`;
    for (const uid of [userB, userC]) {
      db.prepare(`
        INSERT OR IGNORE INTO users (id, username, password_hash, display_name, role, created_at)
        VALUES (?, ?, 'hash', 'Analytics Test B', 'user', ?)
      `).run(uid, uid, Date.now());
      track("auth.register", { userId: uid });
    }

    const summary = getAnalyticsSummary();
    assert.ok(summary.stats.activationRate !== null);
    assert.equal(summary.stats.activationRate, 33); // 1/3 激活 ≈ 33%

    db.prepare("DELETE FROM users WHERE id IN (?, ?)").run(userB, userC);
  });

  it("should clear all events", () => {
    track("nav.link_click", { userId: TEST_USER });
    assert.equal(getAnalyticsSummary().stats.totalEvents, 1);
    clearAnalyticsEvents();
    assert.equal(getAnalyticsSummary().stats.totalEvents, 0);
  });
});
