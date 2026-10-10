"use client";

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
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [warning, setWarning] = useState("");
  const [tasks, setTasks] = useState<GeneratedTask[]>([]);
  const [syncToCalendar, setSyncToCalendar] = useState(true);

  const generate = useCallback(
    async (projectName: string, projectDescription: string) => {
      const trimmedName = projectName.trim();
      if (!trimmedName) {
        setWarning("请先输入项目名称，再让 AI 帮您拆解！");
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
              ? "✨ AI 大模型已为您规划并指派里程碑与排期，您可随时在下方微调任务与责任人！"
              : "⚡ 已使用敏捷工程规划引擎为您智能排期与指派责任人，您可随时在下方微调！",
          );
        } else {
          setNotice(data.error || "拆解失败，请手动添加任务");
        }
      } catch {
        setNotice("⚠️ 请求拆解服务失败，请稍后重试。");
      } finally {
        setLoading(false);
      }
    },
    [],
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
        title: "新阶段行动任务",
        priority: "medium",
        dueDate: dateStr,
        assigneeId: defaultMember?.id || "",
        assigneeName: defaultMember
          ? defaultMember.displayName || defaultMember.username
          : "",
      },
    ]);
  }, [members]);

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
