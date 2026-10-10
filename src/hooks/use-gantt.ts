"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TodoItem } from "@/types";
import { toLocalDateStr } from "@/lib/date-utils";
import {
  buildGanttTimeline,
  ganttPositionFor,
  ganttProjectSpanFor,
  type GanttColumn,
  type GanttPosition,
  type GanttScale,
} from "@/lib/gantt";

/**
 * 甘特图多尺度时间轴引擎与交互状态。
 *
 * 从 `projects-view.tsx`（原 1501 行）抽出 —— 该文件把「卡片看板」和「甘特图视界」
 * 两个互不相关的视图、以及甘特图专属的 4 个 state、3 个尺度计算函数塞在一起。
 * 本 hook 承载甘特图的全部状态与时间轴计算，视图组件只负责渲染。
 */

export type { GanttScale, GanttColumn, GanttPosition } from "@/lib/gantt";

export interface UseGanttResult {
  scale: GanttScale;
  offset: number;
  setOffset: React.Dispatch<React.SetStateAction<number>>;
  projectFilter: string;
  setProjectFilter: (v: string) => void;
  collapsedIds: string[];
  toggleCollapse: (id: string) => void;
  handleScaleChange: (scale: GanttScale) => void;
  columns: GanttColumn[];
  timelineLabel: string;
  prevLabel: string;
  nextLabel: string;
  stepAmount: number;
  calculateGanttPosition: (dueDate?: string) => GanttPosition;
  calculateProjectSpan: (projectTodos: TodoItem[]) => { startIdx: number; span: number };
}

const SCALE_STORAGE_KEY = "navelix_projects_gantt_scale";
const COLLAPSED_STORAGE_KEY = "navelix_projects_gantt_collapsed_ids";

export function useGantt(): UseGanttResult {
  const [scale, setScale] = useState<GanttScale>("day");
  const [offset, setOffset] = useState(0);
  // 甘特图项目筛选（"all" 或项目 id）
  const [projectFilter, setProjectFilter] = useState<string>("all");
  // 甘特图折叠状态（默认全展开，单独记录折叠的项目）
  const [collapsedIds, setCollapsedIds] = useState<string[]>([]);

  // 挂载后同步本地设备状态记忆
  useEffect(() => {
    try {
      const savedScale = localStorage.getItem(SCALE_STORAGE_KEY);
      if (savedScale === "day" || savedScale === "month" || savedScale === "year") {
        queueMicrotask(() => setScale(savedScale));
      }
      const savedCollapsed = localStorage.getItem(COLLAPSED_STORAGE_KEY);
      if (savedCollapsed) {
        queueMicrotask(() => setCollapsedIds(JSON.parse(savedCollapsed)));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleScaleChange = useCallback((next: GanttScale) => {
    setScale(next);
    setOffset(0);
    try {
      localStorage.setItem(SCALE_STORAGE_KEY, next);
    } catch {}
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((itemId) => itemId !== id)
        : [...prev, id];
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // ── 多尺度时间轴计算（算法在 lib/gantt.ts，本 hook 只接 React 状态） ──
  const todayStr = useMemo(() => toLocalDateStr(new Date()), []);

  const { columns, timelineLabel, prevLabel, nextLabel, stepAmount } = useMemo(
    () => buildGanttTimeline(scale, offset, todayStr),
    [scale, offset, todayStr],
  );

  const calculateGanttPosition = useCallback(
    (dueDate?: string): GanttPosition => ganttPositionFor(columns, scale, dueDate),
    [columns, scale],
  );

  const calculateProjectSpan = useCallback(
    (projectTodos: TodoItem[]) => ganttProjectSpanFor(columns, scale, projectTodos),
    [columns, scale],
  );

  return {
    scale,
    offset,
    setOffset,
    projectFilter,
    setProjectFilter,
    collapsedIds,
    toggleCollapse,
    handleScaleChange,
    columns,
    timelineLabel,
    prevLabel,
    nextLabel,
    stepAmount,
    calculateGanttPosition,
    calculateProjectSpan,
  };
}
