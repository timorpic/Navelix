"use client";

import { todoUrl } from "@/lib/todo-url";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import type { TodoItem } from "@/types";
import { useNavelixData } from "@/context/navelix-context";
import { pushNotification } from "@/lib/client/notifications";
import { addDaysLocal, toLocalDateStr } from "@/lib/date-utils";

/**
 * 首页工作台两栏共享的待办操作与派生数据。
 *
 * 从 `workspace-overview-columns.tsx`（原 811 行）抽出：该文件把
 * 「项目概览」与「日程概览」两个不相关栏目塞在一起，且两栏都要用
 * `handleToggleTodo` / `todayStr`。这些共享部分集中到本 hook，
 * 两栏组件各自只保留自己的状态与 JSX。
 */

export interface UseWorkspaceTodosResult {
  todayStr: string;
  /** 勾选/取消勾选待办 */
  toggleTodo: (id: string, done: boolean, ownerId?: string) => Promise<void>;
  /** 待办顺延一天 */
  postponeOneDay: (item: TodoItem) => Promise<void>;
  /** 从首页快速新增待办 */
  quickAddTodo: (input: {
    title: string;
    priority: "high" | "medium" | "low";
    dueDate: string;
  }) => Promise<boolean>;
}

export function useWorkspaceTodos(): UseWorkspaceTodosResult {
  const tx = useTranslations();
  const { refreshData, mutateWorkspace } = useNavelixData();
  const todayStr = toLocalDateStr();

  const toggleTodo = useCallback(
    async (id: string, done: boolean, ownerId?: string) => {
      try {
        const res = await mutateWorkspace(todoUrl(id, ownerId), {
          method: "PATCH",
          body: { done: !done },
        });
        if (!res.ok) throw new Error("Save failed");
        refreshData();
      } catch {
        pushNotification(tx("failed_to_save_try_again_f42a1238"), tx("network_error_try_again_later_c59e54b9"), "calendar");
      }
    },
    [mutateWorkspace, refreshData, tx],
  );

  const postponeOneDay = useCallback(
    async (item: TodoItem) => {
      const newDueDate = addDaysLocal(item.dueDate || todayStr, 1);
      try {
        const res = await mutateWorkspace(todoUrl(item.id, item.ownerId), {
          method: "PATCH",
          body: { dueDate: newDueDate },
        });
        if (!res.ok) throw new Error("Save failed");
        refreshData();
        pushNotification(
          tx("schedule_moved_forward_one_day_f019321c"),
          `${item.title} -> ${newDueDate}`,
          "calendar",
        );
      } catch {
        pushNotification(tx("failed_to_save_try_again_f42a1238"), tx("network_error_try_again_later_c59e54b9"), "calendar");
      }
    },
    [mutateWorkspace, refreshData, todayStr, tx],
  );

  const quickAddTodo = useCallback(
    async (input: {
      title: string;
      priority: "high" | "medium" | "low";
      dueDate: string;
    }) => {
      const title = input.title.trim();
      if (!title) return false;
      try {
        const res = await mutateWorkspace("/api/todos", {
          method: "POST",
          body: {
            title,
            priority: input.priority,
            dueDate: input.dueDate,
          },
        });
        if (res.ok) {
          refreshData();
          pushNotification(tx("schedule_added_5c1114a4"), title, "calendar");
          return true;
        }
      } catch {
        // ignore
      }
      return false;
    },
    [mutateWorkspace, refreshData, tx],
  );

  return { todayStr, toggleTodo, postponeOneDay, quickAddTodo };
}
