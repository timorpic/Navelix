import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_SUMMARY,
  EVENT_LABELS,
  MODULES,
  VALUE_MOMENT_EVENTS,
  VALUE_MOMENT_EVENT_COUNT,
  buildOverviewCards,
  trendScale,
  type AnalyticsSummary,
} from "../analytics-dashboard.ts";

/**
 * 使用统计看板数据层单测。
 *
 * 这些映射与派生此前内联在 614 行的 `admin-analytics-tab.tsx` 里。
 */

function summaryWith(over: Partial<AnalyticsSummary["stats"]> = {}): AnalyticsSummary {
  return {
    ...EMPTY_SUMMARY,
    stats: { ...EMPTY_SUMMARY.stats, ...over },
  };
}

describe("buildOverviewCards", () => {
  it("固定返回 4 张卡且顺序稳定", () => {
    const cards = buildOverviewCards(EMPTY_SUMMARY);
    assert.equal(cards.length, 4);
    assert.deepEqual(
      cards.map((c) => c.label),
      ["今日价值时刻", "本周活跃用户", "本月激活率", "累计事件"],
    );
  });

  it("激活率为 null 时显示破折号并提示样本不足", () => {
    const [card] = buildOverviewCards(summaryWith({ activationRate: null })).filter(
      (c) => c.label === "本月激活率",
    );
    assert.equal(card.value, "—");
    assert.equal(card.suffix, "");
    assert.equal(card.hint, "样本不足，暂不计算");
  });

  it("激活率为 0 时显示 0% 而非破折号", () => {
    const [card] = buildOverviewCards(summaryWith({ activationRate: 0 })).filter(
      (c) => c.label === "本月激活率",
    );
    assert.equal(card.value, "0%", "0 是有效值，不能与 null 混淆");
    assert.equal(card.hint, "首次登录 7 天内达成激活");
  });

  it("有采集起始时间时提示具体日期，否则提示暂无采集", () => {
    const withTime: AnalyticsSummary = { ...EMPTY_SUMMARY, collectedSince: 1750000000000 };
    const [dated] = buildOverviewCards(withTime).filter((c) => c.label === "累计事件");
    assert.match(dated.hint, /^自 .+ 起$/);

    const [undated] = buildOverviewCards(EMPTY_SUMMARY).filter((c) => c.label === "累计事件");
    assert.equal(undated.hint, "暂无采集");
  });

  it("数值原样透传", () => {
    const cards = buildOverviewCards(
      summaryWith({ todayValueMoments: 7, wau: 3, totalEvents: 1234 }),
    );
    assert.equal(cards[0].value, 7);
    assert.equal(cards[1].value, 3);
    assert.equal(cards[3].value, 1234);
  });
});

describe("trendScale", () => {
  it("基准为最大值", () => {
    assert.equal(trendScale([{ date: "a", count: 2 }, { date: "b", count: 9 }]).max, 9);
  });

  it("空数组或全 0 时基准为 1（避免除零得到 NaN 柱高）", () => {
    assert.equal(trendScale([]).max, 1);
    assert.equal(trendScale([{ date: "a", count: 0 }]).max, 1);
  });

  it("原样透传数据", () => {
    const data = [{ date: "2026-10-01", count: 3 }];
    assert.deepEqual(trendScale(data).data, data);
  });
});

describe("事件清单常量", () => {
  it("模块清单为 8 项且无重复", () => {
    assert.equal(MODULES.length, 8);
    assert.equal(new Set(MODULES).size, 8);
  });

  it("每个事件映射的模块都在模块清单内", () => {
    for (const [event, meta] of Object.entries(EVENT_LABELS)) {
      assert.ok(MODULES.includes(meta.module), `${event} 的模块「${meta.module}」不在清单内`);
      assert.ok(meta.label.length > 0, `${event} 缺少中文名`);
    }
  });

  it("价值时刻事件都出现在事件映射中", () => {
    for (const event of VALUE_MOMENT_EVENTS) {
      assert.ok(EVENT_LABELS[event], `价值时刻事件「${event}」未在 EVENT_LABELS 中登记`);
    }
    assert.equal(VALUE_MOMENT_EVENT_COUNT, VALUE_MOMENT_EVENTS.size);
    assert.equal(VALUE_MOMENT_EVENT_COUNT, 8);
  });

  it("空汇总默认启用统计（本地统计默认开启）", () => {
    assert.equal(EMPTY_SUMMARY.enabled, true);
    assert.equal(EMPTY_SUMMARY.collectedSince, null);
  });
});
