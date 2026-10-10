import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeLinkAnalytics,
  computeProjectMetrics,
  computeServiceHealth,
  computeTodoMetrics,
} from "../dashboard-metrics.ts";

/**
 * 数据看板派生计算单测。
 *
 * 这四组统计此前是 `dashboard-view.tsx`（674 行）里的内联 `useMemo`，
 * 与 JSX 混在一起。抽出后在此固定几条容易在重构中被「顺手改掉」的细节：
 * 水合保护、`slow` 计在线、`pending` 不进分母、状态自由文本的包含匹配。
 */

const link = (over: Partial<{ id: string; title: string; url: string; isQuickAccess: boolean }> = {}) =>
  ({
    id: "l1",
    title: "L",
    url: "https://example.com",
    isQuickAccess: false,
    ...over,
  }) as never;

describe("computeLinkAnalytics", () => {
  it("未挂载时忽略 localStorage 读数（避免水合不匹配）", () => {
    const usage = { l1: { count: 9, lastUsed: 1 } };
    assert.equal(computeLinkAnalytics([link()], usage, false).totalClicks, 0);
    assert.equal(computeLinkAnalytics([link()], usage, true).totalClicks, 9);
  });

  it("按点击数降序，0 次的也保留在榜单里", () => {
    const links = [link({ id: "a" }), link({ id: "b" }), link({ id: "c" })];
    const usage = { a: { count: 1, lastUsed: 0 }, b: { count: 5, lastUsed: 0 } };
    const { rankedLinks } = computeLinkAnalytics(links, usage, true);
    assert.deepEqual(rankedLinks.map((r) => r.link.id), ["b", "a", "c"]);
    assert.deepEqual(rankedLinks.map((r) => r.clicks), [5, 1, 0]);
  });

  it("统计总点击与快捷访问数", () => {
    const links = [link({ id: "a", isQuickAccess: true }), link({ id: "b", isQuickAccess: true })];
    const usage = { a: { count: 3, lastUsed: 0 }, b: { count: 4, lastUsed: 0 } };
    const r = computeLinkAnalytics(links, usage, true);
    assert.equal(r.totalClicks, 7);
    assert.equal(r.quickAccessCount, 2);
  });

  it("空书签列表不报错", () => {
    const r = computeLinkAnalytics([], {}, true);
    assert.deepEqual(r.rankedLinks, []);
    assert.equal(r.totalClicks, 0);
  });
});

describe("computeTodoMetrics", () => {
  const todo = (over: Partial<{ id: string; done: boolean; priority: string; dueDate: string }>) =>
    ({ id: "t", title: "T", done: false, priority: "medium", dueDate: "", ...over }) as never;

  it("闭环率按四舍五入计算", () => {
    const r = computeTodoMetrics([todo({ id: "1", done: true }), todo({ id: "2" }), todo({ id: "3" })]);
    assert.equal(r.completed, 1);
    assert.equal(r.pending, 2);
    assert.equal(r.rate, 33);
  });

  it("无待办时闭环率为 0 而非 NaN", () => {
    const r = computeTodoMetrics([]);
    assert.equal(r.rate, 0);
    assert.equal(r.completed, 0);
    assert.equal(r.pending, 0);
  });

  it("高优先级置顶，其次按截止日期升序", () => {
    const r = computeTodoMetrics([
      todo({ id: "low-late", priority: "low", dueDate: "2026-12-01" }),
      todo({ id: "high-late", priority: "high", dueDate: "2026-12-02" }),
      todo({ id: "high-early", priority: "high", dueDate: "2026-10-01" }),
      todo({ id: "medium", priority: "medium", dueDate: "2026-11-01" }),
    ]);
    assert.deepEqual(
      r.urgentOrUpcoming.map((t) => t.id),
      ["high-early", "high-late", "medium", "low-late"],
    );
  });

  it("已完成的待办不出现在预警清单里", () => {
    const r = computeTodoMetrics([todo({ id: "done", done: true, priority: "high" })]);
    assert.deepEqual(r.urgentOrUpcoming, []);
  });

  it("预警清单最多 5 条", () => {
    const todos = Array.from({ length: 9 }, (_, i) => todo({ id: `t${i}` }));
    assert.equal(computeTodoMetrics(todos).urgentOrUpcoming.length, 5);
  });

  it("可注入 todayStr 以便测试与渲染保持一致", () => {
    assert.equal(computeTodoMetrics([], "2026-10-10").todayStr, "2026-10-10");
  });
});

