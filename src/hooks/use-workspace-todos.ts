"use client";

import { useCallback, useEffect, useState } from "react";
import type { TodoItem } from "@/types";
import { useNavelixData } from "@/context/navelix-context";
import { pushNotification } from "@/lib/client/notifications";
import { addDaysLocal, toLocalDateStr } from "@/lib/date-utils";

/**
 * 首页工作台两栏共享的待办操作与派生数据。
 *
 * 从 `workspace-overview-columns.tsx`（原 811 行）抽出：该文件把
 * 「项目概览」与「日程概览」两个不相关栏目塞在一起，且两栏都要用
 * `handleToggleTodo` / `todayStr` / 成员列表。这些共享部分集中到本 hook，
 * 两栏组件各自只保留自己的状态与 JSX。
 */

export interface WorkspaceMember {
  id: string;
  username: string;
  displayName?: string;
}

export interface UseWorkspaceTodosResult {
  todayStr: string;
  members: WorkspaceMember[];
  /** 勾选/取消勾选待办 */
  toggleTodo: (id: string, done: boolean) => Promise<void>;
  /** 待办顺延一天 */
  postponeOneDay: (item: TodoItem) => Promise<void>;
  /** 从首页快速新增待办 */
  quickAddTodo: (input: {
    title: string;
    priority: "high" | "medium" | "low";
    dueDate: string;
    assigneeId?: string;
  }) => Promise<boolean>;
}

export function useWorkspaceTodos(): UseWorkspaceTodosResult {
  const { refreshData } = useNavelixData();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const todayStr = toLocalDateStr();

  useEffect(() => {
    fetch("/api/user/members")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.members)) setMembers(d.members);
      })
      .catch(() => {});
  }, []);

  const toggleTodo = useCallback(
    async (id: string, done: boolean) => {
      try {
        await fetch(`/api/todos/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ done: !done }),
        });
        window.dispatchEvent(new CustomEvent("navelix-workspace-updated"));
        refreshData();
      } catch {
        // ignore
      }
    },
    [refreshData],
  );

  const postponeOneDay = useCallback(
    async (item: TodoItem) => {
      const newDueDate = addDaysLocal(item.dueDate || todayStr, 1);
      try {
        await fetch(`/api/todos/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dueDate: newDueDate }),
        });
        window.dispatchEvent(new CustomEvent("navelix-workspace-updated"));
        refreshData();
        pushNotification(
          "⏩ 日程已顺延1天",
          `${item.title} -> ${newDueDate}`,
          "calendar",
        );
      } catch {
        // ignore
      }
    },
    [refreshData, todayStr],
  );

  const quickAddTodo = useCallback(
    async (input: {
      title: string;
      priority: "high" | "medium" | "low";
      dueDate: string;
      assigneeId?: string;
    }) => {
      const title = input.title.trim();
      if (!title) return false;
      try {
        const assignee = members.find((m) => m.id === input.assigneeId);
        const res = await fetch("/api/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            priority: input.priority,
            dueDate: input.dueDate,
            assigneeId: assignee?.id || "",
            assigneeName: assignee ? assignee.displayName || assignee.username : "",
          }),
        });
        if (res.ok) {
          window.dispatchEvent(new CustomEvent("navelix-workspace-updated"));
          refreshData();
          pushNotification("📅 新增日程事项", title, "calendar");
          return true;
        }
      } catch {
        // ignore
      }
      return false;
    },
    [members, refreshData],
  );

  return { todayStr, members, toggleTodo, postponeOneDay, quickAddTodo };
}
