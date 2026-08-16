"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { Category, Project, SiteLink, TodoItem } from "@/types";
import { useNavelixData } from "@/hooks/use-navelix-data";
import { useFocusTracker } from "@/hooks/use-focus-tracker";
import { toLocalDateStr } from "@/lib/date-utils";
import AddLinkModal from "./add-link-modal";

interface TopStatsBarProps {
  categories: Category[];
  links: SiteLink[];
  onSelectCategory?: (id: string) => void;
}

export default function TopStatsBar({
  categories,
  onSelectCategory,
}: TopStatsBarProps) {
  const { weeklyData } = useFocusTracker();
  const currentDayIdx = (new Date().getDay() + 6) % 7;
  const todayFocusHours = weeklyData[currentDayIdx] || 0;
  const yesterdayFocusHours = weeklyData[(currentDayIdx + 6) % 7] || 0;

  const focusTrend = useMemo(() => {
    if (yesterdayFocusHours === 0) return todayFocusHours > 0 ? "↑ 良好" : "— 待开始";
    const diff = ((todayFocusHours - yesterdayFocusHours) / yesterdayFocusHours) * 100;
    if (diff > 0) return `↑ ${Math.round(diff)}%`;
    if (diff < 0) return `↓ ${Math.abs(Math.round(diff))}%`;
    return "= 持平";
  }, [todayFocusHours, yesterdayFocusHours]);

  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showAddLinkModal, setShowAddLinkModal] = useState(false);

  // Quick Action Modal States
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const [showQuickNoteModal, setShowQuickNoteModal] = useState(false);
  const [quickNote, setQuickNote] = useState("");
  const [noteNotice, setNoteNotice] = useState("");

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskNotice, setTaskNotice] = useState("");

  // Load Todos & Projects
  const fetchMetrics = useCallback(async () => {
    try {
      const [tRes, pRes] = await Promise.all([
        fetch("/api/todos"),
        fetch("/api/projects"),
      ]);
      if (tRes.ok) {
        const tData = await tRes.json();
        if (Array.isArray(tData.todos)) setTodos(tData.todos);
      }
      if (pRes.ok) {
        const pData = await pRes.json();
        if (Array.isArray(pData.projects)) setProjects(pData.projects);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchMetrics();
    });
    const handleUpdate = () => fetchMetrics();
    window.addEventListener("navelix-workspace-updated", handleUpdate);
    window.addEventListener("focus", handleUpdate);
    return () => {
      window.removeEventListener("navelix-workspace-updated", handleUpdate);
      window.removeEventListener("focus", handleUpdate);
    };
  }, [fetchMetrics]);

  // Derived metrics for Actionable Cockpit
  // 1. 进行中项目数
  const inProgressProjectsCount = useMemo(() => {
    const inProg = projects.filter(
      (p) =>
        (p.status || "").includes("进行") ||
        (p.status || "").includes("开发") ||
        (p.status || "").includes("研究") ||
        (p.status || "").toLowerCase().includes("progress"),
    ).length;
    return inProg || (projects.length > 0 ? 1 : 0);
  }, [projects]);

  // 2. 待处理任务数
  const pendingTodosCount = useMemo(
    () => todos.filter((t) => !t.done).length,
    [todos],
  );

  // 3. 本周已完成数 (已完成待办 + 已完成项目)
  const weeklyCompletedCount = useMemo(() => {
    const completedTodos = todos.filter((t) => t.done).length;
    const completedProjects = projects.filter(
      (p) => p.status === "已完成" || (p.status || "").includes("完成"),
    ).length;
    return completedTodos + completedProjects;
  }, [todos, projects]);

  // Quick Action Handlers
  const handleAiAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiResponse("");
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiQuery }),
      });
      const data = await res.json();
      setAiResponse(data.text || data.reply || "AI 助手已接收您的请求");
    } catch {
      setAiResponse("请求 AI 助手失败，请检查网络设置。");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveQuickNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNote.trim()) return;
    try {
      const existing = localStorage.getItem("navelix.quick.notes") || "[]";
      const list = JSON.parse(existing);
      list.push({ text: quickNote, time: Date.now() });
      localStorage.setItem("navelix.quick.notes", JSON.stringify(list));
      setNoteNotice("随记保存成功！");
      setQuickNote("");
      setTimeout(() => {
        setNoteNotice("");
        setShowQuickNoteModal(false);
      }, 1200);
    } catch {
      setNoteNotice("保存失败");
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle.trim(),
          priority: "medium",
          dueDate: toLocalDateStr(),
        }),
      });
      if (res.ok) {
        setTaskNotice("待办创建成功！");
        setTaskTitle("");
        fetchMetrics();
        setTimeout(() => {
          setTaskNotice("");
          setShowTaskModal(false);
        }, 1200);
      }
    } catch {
      setTaskNotice("创建失败");
    }
  };

  const { addLink } = useNavelixData();

  return (
    <div className="flex flex-col gap-2 mb-0">
      {/* 5 Column Grid Top Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-3">
        {/* 卡片 1：🎯 今日专注 */}
        <div className="lg:col-span-2 flex flex-col justify-between p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-gray-100/90 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <span className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                🎯
              </span>
              <span>今日专注</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">
              {focusTrend}
            </span>
          </div>
          <div className="my-1">
            <span className="text-xl font-extrabold text-gray-900 dark:text-white">
              {todayFocusHours}
            </span>
            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 ml-1">
              h
            </span>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500">
            专注时长
          </p>
        </div>

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
              <span>进行中</span>
            </div>
            <span className="text-[10px] text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity">
              查看 →
            </span>
          </div>
          <div className="my-1">
            <span className="text-xl font-extrabold text-gray-900 dark:text-white">
              {inProgressProjectsCount}
            </span>
            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 ml-1">
              个项目
            </span>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500">
            当前核心研发
          </p>
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
              <span>待处理</span>
            </div>
            <span className="text-[10px] text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">
              清单 →
            </span>
          </div>
          <div className="my-1">
            <span className="text-xl font-extrabold text-gray-900 dark:text-white">
              {pendingTodosCount}
            </span>
            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 ml-1">
              项任务
            </span>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500">
            待执行事项
          </p>
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
              <span>本周完成</span>
            </div>
            <span className="text-[10px] text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity">
              记录 →
            </span>
          </div>
          <div className="my-1">
            <span className="text-xl font-extrabold text-gray-900 dark:text-white">
              {weeklyCompletedCount}
            </span>
            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 ml-1">
              项
            </span>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500">
            工作闭环
          </p>
        </div>

        {/* 卡片 5：⚡ 快速操作 (Quick Actions 4 cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-gray-100/90 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-500 mb-1.5">
            <span className="p-0.5 rounded bg-amber-50 dark:bg-amber-950/60">⚡</span>
            <span>快速操作</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => setShowAddLinkModal(true)}
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 hover:border-[#00C776] hover:bg-[#00C776]/10 text-gray-700 dark:text-slate-200 text-[11px] font-semibold transition-all cursor-pointer truncate"
            >
              <span>📝</span>
              <span className="truncate">新建书签</span>
            </button>

            <button
              onClick={() => setShowQuickNoteModal(true)}
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 hover:border-[#00C776] hover:bg-[#00C776]/10 text-gray-700 dark:text-slate-200 text-[11px] font-semibold transition-all cursor-pointer truncate"
            >
              <span>💡</span>
              <span className="truncate">记录想法</span>
            </button>

            <button
              onClick={() => setShowAddLinkModal(true)}
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 hover:border-[#00C776] hover:bg-[#00C776]/10 text-gray-700 dark:text-slate-200 text-[11px] font-semibold transition-all cursor-pointer truncate"
            >
              <span>📤</span>
              <span className="truncate">上传文件</span>
            </button>

            <button
              onClick={() => setShowTaskModal(true)}
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 hover:border-[#00C776] hover:bg-[#00C776]/10 text-gray-700 dark:text-slate-200 text-[11px] font-semibold transition-all cursor-pointer truncate"
            >
              <span>☑️</span>
              <span className="truncate">创建任务</span>
            </button>

            <button
              onClick={() => onSelectCategory && onSelectCategory("feature-projects")}
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 hover:border-[#00C776] hover:bg-[#00C776]/10 text-gray-700 dark:text-slate-200 text-[11px] font-semibold transition-all cursor-pointer truncate"
            >
              <span>📂</span>
              <span className="truncate">新建项目</span>
            </button>

            <button
              onClick={() => setShowAiModal(true)}
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 hover:border-[#00C776] hover:bg-[#00C776]/10 text-gray-700 dark:text-slate-200 text-[11px] font-semibold transition-all cursor-pointer truncate"
            >
              <span>🤖</span>
              <span className="truncate">AI 助手</span>
            </button>
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

      {/* Quick Note Modal */}
      {showQuickNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-4 shadow-xl border border-gray-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
              💡 记录想法 / 随记
            </h3>
            <form onSubmit={handleSaveQuickNote} className="space-y-3">
              <textarea
                name="quickNote"
                value={quickNote}
                onChange={(e) => setQuickNote(e.target.value)}
                placeholder="在此快速记录随想、灵感或临时备忘..."
                rows={3}
                className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-2 text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#00C776]"
              />
              {noteNotice && (
                <p className="text-[11px] text-[#00C776]">{noteNotice}</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickNoteModal(false)}
                  className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-[#00C776] text-white text-xs font-bold rounded-lg hover:bg-[#00B068]"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-4 shadow-xl border border-gray-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
              ☑️ 创建待办任务
            </h3>
            <form onSubmit={handleCreateTask} className="space-y-3">
              <input
                type="text"
                name="taskTitle"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="输入待办事项标题..."
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
                  取消
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-[#00C776] text-white text-xs font-bold rounded-lg hover:bg-[#00B068]"
                >
                  创建
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Ask Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-4 shadow-xl border border-gray-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
              🤖 快速咨询 AI Copilot
            </h3>
            <form onSubmit={handleAiAsk} className="space-y-3">
              <input
                type="text"
                name="aiQuery"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="输入你想咨询或分析的内容..."
                className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-2 text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#00C776]"
              />
              {aiLoading && (
                <p className="text-[11px] text-gray-400">AI 正在思考中...</p>
              )}
              {aiResponse && (
                <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 text-xs text-gray-800 dark:text-slate-200 max-h-40 overflow-y-auto leading-relaxed border border-gray-100 dark:border-slate-700">
                  {aiResponse}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  关闭
                </button>
                <button
                  type="submit"
                  disabled={aiLoading}
                  className="px-3 py-1 bg-[#00C776] text-white text-xs font-bold rounded-lg hover:bg-[#00B068] disabled:opacity-50"
                >
                  发送
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
