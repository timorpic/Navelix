import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildGanttTimeline,
  ganttPositionFor,
  ganttProjectSpanFor,
  type GanttScale,
} from "../gantt.ts";
import { toLocalDateStr } from "../date-utils.ts";

/**
 * 甘特图时间轴引擎单测。
 *
 * 这些算法原先内联在 `projects-view.tsx`（1501 行的巨石组件）里，无法被测试覆盖；
 * 抽出到 lib 后在此固定住行为，防止后续重构悄悄改变时间轴尺度或条块定位。
 */

const TODAY = toLocalDateStr(new Date());

describe("buildGanttTimeline", () => {
  test("day 尺度固定 21 列，步长 7 天，今天被标记为当前列", () => {
    const t = buildGanttTimeline("day", 0, TODAY);
    assert.equal(t.columns.length, 21);
    assert.equal(t.stepAmount, 7);
    assert.equal(t.columns.filter((c) => c.isCurrent).length, 1);
    assert.equal(t.columns.find((c) => c.isCurrent)?.key, TODAY);
    // 起点是今天前推 3 天，因此今天落在第 4 列（下标 3）
    assert.equal(t.columns.findIndex((c) => c.isCurrent), 3);
  });

  test("day 尺度标注周末", () => {
    const t = buildGanttTimeline("day", 0, TODAY);
    for (const col of t.columns) {
      const dow = new Date(`${col.key}T00:00:00`).getDay();
      assert.equal(col.isWeekend, dow === 0 || dow === 6, `${col.key} 周末标记`);
    }
    // 21 天必然覆盖 6 个周末日
    assert.equal(t.columns.filter((c) => c.isWeekend).length, 6);
  });

  test("day 尺度 offset 平移整段时间轴", () => {
    const base = buildGanttTimeline("day", 0, TODAY);
    const shifted = buildGanttTimeline("day", 7, TODAY);
    const diffMs =
      new Date(`${shifted.columns[0].key}T00:00:00`).getTime() -
      new Date(`${base.columns[0].key}T00:00:00`).getTime();
    assert.equal(diffMs, 7 * 86400000);
    // 平移后今天不再在视窗内
    assert.equal(shifted.columns.filter((c) => c.isCurrent).length, 0);
  });

  test("month 尺度固定 12 列，key 形如 YYYY-MM 且跨年连续", () => {
    const t = buildGanttTimeline("month", 0, TODAY);
    assert.equal(t.columns.length, 12);
    assert.equal(t.stepAmount, 3);
    for (const col of t.columns) {
      assert.match(col.key, /^\d{4}-\d{2}$/);
    }
    // 相邻列必须是连续月份（含跨年）
    for (let i = 1; i < t.columns.length; i++) {
      const prev = new Date(`${t.columns[i - 1].key}-01T00:00:00`);
      const cur = new Date(`${t.columns[i].key}-01T00:00:00`);
      assert.equal(
        (cur.getFullYear() - prev.getFullYear()) * 12 + (cur.getMonth() - prev.getMonth()),
        1,
        `${t.columns[i - 1].key} -> ${t.columns[i].key}`,
      );
    }
    // 当前月份在视窗内且被唯一标记
    const currentMonth = TODAY.slice(0, 7);
    assert.equal(t.columns.filter((c) => c.isCurrent).length, 1);
    assert.equal(t.columns.find((c) => c.isCurrent)?.key, currentMonth);
  });

  test("year 尺度固定 12 个季度，key 形如 YYYY-Qn", () => {
    const t = buildGanttTimeline("year", 0, TODAY);
    assert.equal(t.columns.length, 12);
    assert.equal(t.stepAmount, 1);
    for (const col of t.columns) {
      assert.match(col.key, /^\d{4}-Q[1-4]$/);
    }
    assert.equal(t.columns.filter((c) => c.isCurrent).length, 1);
    // 当前季度 = 当前年份 + floor(month/3)+1
    const now = new Date();
    const expected = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
    assert.equal(t.columns.find((c) => c.isCurrent)?.key, expected);
  });

  test("各尺度都提供非空的翻页文案", () => {
    for (const scale of ["day", "month", "year"] as GanttScale[]) {
      const t = buildGanttTimeline(scale, 0, TODAY);
      assert.ok(t.timelineLabel.length > 0, `${scale} timelineLabel`);
      assert.ok(t.prevLabel.length > 0, `${scale} prevLabel`);
      assert.ok(t.nextLabel.length > 0, `${scale} nextLabel`);
    }
  });
});

