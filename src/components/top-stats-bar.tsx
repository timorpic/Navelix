"use client";

import { useTranslations } from "next-intl";
import React, { useState, useMemo } from "react";
import type { Category, SiteLink } from "@/types";
import { useNavelixData } from "@/context/navelix-context";
import { toLocalDateStr } from "@/lib/date-utils";
import { computeProjectMetrics } from "@/lib/dashboard-metrics";
import AddLinkModal from "./add-link-modal";
import Overlay from "./overlay";

interface TopStatsBarProps {
  onOpenAssistant?: () => void;
  categories: Category[];
  links: SiteLink[];
  onSelectCategory?: (id: string) => void;
}

export default function TopStatsBar({
  categories,
  onOpenAssistant,
  onSelectCategory,
}: TopStatsBarProps) {
  const tx = useTranslations();
  const { todos, projects, refreshData, addLink, mutateWorkspace } = useNavelixData();
  const [showAddLinkModal, setShowAddLinkModal] = useState(false);

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskNotice, setTaskNotice] = useState("");

  // Derived metrics for Actionable Cockpit
  // 项目状态统计统一走 normalizeProjectStatus（历史中文/英文/自定义变体都能归类）
  const projectMetrics = useMemo(
    () => computeProjectMetrics(projects),
    [projects],
  );

  // 1. 进行中项目数
  const inProgressProjectsCount = projectMetrics.inProgress;

  // 2. 待处理任务数
  const pendingTodosCount = useMemo(
    () => todos.filter((t) => !t.done).length,
    [todos],
  );

  // 3. 本周已完成数 (已完成待办 + 已完成项目)
  const weeklyCompletedCount = useMemo(() => {
    const completedTodos = todos.filter((t) => t.done).length;
    return completedTodos + projectMetrics.completed;
  }, [todos, projectMetrics]);

  // Quick Action Handlers
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    try {
      const res = await mutateWorkspace("/api/todos", {
        method: "POST",
        body: {
          title: taskTitle.trim(),
          priority: "medium",
          dueDate: toLocalDateStr(),
        },
      });
      if (res.ok) {
        setTaskNotice(tx("todo_created_1c68bdcd"));
        setTaskTitle("");
        refreshData();
        setTimeout(() => {
          setTaskNotice("");
          setShowTaskModal(false);
        }, 1200);
      }
    } catch {
      setTaskNotice(tx("failed_to_create_7e6a71ef"));
    }
  };

  return (
    <div className="flex flex-col gap-2 mb-0">
      {/* 项目、任务、完成统计与快速操作 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-10 gap-3">
        {/* 卡片 2：⚡ 进行中项目 */}
        <div
          onClick={() => onSelectCategory && onSelectCategory("feature-projects")}
          className="lg:col-span-2 flex flex-col justify-between p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-gray-100/90 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-600 dark:text-sky-400">
              <span className="p-1 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                ⚡
              </span>
              <span>{tx("in_progress_dc9591e5")}</span>
            </div>
            <span className="text-[10px] text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity">
              {tx("view_12ab391b")}</span>
          </div>
          <div className="my-1">
            <span className="text-xl font-extrabold text-gray-900 dark:text-white">
              {inProgressProjectsCount}
            </span>
            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 ml-1">
              {tx("projects_5e7e8850")}</span>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500">
            {tx("active_work_e697b419")}</p>
        </div>

        {/* 卡片 3：📋 待处理任务 */}
        <div
          onClick={() => onSelectCategory && onSelectCategory("feature-calendar")}
          className="lg:col-span-2 flex flex-col justify-between p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-gray-100/90 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
              <span className="p-1 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                📋
              </span>
              <span>{tx("pending_999a459c")}</span>
            </div>
            <span className="text-[10px] text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">
              {tx("list_e18c4b3f")}</span>
          </div>
          <div className="my-1">
            <span className="text-xl font-extrabold text-gray-900 dark:text-white">
              {pendingTodosCount}
            </span>
            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 ml-1">
              {tx("tasks_8d1eaae6")}</span>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500">
            {tx("pending_actions_8d98dca6")}</p>
        </div>

        {/* 卡片 4：✅ 本周完成 */}
        <div
          onClick={() => onSelectCategory && onSelectCategory("feature-activities")}
          className="lg:col-span-2 flex flex-col justify-between p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-gray-100/90 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-600 dark:text-purple-400">
              <span className="p-1 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                ✅
              </span>
              <span>{tx("completed_this_week_940cc3d9")}</span>
            </div>
            <span className="text-[10px] text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity">
              {tx("history_64b72870")}</span>
          </div>
          <div className="my-1">
            <span className="text-xl font-extrabold text-gray-900 dark:text-white">
              {weeklyCompletedCount}
            </span>
            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 ml-1">
              {tx("items_49ccde43")}</span>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500">
            {tx("work_completed_413a7eb0")}</p>
        </div>

        {/* 卡片 5：⚡ 快速操作 (Quick Actions 4 cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-gray-100/90 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-500 mb-1.5">
            <span className="p-0.5 rounded bg-amber-50 dark:bg-amber-950/60">⚡</span>
            <span>{tx("quick_actions_2cf085b4")}</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setShowAddLinkModal(true)}
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 hover:border-[#00C776] hover:bg-[#00C776]/10 text-gray-700 dark:text-slate-200 text-[11px] font-semibold transition-all cursor-pointer truncate"
            >
              <span>📝</span>
              <span className="truncate">{tx("new_bookmark_56c28f8d")}</span>
            </button>



            <button
              onClick={() => setShowTaskModal(true)}
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 hover:border-[#00C776] hover:bg-[#00C776]/10 text-gray-700 dark:text-slate-200 text-[11px] font-semibold transition-all cursor-pointer truncate"
            >
              <span>☑️</span>
              <span className="truncate">{tx("create_task_d2ff17f4")}</span>
            </button>

            <button
              onClick={() => onSelectCategory && onSelectCategory("feature-projects")}
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 hover:border-[#00C776] hover:bg-[#00C776]/10 text-gray-700 dark:text-slate-200 text-[11px] font-semibold transition-all cursor-pointer truncate"
            >
              <span>📂</span>
              <span className="truncate">{tx("new_project_0e1a7040")}</span>
            </button>

            {onOpenAssistant && <button
              onClick={onOpenAssistant}
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 hover:border-[#00C776] hover:bg-[#00C776]/10 text-gray-700 dark:text-slate-200 text-[11px] font-semibold transition-all cursor-pointer truncate"
            >
              <span>🤖</span>
              <span className="truncate">{tx("ai_assistant_1b0049fc")}</span>
            </button>}
          </div>
        </div>
      </div>

      {/* Add Link Modal */}
      <AddLinkModal
        open={showAddLinkModal}
        categories={categories}
        onClose={() => setShowAddLinkModal(false)}
        onAdd={(data) => {
          addLink(data);
          setShowAddLinkModal(false);
        }}
      />

      {/* Create Task Modal */}
      {showTaskModal && (
        <Overlay>
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-4 shadow-xl border border-gray-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
              {tx("create_todo_78d5d585")}</h3>
            <form onSubmit={handleCreateTask} className="space-y-3">
              <input
                type="text"
                name="taskTitle"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder={tx("enter_a_task_title_76dbbf63")}
                className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-2 text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#00C776]"
              />
              {taskNotice && (
                <p className="text-[11px] text-[#00C776]">{taskNotice}</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  {tx("cancel_2cd0f3be")}</button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-[#00C776] text-white text-xs font-bold rounded-lg hover:bg-[#00B068]"
                >
                  {tx("create_cde2cd07")}</button>
              </div>
            </form>
          </div>
        </Overlay>
      )}

    </div>
  );
}
