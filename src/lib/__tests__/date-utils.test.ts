import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { addDaysLocal, formatRelativeTime, toLocalDateStr } from "../date-utils.ts";

/**
 * 相对时间格式化测试。
 *
 * 回归背景：项目里曾有 4 份重复实现，分两种风格且回退阈值不一致
 * （words 为 30 天、compact 为 7 天）。现统一到 date-utils 的
 * `formatRelativeTime(ts, { style, fallbackAfterDays })`，本测试锁定两种风格
 * 与阈值行为，确保合并未改变既有观感。
 */
describe("date-utils: formatRelativeTime", () => {
  const NOW = Date.now();
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it("一分钟内应为「刚刚」", () => {
    assert.equal(formatRelativeTime(NOW), "刚刚");
    assert.equal(formatRelativeTime(NOW - 30_000), "刚刚");
    assert.equal(formatRelativeTime(NOW, { style: "compact" }), "刚刚");
  });

  it("words 风格应输出中文单位", () => {
    assert.equal(formatRelativeTime(NOW - 3 * MIN), "3 分钟前");
    assert.equal(formatRelativeTime(NOW - 2 * HOUR), "2 小时前");
    assert.equal(formatRelativeTime(NOW - 5 * DAY), "5 天前");
  });

  it("compact 风格应输出紧凑后缀", () => {
    assert.equal(formatRelativeTime(NOW - 3 * MIN, { style: "compact" }), "3m");
    assert.equal(formatRelativeTime(NOW - 2 * HOUR, { style: "compact" }), "2h");
    assert.equal(formatRelativeTime(NOW - 5 * DAY, { style: "compact" }), "5d");
  });

  it("默认回退阈值为 30 天", () => {
    const within = formatRelativeTime(NOW - 29 * DAY);
    assert.match(within, /天前$/, "29 天应仍以相对时间展示");

    const beyond = formatRelativeTime(NOW - 40 * DAY);
    assert.doesNotMatch(beyond, /天前$/, "超过 30 天应回退为日期");
    assert.match(beyond, /\d{4}|\d+\/\d+/, "应显示为本地日期");
  });

  it("fallbackAfterDays 应可覆盖（保留各调用点原有观感）", () => {
    // recent-activities-card 与 activity-feed 原为 7 天阈值
    const at10Days = formatRelativeTime(NOW - 10 * DAY, { fallbackAfterDays: 7 });
    assert.doesNotMatch(at10Days, /天前$/, "7 天阈值下 10 天应回退为日期");

    // today-activity-widget 原本永不回退
    const unbounded = formatRelativeTime(NOW - 400 * DAY, {
      style: "compact",
      fallbackAfterDays: Infinity,
    });
    assert.equal(unbounded, "400d", "无上限时应始终以相对时间展示");
  });

  it("两种风格在回退后应给出一致的日期", () => {
    const ts = NOW - 60 * DAY;
    assert.equal(
      formatRelativeTime(ts),
      formatRelativeTime(ts, { style: "compact" }),
      "回退为日期后与风格无关",
    );
  });
});

describe("date-utils: toLocalDateStr / addDaysLocal", () => {
  it("toLocalDateStr 应输出本地 YYYY-MM-DD", () => {
    assert.equal(toLocalDateStr(new Date(2026, 0, 5)), "2026-01-05");
    assert.equal(toLocalDateStr(new Date(2026, 11, 31)), "2026-12-31");
  });

  it("addDaysLocal 应正确处理跨月与跨年", () => {
    assert.equal(addDaysLocal("2026-01-31", 1), "2026-02-01");
    assert.equal(addDaysLocal("2026-12-31", 1), "2027-01-01");
    assert.equal(addDaysLocal("2026-03-01", -1), "2026-02-28");
  });

  it("addDaysLocal 对非法输入应回退为今天加减", () => {
    const result = addDaysLocal("not-a-date", 0);
    assert.equal(result, toLocalDateStr());
  });
});
