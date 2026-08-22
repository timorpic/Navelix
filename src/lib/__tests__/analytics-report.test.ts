import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import { setAnalyticsEnabled } from "../analytics.ts";
import {
  buildWeeklyAggregate,
  buildReportPayload,
  currentWeekStart,
  getLastReportWeek,
  isAnalyticsReportEnabled,
  setAnalyticsReportEnabled,
} from "../analytics-report.ts";

/**
 * M1 匿名周报单元测试：
 * 覆盖聚合计算（只含已登记事件、不含 meta）、载荷结构（无敏感字段）、
 * 开关、去重键、周起始计算。
 * 注：不触发真实网络发送（maybeRunWeeklyReport 的网络路径由集成验证）。
 */

const TEST_USER = `test-report-${Date.now()}`;

function createTestUser() {
  db.prepare(`
    INSERT OR IGNORE INTO users (id, username, password_hash, display_name, role, created_at)
    VALUES (?, ?, 'hash', 'Report Test', 'user', ?)
  `).run(TEST_USER, TEST_USER, Date.now());
}

function cleanup() {
  db.prepare("DELETE FROM users WHERE id = ?").run(TEST_USER);
  db.prepare("DELETE FROM analytics_events").run();
  // 删除测试写入的全局设置记录，避免污染真实数据库默认值
  db.prepare("DELETE FROM system_settings WHERE key IN ('analytics_enabled', 'analytics_report_enabled', 'analytics_last_report_week')").run();
}

beforeEach(() => {
  cleanup();
  createTestUser();
  setAnalyticsEnabled(true);
  setAnalyticsReportEnabled(true);
});

afterEach(() => {
  cleanup();
});

describe("Analytics weekly report (M1)", () => {
  it("should compute current week start as Monday", () => {
    const ws = currentWeekStart();
    assert.match(ws, /^\d{4}-\d{2}-\d{2}$/);
    const d = new Date(`${ws}T00:00:00`);
    assert.equal(d.getDay(), 1, "weekStart should be Monday");
  });

  it("should aggregate only registered events with counts, no meta payloads", () => {
    // 上周事件（写入 ts = 上周一 00:00 起 1ms）
    const weekStart = currentWeekStart();
    const [y, m, d] = weekStart.split("-").map(Number);
    const lastMondayStart = new Date(y, m - 1, d - 7).getTime();
    const lastWeekTs = lastMondayStart + 1000;

    db.prepare(
      "INSERT INTO analytics_events (event, user_id, instance_id, meta, ts) VALUES ('nav.link_click', ?, 'inst', ?, ?)",
    ).run(TEST_USER, JSON.stringify({ linkId: "secret-url-1" }), lastWeekTs);
    db.prepare(
      "INSERT INTO analytics_events (event, user_id, instance_id, meta, ts) VALUES ('nav.link_click', ?, 'inst', ?, ?)",
    ).run(TEST_USER, "{}", lastWeekTs + 1000);
    db.prepare(
      "INSERT INTO analytics_events (event, user_id, instance_id, meta, ts) VALUES ('ai.chat_sent', ?, 'inst', ?, ?)",
    ).run(TEST_USER, "{}", lastWeekTs + 2000);
    // 本周事件不应计入上周聚合
    db.prepare(
      "INSERT INTO analytics_events (event, user_id, instance_id, meta, ts) VALUES ('nav.search', ?, 'inst', ?, ?)",
    ).run(TEST_USER, "{}", new Date(y, m - 1, d).getTime() + 1000);
    // 未登记事件绝不外发
    db.prepare(
      "INSERT INTO analytics_events (event, user_id, instance_id, meta, ts) VALUES ('unknown.event', ?, 'inst', ?, ?)",
    ).run(TEST_USER, "{}", lastWeekTs + 3000);

    const agg = buildWeeklyAggregate();
    assert.equal(agg.events["nav.link_click"], 2);
    assert.equal(agg.events["ai.chat_sent"], 1);
    assert.equal(agg.events["nav.search"], undefined, "this-week events excluded");
    assert.equal(agg.events["unknown.event"], undefined, "unregistered events excluded");
    assert.equal(agg.moduleTotals["导航"], 2);
    assert.equal(agg.moduleTotals["AI"], 1);
    assert.equal(agg.valueMoments, 3); // 2 link_click + 1 chat_sent
  });

  it("should build payload with no sensitive fields", async () => {
    const payload = await buildReportPayload();
    const serialized = JSON.stringify(payload);
    assert.equal(payload.v, 2);
    assert.ok(payload.instanceId.length > 0);
    assert.match(payload.weekStart, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(payload.version.length > 0);
    assert.ok(typeof payload.userCount === "number");
    assert.ok(payload.runtime && typeof payload.runtime.node === "string");
    // ── v2 增强维度字段存在性 ──
    assert.ok(payload.content && typeof payload.content.linkCount === "number");
    assert.ok(payload.content && typeof payload.content.categoryCount === "number");
    assert.ok(payload.content && typeof payload.content.projectCount === "number");
    assert.ok(payload.content && typeof payload.content.openTodoCount === "number");
    assert.ok(payload.activity && typeof payload.activity.activeUsers === "number");
    assert.ok(payload.activity && typeof payload.activity.activeDays === "number");
    assert.ok(payload.profile && typeof payload.profile.theme === "string");
    assert.ok(payload.ai && typeof payload.ai.configured === "boolean");
    assert.ok(payload.deploy && typeof payload.deploy.mode === "string");
    assert.ok(payload.deploy && typeof payload.deploy.timezone === "string");
    // 关键隐私断言：载荷中不得出现任何潜在敏感键
    for (const forbidden of ["user_id", "userId", "ip", "meta", "token", "password", "url", "text", "ai_api_key"]) {
      assert.ok(!serialized.includes(`"${forbidden}"`), `payload must not contain "${forbidden}"`);
    }
  });

  it("should be enabled by default and toggleable off/on", () => {
    // 匿名周报默认开启（匿名聚合、不含个人数据）；可显式关闭再开启
    assert.equal(isAnalyticsReportEnabled(), true);
    setAnalyticsReportEnabled(false);
    assert.equal(isAnalyticsReportEnabled(), false);
    setAnalyticsReportEnabled(true);
    assert.equal(isAnalyticsReportEnabled(), true);
  });

  it("should track last report week for dedup", () => {
    assert.equal(getLastReportWeek(), "");
    // 发送成功后的去重键写入由 maybeRunWeeklyReport 内部 setLastReportWeek 处理，
    // 此处验证初始为空 + 周起始键格式正确。
    const ws = currentWeekStart();
    assert.match(ws, /^\d{4}-\d{2}-\d{2}$/);
  });
});
