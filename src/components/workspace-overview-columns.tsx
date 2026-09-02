"use client";

import React, { useState, useEffect, useMemo } from "react";
import type { Category, SiteLink, TodoItem } from "@/types";
import { useNavelixData } from "@/hooks/use-navelix-data";
import { pushNotification } from "@/lib/notifications";
import { toLocalDateStr, addDaysLocal } from "@/lib/date-utils";

interface WorkspaceOverviewColumnsProps {
  categories: Category[];
  links: SiteLink[];
  onSelectCategory: (id: string) => void;
}

type AgendaTab = "today" | "upcoming" | "completed";

export default function WorkspaceOverviewColumns({
  links,
  onSelectCategory,
}: WorkspaceOverviewColumnsProps) {
  // 1. Projects & Todos — 从 NavelixProvider 统一读取
  const { projects, todos, refreshData, hydrated } = useNavelixData();
  const projectsLoading = !hydrated;
  const todosLoading = !hydrated;

  // 2. Quick-add states
  const [quickTodoTitle, setQuickTodoTitle] = useState("");
  const [quickTodoPriority, setQuickTodoPriority] = useState<
    "high" | "medium" | "low"
  >("medium");
  const [quickTodoAssigneeId, setQuickTodoAssigneeId] = useState("");
  const [members, setMembers] = useState<
    Array<{ id: string; username: string; displayName?: string }>
  >([]);

  // Tab State
  const [agendaTab, setAgendaTab] = useState<AgendaTab>("today");
  const [selectedDayFilter, setSelectedDayFilter] = useState<string | null>(null);

  // Load Members for task delegation
  useEffect(() => {
    fetch("/api/user/members")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.members)) setMembers(d.members);
      })
      .catch(() => {});
  }, []);

  const todayStr = useMemo(() => toLocalDateStr(), []);

  // Quick add todo right from the homepage schedule column
  const handleQuickAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTodoTitle.trim()) return;
    try {
      const assignee = members.find((m) => m.id === quickTodoAssigneeId);
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: quickTodoTitle.trim(),
          priority: quickTodoPriority,
          dueDate: selectedDayFilter || todayStr,
          assigneeId: assignee?.id || "",
          assigneeName: assignee ? assignee.displayName || assignee.username : "",
        }),
      });
      if (res.ok) {
        const addedTitle = quickTodoTitle.trim();
        setQuickTodoTitle("");
        setQuickTodoAssigneeId("");
        window.dispatchEvent(new CustomEvent("navelix-workspace-updated"));
        refreshData();
        pushNotification("📅 新增日程事项", addedTitle, "calendar");
      }
    } catch {
      // ignore
    }
  };

  // Toggle todo done
  const handleToggleTodo = async (id: string, done: boolean) => {
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
  };

  // Quick postpone +1 day
  const handlePostponeOneDay = async (item: TodoItem) => {
    const newDueDate = addDaysLocal(item.dueDate || todayStr, 1);

    try {
      await fetch(`/api/todos/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: newDueDate }),
      });
      window.dispatchEvent(new CustomEvent("navelix-workspace-updated"));
      refreshData();
      pushNotification("⏩ 日程已顺延1天", `${item.title} -> ${newDueDate}`, "calendar");
    } catch {
      // ignore
    }
  };

  // 动态时钟（每 30 秒刷新一次相对时间）
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTs(Date.now());
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // ── 日程概览：数据计算与过滤 ──
  const todayTodos = useMemo(() => {
    return todos.filter((t) => t.dueDate === todayStr || (!t.dueDate && !t.done));
  }, [todos, todayStr]);

  const todayCompletedCount = useMemo(
    () => todayTodos.filter((t) => t.done).length,
    [todayTodos],
  );

  const todayProgressPercent = useMemo(() => {
    if (todayTodos.length === 0) return 100;
    return Math.round((todayCompletedCount / todayTodos.length) * 100);
  }, [todayTodos, todayCompletedCount]);

  // 近 7 日微型日期条 (周一 ~ 周日)
  const currentWeekDays = useMemo(() => {
    const curr = new Date();
    const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(curr.getFullYear(), curr.getMonth(), diff);

    const days = [];
    const labels = ["一", "二", "三", "四", "五", "六", "日"];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const dStr = toLocalDateStr(d);
      const count = todos.filter((t) => t.dueDate === dStr && !t.done).length;
      days.push({
        dateStr: dStr,
        label: labels[i],
        dayNum: d.getDate(),
        isToday: dStr === todayStr,
        count,
      });
    }
    return days;
  }, [todos, todayStr]);

  // 根据当前选中的 Tab 过滤待办列表
  const displayedTodos = useMemo(() => {
    if (selectedDayFilter) {
      return todos.filter((t) => t.dueDate === selectedDayFilter);
    }
    if (agendaTab === "today") {
      return todayTodos;
    }
    if (agendaTab === "completed") {
      return todos.filter((t) => t.done);
    }
    // upcoming: 未来 7 天
    const nextWeekStr = addDaysLocal(todayStr, 7);
    return todos.filter(
      (t) => !t.done && t.dueDate && t.dueDate >= todayStr && t.dueDate <= nextWeekStr,
    );
  }, [todos, agendaTab, todayTodos, selectedDayFilter, todayStr]);

  const getProjectName = (pid?: string) => {
    if (!pid) return null;
    const p = projects.find((proj) => proj.id === pid);
    return p ? p.name : null;
  };

  // 选中的活跃项目（多项目时可切换查看，默认首个项目）
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const currentActiveProject = useMemo(() => {
    if (projects.length === 0) return null;
    if (activeProjectId) {
      const found = projects.find((p) => p.id === activeProjectId);
      if (found) return found;
    }
    return projects[0];
  }, [projects, activeProjectId]);

  // 项目全维度指标分析计算 (进度、任务、风险、最近更新时间、相关任务、相关笔记)
  const activeProjectAnalysis = useMemo(() => {
    if (!currentActiveProject) return null;
    const p = currentActiveProject;
    const pTodos = todos.filter((t) => t.projectId === p.id);
    const done = pTodos.filter((t) => t.done).length;
    const total = pTodos.length;
    const progress = total > 0 ? Math.round((done / total) * 100) : p.status === "已完成" ? 100 : 0;

    // 风险评估
    const overdueList = pTodos.filter((t) => !t.done && t.dueDate && t.dueDate < todayStr);
    const highPriorityNear = pTodos.filter(
      (t) => !t.done && t.priority === "high" && t.dueDate && t.dueDate <= addDaysLocal(todayStr, 3),
    );

    let risk: { dot: string; label: string; badge: string };
    if (overdueList.length > 0) {
      risk = {
        dot: "🔴",
        label: `${overdueList.length}项逾期`,
        badge: "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60",
      };
    } else if (highPriorityNear.length > 0) {
      risk = {
        dot: "🟡",
        label: "近期攻坚",
        badge: "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60",
      };
    } else {
      risk = {
        dot: "🟢",
        label: "风险可控",
        badge: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60",
      };
    }

    // 多用户实时最近更新时间
    const timestamps = [
      p.updatedAt || 0,
      p.createdAt || 0,
      ...pTodos.map((t) => t.createdAt || 0),
    ];
    const latestTs = Math.max(...timestamps);
    
    // 计算相对时间
    let lastUpdatedStr = "刚刚";
    if (latestTs > 0 && nowTs > 0) {
      const diffSec = Math.max(0, Math.floor((nowTs - latestTs) / 1000));
      if (diffSec >= 86400) {
        lastUpdatedStr = `${Math.floor(diffSec / 86400)}d前`;
      } else if (diffSec >= 3600) {
        lastUpdatedStr = `${Math.floor(diffSec / 3600)}h前`;
      } else if (diffSec >= 60) {
        lastUpdatedStr = `${Math.floor(diffSec / 60)}m前`;
      }
    }

    // 关联笔记 / 文档 / 知识资产
    const relatedLinks = links.filter((l) => {
      const pName = p.name.toLowerCase();
      const pDesc = (p.description || "").toLowerCase();
      const lTitle = l.title.toLowerCase();
      const lDesc = (l.description || "").toLowerCase();
      return (
        lTitle.includes(pName) ||
        lDesc.includes(pName) ||
        (pDesc && (lTitle.includes(pDesc) || lDesc.includes(pDesc)))
      );
    });

    // 活跃近期任务 (未完成优先，取前 3 项)
    const activeTasks = [...pTodos]
      .sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1))
      .slice(0, 3);

    return {
      project: p,
      progress,
      done,
      total,
      risk,
      lastUpdatedStr,
      relatedLinks,
      activeTasks,
    };
  }, [currentActiveProject, todos, links, todayStr, nowTs]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 my-0">
      {/* ── 栏目 1：升级版项目概览与全维度指标中心 (Project Intelligence Hub) ── */}
      <div className="flex flex-col justify-between bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-colors space-y-3.5">
        {/* 顶部标题与多项目切换 Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-gray-100 dark:border-slate-700/60">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base">🗂️</span>
            <h3 className="text-sm font-black text-gray-900 dark:text-white">
              项目概览
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[#00C776] text-[10px] font-bold">
              {projects.length} 个项目
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* 多项目轻量切换器 */}
            {projects.length > 1 && (
              <select
                name="active-project"
                value={currentActiveProject?.id || ""}
                onChange={(e) => setActiveProjectId(e.target.value)}
                className="px-2 py-0.5 text-xs font-bold bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-800 dark:text-slate-200 cursor-pointer max-w-[130px] truncate"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => onSelectCategory("feature-projects")}
              className="text-xs font-bold text-[#00C776] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>全部项目</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* 核心内容渲染 */}
        <div className="flex-1 flex flex-col justify-between space-y-3">
          {projectsLoading ? (
            <div className="py-12 text-center text-xs text-gray-400">
              加载项目实时数据中...
            </div>
          ) : projects.length === 0 ? (
            <div className="py-10 text-center text-xs text-gray-400">
              暂无进行中的项目，可在项目管理中心新建或由 AI 拆解
            </div>
          ) : activeProjectAnalysis ? (
            <div className="space-y-3">
              {/* 1. 项目基本信息条 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        activeProjectAnalysis.project.color ||
                        activeProjectAnalysis.project.statusColor ||
                        "#00C776",
                    }}
                  />
                  <h4 className="text-sm font-black text-gray-900 dark:text-white truncate">
                    {activeProjectAnalysis.project.name}
                  </h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                    {activeProjectAnalysis.project.status}
                  </span>
                </div>

                {activeProjectAnalysis.project.url && (
                  <a
                    href={activeProjectAnalysis.project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-[#00C776] hover:underline flex items-center gap-1 truncate max-w-[120px]"
                    title="打开项目入口"
                  >
                    <span>入口</span>
                    <span>↗</span>
                  </a>
                )}
              </div>

              {/* 2. 四维实时指标指示卡 (进度 🟢、任务 🟢、风险 🟡、最近更新 ⏱️) */}
              <div className="grid grid-cols-4 gap-2">
                {/* 进度 */}
                <div className="p-2 rounded-xl bg-gray-50/90 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] text-gray-400 font-bold mb-0.5">
                    进度
                  </span>
                  <span className="text-xs font-black text-[#00C776] flex items-center gap-1">
                    <span>🟢</span>
                    <span>{activeProjectAnalysis.progress}%</span>
                  </span>
                </div>

                {/* 任务 */}
                <div className="p-2 rounded-xl bg-gray-50/90 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] text-gray-400 font-bold mb-0.5">
                    任务
                  </span>
                  <span className="text-xs font-black text-gray-800 dark:text-slate-100 flex items-center gap-1">
                    <span>🟢</span>
                    <span>
                      {activeProjectAnalysis.done}/{activeProjectAnalysis.total}
                    </span>
                  </span>
                </div>

                {/* 风险 */}
                <div className="p-2 rounded-xl bg-gray-50/90 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] text-gray-400 font-bold mb-0.5">
                    风险
                  </span>
                  <span className="text-[11px] font-black flex items-center gap-0.5 truncate">
                    <span>{activeProjectAnalysis.risk.dot}</span>
                    <span className="truncate">{activeProjectAnalysis.risk.label}</span>
                  </span>
                </div>

                {/* 最近更新 (多用户实时) */}
                <div className="p-2 rounded-xl bg-gray-50/90 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] text-gray-400 font-bold mb-0.5">
                    最近更新
                  </span>
                  <span className="text-xs font-black text-gray-700 dark:text-slate-200">
                    {activeProjectAnalysis.lastUpdatedStr}
                  </span>
                </div>
              </div>

              {/* 3. 相关任务阶段概览 (Related Tasks) */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-slate-400">
                  <span>📌 关联阶段任务</span>
                  <span className="text-[10px]">
                    共 {activeProjectAnalysis.total} 项
                  </span>
                </div>

                {activeProjectAnalysis.activeTasks.length === 0 ? (
                  <p className="text-[11px] text-gray-400 py-1">
                    暂无关联任务，可前往项目中心点击「✨ AI 拆解」规划
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-28 overflow-y-auto pr-0.5">
                    {activeProjectAnalysis.activeTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-gray-50/70 dark:bg-slate-900/50 border border-gray-100/80 dark:border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={task.done}
                            onChange={() => handleToggleTodo(task.id, task.done)}
                            className="w-3.5 h-3.5 rounded text-[#00C776] focus:ring-[#00C776] cursor-pointer"
                          />
                          <span
                            className={`truncate font-medium ${
                              task.done
                                ? "line-through text-gray-400 dark:text-slate-500"
                                : "text-gray-800 dark:text-slate-200"
                            }`}
                          >
                            {task.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                          {task.assigneeName && (
                            <span className="px-1.5 py-0.2 rounded bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 font-bold truncate max-w-[60px]">
                              👤 {task.assigneeName}
                            </span>
                          )}
                          {task.dueDate && (
                            <span className="text-gray-400 font-bold">
                              {task.dueDate.slice(5)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. 相关笔记与数字资产 (Related Notes & Assets) */}
              <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-gray-400 font-bold text-[11px] shrink-0">
                    📝 相关资产/笔记:
                  </span>
                  {activeProjectAnalysis.relatedLinks.length === 0 &&
                  !activeProjectAnalysis.project.url ? (
                    <span className="text-[11px] text-gray-400">
                      可在导航库中添加带有该项目名的笔记/链接
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                      {activeProjectAnalysis.project.url && (
                        <a
                          href={activeProjectAnalysis.project.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-[#00C776] text-[10px] font-bold hover:underline shrink-0 flex items-center gap-1"
                        >
                          <span>🔗 官方入口</span>
                        </a>
                      )}
                      {activeProjectAnalysis.relatedLinks.slice(0, 2).map((l) => (
                        <a
                          key={l.id}
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 text-[10px] font-bold hover:text-[#00C776] shrink-0 flex items-center gap-1"
                          title={l.description || l.title}
                        >
                          <span>📄</span>
                          <span className="truncate max-w-[80px]">{l.title}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onSelectCategory("feature-projects")}
                  className="text-[11px] font-bold text-[#00C776] hover:underline shrink-0 cursor-pointer"
                >
                  去管理 ↗
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── 栏目 2：升级版日程概览 (Smart Schedule & Agenda Action Hub) ── */}
      <div className="flex flex-col justify-between bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-colors space-y-3">
        {/* Header & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-100 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <span className="text-base">📅</span>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              日程概览
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[#00C776] text-[10px] font-bold">
              {todayCompletedCount}/{todayTodos.length} 闭环 · {todayProgressPercent}%
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* View Tabs */}
            <div className="flex items-center p-0.5 bg-gray-100 dark:bg-slate-900 rounded-lg text-[11px] font-bold">
              <button
                type="button"
                onClick={() => {
                  setAgendaTab("today");
                  setSelectedDayFilter(null);
                }}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  agendaTab === "today" && !selectedDayFilter
                    ? "bg-white dark:bg-slate-800 text-[#00C776] shadow-2xs"
                    : "text-gray-500 hover:text-gray-800 dark:text-slate-400"
                }`}
              >
                今日聚焦
              </button>
              <button
                type="button"
                onClick={() => {
                  setAgendaTab("upcoming");
                  setSelectedDayFilter(null);
                }}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  agendaTab === "upcoming" && !selectedDayFilter
                    ? "bg-white dark:bg-slate-800 text-[#00C776] shadow-2xs"
                    : "text-gray-500 hover:text-gray-800 dark:text-slate-400"
                }`}
              >
                近7日
              </button>
              <button
                type="button"
                onClick={() => {
                  setAgendaTab("completed");
                  setSelectedDayFilter(null);
                }}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  agendaTab === "completed" && !selectedDayFilter
                    ? "bg-white dark:bg-slate-800 text-[#00C776] shadow-2xs"
                    : "text-gray-500 hover:text-gray-800 dark:text-slate-400"
                }`}
              >
                已完成
              </button>
            </div>

            <button
              onClick={() => onSelectCategory("feature-calendar")}
              className="text-xs font-semibold text-[#00C776] hover:underline flex items-center gap-0.5 ml-1 cursor-pointer shrink-0"
              title="进入完整日历中枢"
            >
              <span>日历</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* 7 日迷你快捷日期条 (周一 ~ 周日) */}
        <div className="grid grid-cols-7 gap-1 py-1 px-1 bg-gray-50/70 dark:bg-slate-900/60 rounded-xl border border-gray-100/80 dark:border-slate-800 text-center">
          {currentWeekDays.map((d) => {
            const isSelected = selectedDayFilter === d.dateStr;
            return (
              <button
                key={d.dateStr}
                type="button"
                onClick={() => {
                  if (selectedDayFilter === d.dateStr) {
                    setSelectedDayFilter(null);
                  } else {
                    setSelectedDayFilter(d.dateStr);
                  }
                }}
                className={`py-1 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#00C776] text-white shadow-2xs font-bold"
                    : d.isToday
                    ? "bg-[#00C776]/15 text-[#00C776] font-bold"
                    : "hover:bg-gray-200/50 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-400"
                }`}
              >
                <span className="text-[9px]">{d.label}</span>
                <span className="text-[11px] font-black">{d.dayNum}</span>
                {d.count > 0 && (
                  <span
                    className={`w-1 h-1 rounded-full mt-0.5 ${
                      isSelected ? "bg-white" : "bg-emerald-500"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Todos List with Priority & Quick Actions */}
        <div className="flex flex-col gap-2 flex-1 min-h-[140px] max-h-[190px] overflow-y-auto pr-1">
          {todosLoading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
              加载日程待办中...
            </div>
          ) : displayedTodos.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-6 text-xs text-gray-400 gap-1 text-center">
              <span>☕</span>
              <span>
                {selectedDayFilter
                  ? "该日期暂无安排任务"
                  : agendaTab === "completed"
                  ? "暂无已完成的待办事项"
                  : "当前无待办任务，可在下方快速创建！"}
              </span>
            </div>
          ) : (
            displayedTodos.map((item) => {
              const projectName = getProjectName(item.projectId);
              const isOverdue =
                !item.done && item.dueDate && item.dueDate < todayStr;

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/80 dark:bg-slate-900/60 border border-gray-100/80 dark:border-slate-800 hover:border-gray-200 transition-all group text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      id={`overview-todo-check-${item.id}`}
                      name={`todo-done-${item.id}`}
                      type="checkbox"
                      checked={item.done}
                      onChange={() => handleToggleTodo(item.id, item.done)}
                      aria-label={`标记待办事项 ${item.title}`}
                      className="w-3.5 h-3.5 rounded text-[#00C776] focus:ring-[#00C776] border-gray-300 dark:border-slate-600 cursor-pointer shrink-0"
                    />

                    <span
                      className={`truncate font-medium ${
                        item.done
                          ? "line-through text-gray-400 dark:text-slate-500"
                          : "text-gray-800 dark:text-slate-200"
                      }`}
                    >
                      {item.title}
                    </span>

                    {/* 项目与责任人/委托标签 */}
                    {projectName && (
                      <span className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 shrink-0 truncate max-w-[80px]">
                        {projectName}
                      </span>
                    )}
                    {item.isDelegated ? (
                      <span
                        title={`此任务由 @${item.ownerName || "成员"} 指派给您`}
                        className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0 truncate max-w-[90px]"
                      >
                        📥 来自 @{item.ownerName || "成员"}
                      </span>
                    ) : item.assigneeName ? (
                      <span
                        title={`此任务已委托给 @${item.assigneeName}`}
                        className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 shrink-0 truncate max-w-[90px]"
                      >
                        📤 @{item.assigneeName}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* 状态 / 优先级胶囊 */}
                    {isOverdue ? (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                        ⚠️ 逾期
                      </span>
                    ) : item.priority === "high" ? (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                        高优
                      </span>
                    ) : item.priority === "low" ? (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold text-gray-400">
                        普通
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold text-amber-500">
                        中优
                      </span>
                    )}

                    {item.dueDate && (
                      <span className="text-[10px] text-gray-400">
                        {item.dueDate.slice(5)}
                      </span>
                    )}

                    {/* 悬浮快速顺延 +1 天 */}
                    {!item.done && (
                      <button
                        type="button"
                        onClick={() => handlePostponeOneDay(item)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[10px] text-gray-400 hover:text-[#00C776] transition-opacity cursor-pointer"
                        title="顺延至明天"
                      >
                        +1天
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Quick Add Form */}
        <form onSubmit={handleQuickAddTodo} className="flex gap-2 pt-1">
          <input
            id="overview-quick-todo-input"
            name="quickTodoTitle"
            type="text"
            value={quickTodoTitle}
            onChange={(e) => setQuickTodoTitle(e.target.value)}
            aria-label="快捷添加日程事项"
            placeholder={
              selectedDayFilter
                ? `为 ${selectedDayFilter.slice(5)} 快捷添加日程...`
                : "快捷添加今日日程事项..."
            }
            className="flex-1 px-3 py-1.5 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00C776]/40 text-gray-800 dark:text-slate-100"
          />
          {members.length > 1 && (
            <select
              name="quickTodoAssignee"
              value={quickTodoAssigneeId}
              onChange={(e) => setQuickTodoAssigneeId(e.target.value)}
              className="px-2 py-1 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl font-medium cursor-pointer max-w-[85px] truncate"
              title="指派给团队成员"
            >
              <option value="">👤 自己</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  @{m.displayName || m.username}
                </option>
              ))}
            </select>
          )}
          <select
            name="quickTodoPriority"
            value={quickTodoPriority}
            onChange={(e) =>
              setQuickTodoPriority(e.target.value as "high" | "medium" | "low")
            }
            className="px-2 py-1 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl font-bold cursor-pointer"
          >
            <option value="high">高优</option>
            <option value="medium">中优</option>
            <option value="low">普通</option>
          </select>
          <button
            type="submit"
            className="px-3.5 py-1.5 bg-[#00C776] text-white text-xs font-bold rounded-xl hover:bg-[#00B068] transition-colors cursor-pointer shrink-0"
          >
            添加
          </button>
        </form>
      </div>
    </div>
  );
}
