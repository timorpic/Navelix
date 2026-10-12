"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { addDaysLocal } from "@/lib/date-utils";

/**
 * AI 项目拆解的任务草稿与微调。
 *
 * 从 `projects-view.tsx`（原 1501 行）抽出 —— 该文件把「AI 拆解出的里程碑草稿」
 * 的 4 个 state、7 个编辑 handler 与卡片看板/甘特图塞在一起。草稿在提交前
 * 独立于服务端存在，是一块自洽的功能单元。
 */

export interface GeneratedTask {
  id?: string;
  title: string;
  priority: "high" | "medium" | "low";
  dueDate: string;
  assigneeId?: string;
  assigneeName?: string;
}

export interface AssignableMember {
  id: string;
  username: string;
  displayName?: string;
}

export interface UseAiBreakdownResult {
  loading: boolean;
  notice: string;
  /** 一次性校验/错误提示（替代原先的 `alert()`），由调用方用 Toast 展示 */
  warning: string;
  clearWarning: () => void;
  tasks: GeneratedTask[];
  syncToCalendar: boolean;
  setSyncToCalendar: (v: boolean) => void;
  /** 调用后端拆解接口，结果写入 tasks */
  generate: (projectName: string, projectDescription: string) => Promise<void>;
  updateTitle: (index: number, title: string) => void;
  updatePriority: (index: number, priority: "high" | "medium" | "low") => void;
  updateDueDate: (index: number, date: string) => void;
  updateAssignee: (index: number, memberId: string) => void;
  removeTask: (index: number) => void;
  addTask: () => void;
  /** 载入已有项目的阶段里程碑作为草稿（编辑模式） */
  loadDraft: (tasks: GeneratedTask[], notice: string) => void;
  /** 保存成功后清空草稿 */
  reset: () => void;
}

export function useAiBreakdown(members: AssignableMember[]): UseAiBreakdownResult {
  const tx = useTranslations();
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [warning, setWarning] = useState("");
  const [tasks, setTasks] = useState<GeneratedTask[]>([]);
  const [syncToCalendar, setSyncToCalendar] = useState(true);

  const generate = useCallback(
    async (projectName: string, projectDescription: string) => {
      const trimmedName = projectName.trim();
      if (!trimmedName) {
        setWarning(tx("enter_a_project_name_before_requesting_an_ai_bre_5762e475"));
        return;
      }

      setWarning("");
      setLoading(true);
      setNotice("");
      try {
        const res = await fetch("/api/ai/project-breakdown", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectName: trimmedName,
            projectDescription: projectDescription.trim(),
          }),
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.tasks)) {
          setTasks(data.tasks);
          setNotice(
            data.source === "ai_model"
              ? tx("ai_has_planned_milestones_schedules_and_assignme_430e3700")
              : tx("the_agile_planning_engine_has_scheduled_tasks_an_966c0000"),
          );
        } else {
          setNotice(data.message || data.error || tx("breakdown_failed_add_tasks_manually_e6de427e"));
        }
      } catch {
        setNotice(tx("breakdown_service_request_failed_try_again_later_ef212f52"));
      } finally {
        setLoading(false);
      }
    },
    [tx],
  );

  const updateTitle = useCallback((index: number, title: string) => {
    setTasks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], title };
      return next;
    });
  }, []);

  const updatePriority = useCallback(
    (index: number, priority: "high" | "medium" | "low") => {
      setTasks((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], priority };
        return next;
      });
    },
    [],
  );

  const updateDueDate = useCallback((index: number, dueDate: string) => {
    setTasks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], dueDate };
      return next;
    });
  }, []);

  const updateAssignee = useCallback(
    (index: number, memberId: string) => {
      const matched = members.find((m) => m.id === memberId);
      setTasks((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          assigneeId: memberId,
          assigneeName: matched ? matched.displayName || matched.username : "",
        };
        return next;
      });
    },
    [members],
  );

  const removeTask = useCallback((index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addTask = useCallback(() => {
    const dateStr = addDaysLocal(new Date(), 3);
    const defaultMember = members[0];

    setTasks((prev) => [
      ...prev,
      {
        title: tx("new_stage_task_90f660dd"),
        priority: "medium",
        dueDate: dateStr,
        assigneeId: defaultMember?.id || "",
        assigneeName: defaultMember
          ? defaultMember.displayName || defaultMember.username
          : "",
      },
    ]);
  }, [members, tx]);

  const clearWarning = useCallback(() => setWarning(""), []);

  const loadDraft = useCallback((draft: GeneratedTask[], draftNotice: string) => {
    setTasks(draft);
    setNotice(draftNotice);
  }, []);

  const reset = useCallback(() => {
    setTasks([]);
    setNotice("");
  }, []);

  return {
    loading,
    notice,
    warning,
    clearWarning,
    tasks,
    syncToCalendar,
    setSyncToCalendar,
    generate,
    updateTitle,
    updatePriority,
    updateDueDate,
    updateAssignee,
    removeTask,
    addTask,
    loadDraft,
    reset,
  };
}