describe("computeProjectMetrics", () => {
  const project = (status: string) => ({ id: "p", name: "P", status }) as never;

  it("按状态自由文本归类（包含匹配）", () => {
    const r = computeProjectMetrics([
      project("进行中"),
      project("开发中"),
      project("已完成"),
      project("研究中"),
      project("维护中"),
    ]);
    assert.equal(r.total, 5);
    assert.equal(r.completed, 1);
    assert.equal(r.research, 1);
    assert.equal(r.maintenance, 1);
    assert.equal(r.inProgress, 2, "「进行中」与「开发中」都算推进中");
  });

  it("英文 progress 也计入推进中", () => {
    assert.equal(computeProjectMetrics([project("In Progress")]).inProgress, 1);
  });

  it("交付率四舍五入，无项目时为 0", () => {
    assert.equal(computeProjectMetrics([project("已完成"), project("进行中"), project("进行中")]).deliveryRate, 33);
    assert.equal(computeProjectMetrics([]).deliveryRate, 0);
  });

  it("未识别的状态不落入任何分类，但仍计入总数", () => {
    const r = computeProjectMetrics([project("搁置")]);
    assert.equal(r.total, 1);
    assert.equal(r.inProgress + r.completed + r.research + r.maintenance, 0);
  });
});

describe("computeServiceHealth", () => {
  const link = (id: string, url = "https://example.com") => ({ id, title: id, url }) as never;

  it("只探测 http(s) 链接，其他协议不进分母", () => {
    const links = [link("a"), link("b", "mailto:x@example.com"), link("c", "javascript:void(0)")];
    const r = computeServiceHealth(links, {}, true);
    assert.equal(r.totalProbed, 1);
    assert.equal(r.probedList.length, 1);
  });

  it("slow 计入在线，pending 不进分母", () => {
    const links = [link("a"), link("b"), link("c")];
    const statuses = { a: { status: "online" }, b: { status: "slow" }, c: { status: "checking" } };
    const r = computeServiceHealth(links, statuses, true);
    assert.equal(r.online, 2, "slow 视为可达");
    assert.equal(r.pending, 1);
    assert.equal(r.uptimeRate, 100, "1 个 pending 不应把在线率拉低");
  });

  it("离线计入分母", () => {
    const links = [link("a"), link("b")];
    const statuses = { a: { status: "online" }, b: { status: "offline" } };
    const r = computeServiceHealth(links, statuses, true);
    assert.equal(r.offline, 1);
    assert.equal(r.uptimeRate, 50);
  });

  it("探针未启用时在线率固定 100（无数据可言，显示 0% 会误导）", () => {
    const links = [link("a")];
    const r = computeServiceHealth(links, { a: { status: "offline" } }, false);
    assert.equal(r.uptimeRate, 100);
    assert.equal(r.offline, 1, "计数仍然如实反映探测结果");
  });

  it("全部未探测时在线率为 0 而非 NaN", () => {
    const r = computeServiceHealth([link("a")], {}, true);
    assert.equal(r.uptimeRate, 0);
  });

  it("大盘明细最多 8 条", () => {
    const links = Array.from({ length: 12 }, (_, i) => link(`l${i}`));
    assert.equal(computeServiceHealth(links, {}, true).probedList.length, 8);
  });
});