describe("ganttPositionFor", () => {
  test("day 尺度：截止日前 2 天起算，跨度覆盖到截止日", () => {
    const { columns } = buildGanttTimeline("day", 0, TODAY);
    const target = columns[10].key;
    const pos = ganttPositionFor(columns, "day", target);
    assert.equal(pos.startIdx, 8);
    assert.equal(pos.span, 3);
    assert.equal(pos.outOfRange, undefined);
    // 条块右端正好落在截止日那一列
    assert.equal(pos.startIdx + pos.span - 1, 10);
  });

  test("day 尺度：视窗前 2 列起算时被夹到第 0 列", () => {
    const { columns } = buildGanttTimeline("day", 0, TODAY);
    const pos = ganttPositionFor(columns, "day", columns[1].key);
    assert.equal(pos.startIdx, 0);
    assert.equal(pos.span, 2);
  });

  test("越界日期贴边并标记方向", () => {
    const { columns } = buildGanttTimeline("day", 0, TODAY);
    const past = ganttPositionFor(columns, "day", "2000-01-01");
    assert.deepEqual(past, { startIdx: 0, span: 1, outOfRange: "past" });

    const future = ganttPositionFor(columns, "day", "2099-12-31");
    assert.deepEqual(future, {
      startIdx: columns.length - 1,
      span: 1,
      outOfRange: "future",
    });
  });

  test("month 尺度按 YYYY-MM 匹配，跨度恒为 1", () => {
    const { columns } = buildGanttTimeline("month", 0, TODAY);
    const pos = ganttPositionFor(columns, "month", `${columns[5].key}-15`);
    assert.equal(pos.startIdx, 5);
    assert.equal(pos.span, 1);
  });

  test("year 尺度把月份折算到所属季度", () => {
    const { columns } = buildGanttTimeline("year", 0, TODAY);
    const key = columns[6].key; // YYYY-Qn
    const [yr, q] = key.split("-Q");
    // 该季度首月与末月都应落到同一列
    const firstMonth = (Number(q) - 1) * 3 + 1;
    const lastMonth = firstMonth + 2;
    const a = ganttPositionFor(columns, "year", `${yr}-${String(firstMonth).padStart(2, "0")}-01`);
    const b = ganttPositionFor(columns, "year", `${yr}-${String(lastMonth).padStart(2, "0")}-28`);
    assert.equal(a.startIdx, 6);
    assert.equal(b.startIdx, 6);
  });

  test("缺失或非法日期给出居中的默认短条，而非贴边", () => {
    const { columns } = buildGanttTimeline("day", 0, TODAY);
    for (const bad of [undefined, "", "not-a-date", "2026/10/11"]) {
      const pos = ganttPositionFor(columns, "day", bad);
      assert.deepEqual(pos, { startIdx: 2, span: 2 }, `输入 ${JSON.stringify(bad)}`);
    }
  });
});

describe("ganttProjectSpanFor", () => {
  test("无子任务或全部无日期时铺满整条时间轴", () => {
    const { columns } = buildGanttTimeline("day", 0, TODAY);
    assert.deepEqual(ganttProjectSpanFor(columns, "day", []), {
      startIdx: 0,
      span: columns.length,
    });
    assert.deepEqual(
      ganttProjectSpanFor(columns, "day", [{ dueDate: "" }, { dueDate: undefined }]),
      { startIdx: 0, span: columns.length },
    );
  });

  test("跨度取最早与最晚日期的并集", () => {
    const { columns } = buildGanttTimeline("day", 0, TODAY);
    const early = columns[8].key;
    const late = columns[14].key;
    const span = ganttProjectSpanFor(columns, "day", [
      { dueDate: late },
      { dueDate: early },
      { dueDate: columns[11].key },
    ]);
    // early 的条块从下标 6 起，late 的右端在下标 14
    assert.equal(span.startIdx, 6);
    assert.equal(span.startIdx + span.span - 1, 14);
  });

  test("越界日期不撑破时间轴", () => {
    const { columns } = buildGanttTimeline("day", 0, TODAY);
    const span = ganttProjectSpanFor(columns, "day", [
      { dueDate: "1999-01-01" },
      { dueDate: "2099-12-31" },
    ]);
    assert.equal(span.startIdx, 0);
    assert.equal(span.span, columns.length);
  });

  test("非法日期被忽略，不影响合法日期的跨度", () => {
    const { columns } = buildGanttTimeline("day", 0, TODAY);
    const withJunk = ganttProjectSpanFor(columns, "day", [
      { dueDate: columns[10].key },
      { dueDate: "garbage" },
    ]);
    const clean = ganttProjectSpanFor(columns, "day", [{ dueDate: columns[10].key }]);
    assert.deepEqual(withJunk, clean);
  });
});
