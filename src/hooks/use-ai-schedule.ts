"use client";

import { useCallback, useState } from "react";
import { useNavelixData } from "@/context/navelix-context";
import { pushNotification } from "@/lib/client/notifications";

/**
 * AI 每日排程的生成、编辑与写入。
 *
 * 从 `calendar-view.tsx`（原 1457 行）抽出 —— 该文件把 AI 排程的 6 个 state、
 * 6 个 handler 与主日历视图塞在一起。AI 排程是一块完整且独立的功能，
 * 集中到本 hook 后，日历组件只需调用 `generate()` 并在需要时渲染弹窗。
 */

export interface AiScheduledTask {
  title: string;
  priority: "high" | "medium" | "low";
  dueDate: string;
}

export interface UseAiScheduleResult {
  open: boolean;
  setOpen: (v: boolean) => void;
  advice: string;
  tasks: AiScheduledTask[];
  selectedIndices: Set<number>;
  planning: boolean;
  applying: boolean;
  /** 一次性校验/错误提示（替代原先的 `alert()`），在弹窗内展示 */
  warning: string;
  clearWarning: () => void;
  generate: (dateStr: string) => Promise<void>;
  toggleIndex: (index: number) => void;
  updateTaskTitle: (index: number, title: string) => void;
  updateTaskPriority: (index: number, priority: "high" | "medium" | "low") => void;
  deleteTask: (index: number) => void;
  addCustomTask: (dateStr: string) => void;
  applyToCalendar: (dateStr: string) => Promise<void>;
}

export function useAiSchedule(): UseAiScheduleResult {
  const { refreshData } = useNavelixData();
  const [open, setOpen] = useState(false);
  const [advice, setAdvice] = useState("");
  const [tasks, setTasks] = useState<AiScheduledTask[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [planning, setPlanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [warning, setWarning] = useState("");

  const clearWarning = useCallback(() => setWarning(""), []);

  const generate = useCallback(async (dateStr: string) => {
    setWarning("");
    setPlanning(true);
    setAdvice("");
    setTasks([]);
    setSelectedIndices(new Set());
    setOpen(true);

    try {
      const res = await fetch("/api/ai/daily-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.tasks)) {
        setAdvice(data.advice || "已为您规划今日精力时段与执行任务。");
        setTasks(data.tasks);
        // 默认全选
        setSelectedIndices(new Set(data.tasks.map((_: AiScheduledTask, idx: number) => idx)));
      } else {
        setAdvice("未获取到排程结果，请手动规划日程。");
      }
    } catch {
      setAdvice("请求 AI 排程服务失败，请稍后重试。");
    } finally {
      setPlanning(false);
    }
  }, []);

  const toggleIndex = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const updateTaskTitle = useCallback((index: number, newTitle: string) => {
    setTasks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], title: newTitle };
      return next;
    });
  }, []);

  const updateTaskPriority = useCallback(
    (index: number, priority: "high" | "medium" | "low") => {
      setTasks((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], priority };
        return next;
      });
    },
    [],
  );

  const deleteTask = useCallback((index: number) => {
    setTasks((prev) => prev.filter((_, idx) => idx !== index));
    setSelectedIndices((prev) => {
      const next = new Set<number>();
      Array.from(prev).forEach((val) => {
        if (val < index) next.add(val);
        else if (val > index) next.add(val - 1);
      });
      return next;
    });
  }, []);

  const addCustomTask = useCallback((dateStr: string) => {
    setTasks((prev) => {
      const newIdx = prev.length;
      setSelectedIndices((s) => new Set([...s, newIdx]));
      return [
        ...prev,
        { title: "新规划执行任务", priority: "medium" as const, dueDate: dateStr },
      ];
    });
  }, []);

  const applyToCalendar = useCallback(
    async (dateStr: string) => {
      const tasksToWrite = tasks.filter((_, idx) => selectedIndices.has(idx));
      if (tasksToWrite.length === 0) {
        setWarning("请至少勾选一项任务以写入日历！");
        return;
      }

      setWarning("");
      setApplying(true);
      try {
        await Promise.all(
          tasksToWrite.map((t) =>
            fetch("/api/todos", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: t.title,
                priority: t.priority,
                dueDate: t.dueDate || dateStr,
              }),
            }),
          ),
        );

        window.dispatchEvent(new CustomEvent("navelix-workspace-updated"));
        pushNotification(
          "🎉 AI 智能排程已写入日历",
          `已成功将 ${tasksToWrite.length} 项日程任务写入 ${dateStr} 日历中枢！`,
          "calendar",
        );

        setOpen(false);
        refreshData();
      } catch {
        setWarning("写入日历失败，请稍后重试。");
      } finally {
        setApplying(false);
      }
    },
    [tasks, selectedIndices, refreshData],
  );

  return {
    open,
    setOpen,
    advice,
    tasks,
    selectedIndices,
    planning,
    applying,
    warning,
    clearWarning,
    generate,
    toggleIndex,
    updateTaskTitle,
    updateTaskPriority,
    deleteTask,
    addCustomTask,
    applyToCalendar,
  };
}
