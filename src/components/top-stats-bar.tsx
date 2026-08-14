"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { Category, Project, SiteLink, TodoItem } from "@/types";
import { useNavelixData } from "@/hooks/use-navelix-data";
import { useFocusTracker } from "@/hooks/use-focus-tracker";
import AddLinkModal from "./add-link-modal";

interface TopStatsBarProps {
  categories: Category[];
  links: SiteLink[];
  onSelectCategory?: (id: string) => void;
}

export default function TopStatsBar({
  categories,
  links,
  onSelectCategory,
}: TopStatsBarProps) {
  const { weeklyData } = useFocusTracker();
  const currentDayIdx = (new Date().getDay() + 6) % 7;
  const todayFocusHours = weeklyData[currentDayIdx] || 0;

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
  }, [fetchMetrics]);

  // Derived metrics
  const pendingTodosCount = useMemo(
    () => todos.filter((t) => !t.done).length,
    [todos]
  );

  const averageProjectProgress = useMemo(() => {
    if (!projects.length) return 75;
    const doneProjects = projects.filter(
      (p) => p.status === "已完成" || p.status === "维护中"
    ).length;
    return Math.round((doneProjects / projects.length) * 100) || 75;
  }, [projects]);

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
        body: JSON.stringify({ message: aiQuery }),
      });
      const data = await res.json();
      setAiResponse(data.reply || data.message || "AI 助手已接收您的请求");
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
          dueDate: new Date().toISOString().split("T")[0],
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
        {/* 卡片 1：今日专注 */}
        <div className="lg:col-span-2 flex flex-col justify-between p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-gray-100/90 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <span className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <polyline points="12 7 12 12 15 15" />
              </svg>
            </span>
            <span>今日专注</span>
          </div>
          <div className="my-1">
            <span className="text-xl font-extrabold text-gray-900 dark:text-white">
              {todayFocusHours}
            </span>
            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 ml-1">
              小时
            </span>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500">
            专注时间
          </p>
        </div>

        {/* 卡片 2：待办任务 */}
        <div className="lg:col-span-2 flex flex-col justify-between p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-gray-100/90 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-600 dark:text-sky-400">
            <span className="p-1 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3l8 -8" />
                <path d="M20 12v6a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h9" />
              </svg>
            </span>
            <span>待办任务</span>
          </div>
          <div className="my-1">
            <span className="text-xl font-extrabold text-gray-900 dark:text-white">
              {pendingTodosCount}
            </span>
            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 ml-1">
              项
            </span>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500">
            待完成
          </p>
        </div>

        {/* 卡片 3：知识笔记/书签 */}
        <div className="lg:col-span-2 flex flex-col justify-between p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-gray-100/90 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-600 dark:text-purple-400">
            <span className="p-1 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4z" />
              </svg>
            </span>
            <span>知识笔记</span>
          </div>
          <div className="my-1">
            <span className="text-xl font-extrabold text-gray-900 dark:text-white">
              {links.length}
            </span>
            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 ml-1">
              篇
            </span>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500">
            累计记录
          </p>
        </div>

        {/* 卡片 4：项目进度 */}
        <div className="lg:col-span-2 flex flex-col justify-between p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-gray-100/90 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
            <span className="p-1 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
                <path d="M12 8m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
                <path d="M17 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
              </svg>
            </span>
            <span>项目进度</span>
          </div>
          <div className="my-1">
            <span className="text-xl font-extrabold text-gray-900 dark:text-white">
              {averageProjectProgress}%
            </span>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500">
            平均进度
          </p>
        </div>

        {/* 卡片 5：快速操作 (Quick Actions 4 cols) */}
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
          <form
            onSubmit={handleSaveQuickNote}
            className="w-full max-w-md bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-xl flex flex-col gap-4 animate-scaleUp"
          >
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>💡</span>
              <span>记录快速想法随记</span>
            </h3>
            <textarea
              required
              rows={4}
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              placeholder="随时随地记录灵感与笔记想法..."
              className="w-full p-3 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00C776]/40 text-gray-800 dark:text-slate-100"
            />
            {noteNotice && (
              <p className="text-xs text-[#00C776] font-bold">{noteNotice}</p>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowQuickNoteModal(false)}
                className="px-3.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#00C776] text-white text-xs font-semibold rounded-xl hover:bg-[#009a5a]"
              >
                保存随记
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleCreateTask}
            className="w-full max-w-md bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-xl flex flex-col gap-4 animate-scaleUp"
          >
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>☑️</span>
              <span>新建待办任务</span>
            </h3>
            <input
              id="stats-task-title-input"
              name="taskTitle"
              type="text"
              required
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              aria-label="输入任务名称"
              placeholder="输入任务名称..."
              className="w-full p-3 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00C776]/40 text-gray-800 dark:text-slate-100"
            />
            {taskNotice && (
              <p className="text-xs text-[#00C776] font-bold">{taskNotice}</p>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTaskModal(false)}
                className="px-3.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#00C776] text-white text-xs font-semibold rounded-xl hover:bg-[#009a5a]"
              >
                创建任务
              </button>
            </div>
          </form>
        </div>
      )}

      {/* AI Assistant Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleAiAsk}
            className="w-full max-w-lg bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-xl flex flex-col gap-4 animate-scaleUp"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>🤖</span>
                <span>AI 智能助手</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-2">
              <input
                id="stats-ai-query-input"
                name="aiQuery"
                type="text"
                required
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                aria-label="询问 AI 任何关于导航、软件或代码的问题"
                placeholder="询问 AI 任何关于导航、软件或代码的问题..."
                className="flex-1 p-3 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00C776]/40 text-gray-800 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={aiLoading}
                className="px-4 py-2 bg-[#00C776] text-white text-xs font-semibold rounded-xl hover:bg-[#009a5a] disabled:opacity-50"
              >
                {aiLoading ? "思考中..." : "提问"}
              </button>
            </div>

            {aiResponse && (
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900 text-xs text-gray-800 dark:text-slate-200 max-h-48 overflow-y-auto border border-gray-100 dark:border-slate-800">
                {aiResponse}
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
