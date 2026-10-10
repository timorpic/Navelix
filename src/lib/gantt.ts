import type { TodoItem } from "@/types";
import { toLocalDateStr } from "./date-utils.ts";

/**
 * 甘特图多尺度时间轴引擎（纯函数）。
 *
 * 从 `projects-view.tsx`（原 1501 行）抽出时进一步下沉到 lib —— 时间轴计算
 * 与 React 无关，放在这里才能被单测覆盖（`src/hooks/use-gantt.ts` 只负责
 * 把结果接进组件，本身不含算法）。
 */

export type GanttScale = "day" | "month" | "year";

export interface GanttColumn {
  key: string;
  label: string;
  subLabel: string;
  isCurrent: boolean;
  isWeekend?: boolean;
}

export interface GanttPosition {
  startIdx: number;
  span: number;
  outOfRange?: "past" | "future";
}

export interface GanttTimeline {
  columns: GanttColumn[];
  timelineLabel: string;
  prevLabel: string;
  nextLabel: string;
  stepAmount: number;
}

const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * 构建多尺度时间轴。
 *
 * - `day`：以今天前推 3 天为起点，共 21 列（3 周敏捷视窗），翻页步长 7 天
 * - `month`：以当前月前推 2 个月为起点，共 12 列（年度推进），翻页步长 3 个月
 * - `year`：以上一年为起点，共 12 列（3 年 × 4 季度），翻页步长 1 年
 *
 * `todayStr` 由调用方传入而非内部取当前时间，便于测试与跨渲染保持一致。
 */
export function buildGanttTimeline(
  scale: GanttScale,
  offset: number,
  todayStr: string,
): GanttTimeline {
  const cols: GanttColumn[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  const currentQuarter = Math.floor(currentMonth / 3) + 1; // 1-4

  if (scale === "day") {
    const base = new Date();
    base.setDate(base.getDate() - 3 + offset);
    for (let i = 0; i < 21; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const dStr = toLocalDateStr(d);
      const dayOfWeek = d.getDay();
      cols.push({
        key: dStr,
        label: String(d.getDate()),
        subLabel: `周${DAY_NAMES[dayOfWeek]}`,
        isCurrent: dStr === todayStr,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      });
    }
    return {
      columns: cols,
      timelineLabel: `日排期视界：${cols[0].key} ~ ${cols[cols.length - 1].key}`,
      prevLabel: "◀ 前移 7 天",
      nextLabel: "后移 7 天 ▶",
      stepAmount: 7,
    };
  }

  if (scale === "month") {
    const baseDate = new Date(currentYear, currentMonth - 2 + offset, 1);
    for (let i = 0; i < 12; i++) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
      const yr = d.getFullYear();
      const mo = d.getMonth() + 1;
      const key = `${yr}-${String(mo).padStart(2, "0")}`;
      cols.push({
        key,
        label: `${mo}月`,
        subLabel: `${yr}年`,
        isCurrent: yr === currentYear && mo === currentMonth + 1,
      });
    }
    return {
      columns: cols,
      timelineLabel: `月推进视界：${cols[0].subLabel}${cols[0].label} ~ ${cols[cols.length - 1].subLabel}${cols[cols.length - 1].label}`,
      prevLabel: "◀ 前移 3 个月",
      nextLabel: "后移 3 个月 ▶",
      stepAmount: 3,
    };
  }

  // scale === "year"（跨年战略路线图：3 年 = 12 个季度）
  const baseYear = currentYear - 1 + offset;
  for (let yr = baseYear; yr <= baseYear + 2; yr++) {
    for (let q = 1; q <= 4; q++) {
      const key = `${yr}-Q${q}`;
      cols.push({
        key,
        label: `Q${q}`,
        subLabel: `${yr}年`,
        isCurrent: yr === currentYear && q === currentQuarter,
      });
    }
  }
  return {
    columns: cols,
    timelineLabel: `年路线图视界：${baseYear}年 ~ ${baseYear + 2}年 (12 个季度)`,
    prevLabel: "◀ 前移 1 年",
    nextLabel: "后移 1 年 ▶",
    stepAmount: 1,
  };
}

/** 计算单个截止日期落在时间轴上的起止列；越界时贴边并标记 past/future。 */
export function ganttPositionFor(
  columns: GanttColumn[],
  scale: GanttScale,
  dueDate?: string,
): GanttPosition {
  const colCount = columns.length;
  // 无日期或非 YYYY-MM-DD：给一个居中的默认短条
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}/.test(dueDate)) {
    return { startIdx: 2, span: 2 };
  }

  if (scale === "day") {
    const dueIdx = columns.findIndex((c) => c.key === dueDate);
    if (dueIdx === -1) {
      if (dueDate < columns[0].key) return { startIdx: 0, span: 1, outOfRange: "past" };
      return { startIdx: colCount - 1, span: 1, outOfRange: "future" };
    }
    // 条块从截止日前 2 天开始，形成一段可见的推进期
    const startIdx = Math.max(0, dueIdx - 2);
    const span = Math.max(1, dueIdx - startIdx + 1);
    return { startIdx, span };
  }

  if (scale === "month") {
    const targetMonth = dueDate.slice(0, 7); // YYYY-MM
    const dueIdx = columns.findIndex((c) => c.key === targetMonth);
    if (dueIdx === -1) {
      if (targetMonth < columns[0].key) return { startIdx: 0, span: 1, outOfRange: "past" };
      return { startIdx: colCount - 1, span: 1, outOfRange: "future" };
    }
    return { startIdx: dueIdx, span: 1 };
  }

  const yr = parseInt(dueDate.slice(0, 4), 10);
  const mo = parseInt(dueDate.slice(5, 7), 10);
  const q = Math.floor((mo - 1) / 3) + 1;
  const targetQuarter = `${yr}-Q${q}`;
  const dueIdx = columns.findIndex((c) => c.key === targetQuarter);
  if (dueIdx === -1) {
    if (targetQuarter < columns[0].key) return { startIdx: 0, span: 1, outOfRange: "past" };
    return { startIdx: colCount - 1, span: 1, outOfRange: "future" };
  }
  return { startIdx: dueIdx, span: 1 };
}

/** 计算父项目在时间轴上的整体跨度：取所有子任务日期的极值区间。 */
export function ganttProjectSpanFor(
  columns: GanttColumn[],
  scale: GanttScale,
  projectTodos: Pick<TodoItem, "dueDate">[],
): { startIdx: number; span: number } {
  const colCount = columns.length;
  if (projectTodos.length === 0) {
    return { startIdx: 0, span: colCount };
  }

  const validDates = projectTodos
    .map((t) => t.dueDate)
    .filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d));

  // 全部子任务都没有日期：铺满整条时间轴
  if (validDates.length === 0) {
    return { startIdx: 0, span: colCount };
  }

  const minDate = validDates.reduce((min, d) => (d < min ? d : min), validDates[0]);
  const maxDate = validDates.reduce((max, d) => (d > max ? d : max), validDates[0]);

  const startPos = ganttPositionFor(columns, scale, minDate);
  const endPos = ganttPositionFor(columns, scale, maxDate);

  const startIdx = Math.min(startPos.startIdx, endPos.startIdx);
  const endIdx = Math.max(
    startPos.startIdx + startPos.span - 1,
    endPos.startIdx + endPos.span - 1,
  );
  const span = Math.max(1, endIdx - startIdx + 1);

  return { startIdx, span };
}
