"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { TodoItem, WorkspaceMember } from "@/types";
import { useNavelixData } from "@/context/navelix-context";
import { pushNotification } from "@/lib/client/notifications";
import { toLocalDateStr } from "@/lib/date-utils";
import { trackClientEvent } from "@/lib/client/analytics";
import IcalExportModal from "./ical-export-modal";
import AiScheduleModal from "./ai-schedule-modal";
import ScheduleEditModal from "./schedule-edit-modal";
import { useAiSchedule } from "@/hooks/use-ai-schedule";

type CalendarViewMode = "month" | "week" | "today";

export default function CalendarView() {
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  // 可选遥测：打开日历视图
  useEffect(() => {
    trackClientEvent("calendar.view", { mode: viewMode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
      try {
        const savedMode = localStorage.getItem("navelix_calendar_view_mode");
        if (savedMode === "month" || savedMode === "week" || savedMode === "today") {
          queueMicrotask(() => setViewMode(savedMode));
        }
      } catch {
        // ignore
      }
    }, []);

  const handleViewModeChange = (mode: CalendarViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem("navelix_calendar_view_mode", mode);
    } catch {}
  };

  const { todos, projects, refreshData, hydrated } = useNavelixData();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);

  // Quick add form state
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");
  const [newProjectId, setNewProjectId] = useState("");

  // Edit modal state —— 表单字段由 ScheduleEditModal 自持，此处只保留"编辑哪一条"
  const [editingSchedule, setEditingSchedule] = useState<TodoItem | null>(null);

  // iCal Export Modal State
  const [showIcalModal, setShowIcalModal] = useState(false);

  // AI 排程：状态与操作全部由 hook 持有（原先散落在本组件里的 6 个 state + 6 个 handler）
  const ai = useAiSchedule();

  // Rollover state
  const [rollingOver, setRollingOver] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      const mRes = await fetch("/api/user/members");
      if (mRes.ok) {
        const mData = await mRes.json();
        if (Array.isArray(mData.members)) setMembers(mData.members);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchMembers();
    });
  }, [fetchMembers]);

  const todayStr = useMemo(() => toLocalDateStr(new Date()), []);
  const selectedDateStr = toLocalDateStr(selectedDate);

  // 1. 过期遗留任务计算
  const overdueTodos = useMemo(() => {
    return todos.filter(
      (t) => !t.done && t.dueDate && t.dueDate < todayStr && /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate),
    );
  }, [todos, todayStr]);

  // 2. 智能顺延操作 (Smart Rollover)
  const handleRollover = async (action: "today" | "week") => {
    setRollingOver(true);
    try {
      const res = await fetch("/api/todos/rollover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, today: todayStr }),
      });
      const data = await res.json();
      if (data.success) {
        window.dispatchEvent(new CustomEvent("navelix-workspace-updated"));
        pushNotification(
          "⏩ 智能日程顺延完成",
          data.message || `已成功处理 ${data.count} 项待办任务！`,
          "calendar",
        );
        refreshData();
      }
    } catch {
      // ignore
    } finally {
      setRollingOver(false);
    }
  };

  // 3. 日历计算 (Calendar Math)
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  // 调整为周一为起始 (0=周日 -> 6， 1=周一 -> 0)
  const startDayOffset = (firstDayOfMonth + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  const todayMonth = () => {
    const n = new Date();
    setCurrentDate(n);
    setSelectedDate(n);
  };

  // 4. 周视图时间计算 (Weekly Kanban Math)
  const currentWeekDays = useMemo(() => {
    const curr = new Date(selectedDate);
    const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(curr.setDate(diff));

    const weekDays: Array<{ date: Date; dateStr: string; label: string }> = [];
    const labels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDays.push({
        date: d,
        dateStr: toLocalDateStr(d),
        label: labels[i],
      });
    }
    return weekDays;
  }, [selectedDate]);

  const prevWeek = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 7);
    setSelectedDate(d);
    setCurrentDate(d);
  };

  const nextWeek = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 7);
    setSelectedDate(d);
    setCurrentDate(d);
  };

  // 5. 待办操作处理 (Todo handlers)
  const handleAddTodo = async (e: React.FormEvent, customDateStr?: string) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          priority: newPriority,
          dueDate: customDateStr || selectedDateStr,
          projectId: newProjectId,
        }),
      });
      if (res.ok) {
        setNewTitle("");
        setNewProjectId("");
        window.dispatchEvent(new CustomEvent("navelix-workspace-updated"));
        refreshData();
        pushNotification("📅 日程新建成功", newTitle.trim(), "calendar");
      }
    } catch {
      // ignore
    }
  };

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

  const handleOpenEditModal = (item: TodoItem) => {
    setEditingSchedule(item);
  };

  /** 弹窗内保存/删除成功后统一收口：刷新数据并广播工作区更新 */
  const handleScheduleModalSaved = () => {
    window.dispatchEvent(new CustomEvent("navelix-workspace-updated"));
    refreshData();
  };

  // 6. 精力时段分块 (Energy Blocks) 计算
  const selectedDateTodos = useMemo(() => {
    return todos.filter((t) => t.dueDate === selectedDateStr);
  }, [todos, selectedDateStr]);

  const energyBuckets = useMemo(() => {
    const morning = selectedDateTodos.filter((t) => t.priority === "high");
    const afternoon = selectedDateTodos.filter((t) => t.priority === "medium");
    const evening = selectedDateTodos.filter((t) => t.priority === "low" || !t.priority);
    return {
      morning,
      afternoon,
      evening,
    };
  }, [selectedDateTodos]);

  // 负载热力计算 helper
  const getWorkloadStatus = (count: number) => {
    if (count === 0) return { label: "空闲", badge: "bg-gray-100 dark:bg-slate-800 text-gray-400", dot: "bg-gray-300 dark:bg-slate-600" };
    if (count <= 3) return { label: "适中", badge: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400", dot: "bg-emerald-500" };
    if (count <= 6) return { label: "饱满", badge: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400", dot: "bg-amber-500" };
    return { label: "超载", badge: "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 font-bold animate-pulse", dot: "bg-rose-500" };
  };

  return (
    <div className="flex flex-col gap-5 animate-fadeIn pb-12">
      {/* ── 1. Header & View Switcher ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs">
        <div>
          <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
            <span>📅</span>
            <span>日历日程与精力调度中心</span>
            <span className="px-2 py-0.5 rounded-full bg-[#00C776]/10 text-[#00C776] text-[10px] font-bold border border-[#00C776]/20">
              智能排期
            </span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            多维视角掌控时间流、负载热力感知、智能顺延与精力时段分块
          </p>
        </div>

        {/* 视图切换按钮组 + 操作 */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 模式切换 */}
          <div className="flex items-center p-1 rounded-xl bg-gray-100 dark:bg-slate-800 border border-gray-200/80 dark:border-slate-700">
            <button
              type="button"
              onClick={() => handleViewModeChange("month")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === "month"
                  ? "bg-white dark:bg-slate-900 text-[#00C776] shadow-2xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              📅 月视图
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange("week")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === "week"
                  ? "bg-white dark:bg-slate-900 text-[#00C776] shadow-2xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              🗓️ 周看板
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedDate(new Date());
                handleViewModeChange("today");
              }}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === "today"
                  ? "bg-white dark:bg-slate-900 text-[#00C776] shadow-2xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              ⚡ 今日流
            </button>
          </div>

          <button
            type="button"
            onClick={() => ai.generate(selectedDateStr)}
            className="px-3 py-1.5 bg-gradient-to-r from-[#00C776] to-teal-500 text-white rounded-xl text-xs font-bold hover:from-[#00B068] hover:to-teal-600 shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>✨</span>
            <span>AI 智能排程</span>
          </button>

          <button
            type="button"
            onClick={() => setShowIcalModal(true)}
            className="px-3 py-1.5 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-gray-200/80 dark:border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
            title="订阅或导出至手机/Apple/Google日历"
          >
            <span>📲</span>
            <span>iCal 订阅</span>
          </button>
        </div>
      </div>

      {/* ── 2. Smart Rollover Banner (过期待办智能顺延) ── */}
      {overdueTodos.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/80 dark:border-amber-700/60 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="text-xs font-black text-amber-800 dark:text-amber-200">
                检测到过去有 {overdueTodos.length} 项未完成的遗留待办事项
              </p>
              <span className="text-[11px] text-amber-700/80 dark:text-amber-300/80">
                无需逐个手动修改，可一键自动排期顺延
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              disabled={rollingOver}
              onClick={() => handleRollover("today")}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <span>一键顺延至今日 ⏩</span>
            </button>
            <button
              type="button"
              disabled={rollingOver}
              onClick={() => handleRollover("week")}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300 text-xs font-bold border border-amber-300 dark:border-amber-700 hover:bg-amber-50 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <span>均匀平摊至本周 📅</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 3. 视图渲染区 ── */}
      {!hydrated ? (
        <div className="py-16 text-center text-xs text-gray-400">
          加载日程数据中...
        </div>
      ) : viewMode === "month" ? (
        /* ════════════ 模式 A：月矩阵视图 (Month Matrix) ════════════ */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 左侧：7x5 月日历网格 (7 cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
            {/* 月份切换器 */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-black text-gray-900 dark:text-white">
                  {year} 年 {month + 1} 月
                </h3>
                <button
                  onClick={todayMonth}
                  className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  今天
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={prevMonth}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-400 cursor-pointer"
                >
                  ◀
                </button>
                <button
                  onClick={nextMonth}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-400 cursor-pointer"
                >
                  ▶
                </button>
              </div>
            </div>

            {/* 星期表头 */}
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {["一", "二", "三", "四", "五", "六", "日"].map((d, i) => (
                <span
                  key={d}
                  className={`text-[11px] font-bold ${
                    i >= 5 ? "text-amber-500" : "text-gray-400 dark:text-slate-500"
                  }`}
                >
                  周{d}
                </span>
              ))}
            </div>

            {/* 日历格子 */}
            <div className="grid grid-cols-7 gap-1.5">
              {/* 空白占位 */}
              {Array.from({ length: startDayOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="h-16 rounded-xl bg-transparent" />
              ))}

              {/* 日期格子 */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const d = new Date(year, month, dayNum);
                const dateStr = toLocalDateStr(d);
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDateStr;

                const dayTodos = todos.filter((t) => t.dueDate === dateStr);
                const workload = getWorkloadStatus(dayTodos.length);

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => setSelectedDate(d)}
                    className={`h-16 p-1.5 rounded-xl flex flex-col justify-between items-start transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-[#00C776]/10 border-[#00C776] ring-1 ring-[#00C776]"
                        : isToday
                        ? "bg-emerald-50/50 dark:bg-slate-800 border-emerald-300 dark:border-emerald-700"
                        : "bg-gray-50/70 dark:bg-slate-800/40 border-gray-100 dark:border-slate-800/80 hover:border-gray-300"
                    }`}
                  >
                    <div className="w-full flex items-center justify-between">
                      <span
                        className={`text-xs font-black ${
                          isToday
                            ? "text-[#00C776]"
                            : isSelected
                            ? "text-[#00C776]"
                            : "text-gray-700 dark:text-slate-200"
                        }`}
                      >
                        {dayNum}
                      </span>

                      {dayTodos.length > 0 && (
                        <span
                          className={`w-2 h-2 rounded-full ${workload.dot}`}
                          title={`${dayTodos.length} 项任务 (${workload.label})`}
                        />
                      )}
                    </div>

                    {/* 任务微预览 */}
                    <div className="w-full truncate text-[10px] text-left text-gray-500 dark:text-slate-400">
                      {dayTodos.length > 0 ? (
                        <span className="font-semibold text-gray-700 dark:text-slate-300">
                          {dayTodos[0].title}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 底部热力指示图例 */}
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-gray-100 dark:border-slate-800 text-[11px] text-gray-400">
              <span>负载指示：</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> 适中 (1-3)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> 饱满 (4-6)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> 超载 (7+)
                </span>
              </div>
            </div>
          </div>

          {/* 右侧：选中日期的「精力时段分块」清单 (5 cols) */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-2xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white">
                    {selectedDate.getMonth() + 1} 月 {selectedDate.getDate()} 日 · {
                      ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][
                        selectedDate.getDay()
                      ]
                    }
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    {selectedDateStr === todayStr ? "📍 今天" : "选定日期日程"} · 共{" "}
                    {selectedDateTodos.length} 项
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    getWorkloadStatus(selectedDateTodos.length).badge
                  }`}
                >
                  {getWorkloadStatus(selectedDateTodos.length).label}负载
                </span>
              </div>

              {/* 3 大精力时段分块 */}
              <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                {/* 🌅 上午 · 深度专注 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-black text-rose-600 dark:text-rose-400 bg-rose-50/60 dark:bg-rose-950/40 px-2 py-1 rounded-lg">
                    <span>🌅 上午 · 深度专注攻坚 (高优)</span>
                    <span>{energyBuckets.morning.length} 项</span>
                  </div>
                  {energyBuckets.morning.length === 0 ? (
                    <p className="text-[11px] text-gray-400 pl-2 py-0.5">暂无高优攻坚项</p>
                  ) : (
                    energyBuckets.morning.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={t.done}
                            onChange={() => handleToggleTodo(t.id, t.done)}
                            className="w-3.5 h-3.5 rounded text-[#00C776] focus:ring-[#00C776] cursor-pointer"
                          />
                          <span
                            className={`truncate font-bold ${
                              t.done
                                ? "line-through text-gray-400 dark:text-slate-500"
                                : "text-gray-900 dark:text-white"
                            }`}
                          >
                            {t.title}
                          </span>
                        </div>
                        <button
                          onClick={() => handleOpenEditModal(t)}
                          className="text-[11px] text-gray-400 hover:text-[#00C776]"
                        >
                          ✏️
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* ☀️ 下午 · 协同推进 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-950/40 px-2 py-1 rounded-lg">
                    <span>☀️ 下午 · 协同执行推进 (中优)</span>
                    <span>{energyBuckets.afternoon.length} 项</span>
                  </div>
                  {energyBuckets.afternoon.length === 0 ? (
                    <p className="text-[11px] text-gray-400 pl-2 py-0.5">暂无协同执行项</p>
                  ) : (
                    energyBuckets.afternoon.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={t.done}
                            onChange={() => handleToggleTodo(t.id, t.done)}
                            className="w-3.5 h-3.5 rounded text-[#00C776] focus:ring-[#00C776] cursor-pointer"
                          />
                          <span
                            className={`truncate font-medium ${
                              t.done
                                ? "line-through text-gray-400 dark:text-slate-500"
                                : "text-gray-800 dark:text-slate-200"
                            }`}
                          >
                            {t.title}
                          </span>
                        </div>
                        <button
                          onClick={() => handleOpenEditModal(t)}
                          className="text-[11px] text-gray-400 hover:text-[#00C776]"
                        >
                          ✏️
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* 🌙 晚上 · 复盘沉淀 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-black text-sky-600 dark:text-sky-400 bg-sky-50/60 dark:bg-sky-950/40 px-2 py-1 rounded-lg">
                    <span>🌙 晚上 · 复盘沉淀与收尾</span>
                    <span>{energyBuckets.evening.length} 项</span>
                  </div>
                  {energyBuckets.evening.length === 0 ? (
                    <p className="text-[11px] text-gray-400 pl-2 py-0.5">暂无收尾项</p>
                  ) : (
                    energyBuckets.evening.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={t.done}
                            onChange={() => handleToggleTodo(t.id, t.done)}
                            className="w-3.5 h-3.5 rounded text-[#00C776] focus:ring-[#00C776] cursor-pointer"
                          />
                          <span
                            className={`truncate font-medium ${
                              t.done
                                ? "line-through text-gray-400 dark:text-slate-500"
                                : "text-gray-800 dark:text-slate-200"
                            }`}
                          >
                            {t.title}
                          </span>
                        </div>
                        <button
                          onClick={() => handleOpenEditModal(t)}
                          className="text-[11px] text-gray-400 hover:text-[#00C776]"
                        >
                          ✏️
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 快速新增该日待办 */}
            <form
              onSubmit={(e) => handleAddTodo(e, selectedDateStr)}
              className="pt-2 border-t border-gray-100 dark:border-slate-800 space-y-2"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  name="newTodoTitle"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={`添加 ${selectedDate.getMonth() + 1}/${selectedDate.getDate()} 新日程...`}
                  className="flex-1 px-3 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#00C776]"
                />
                <select
                  name="newTodoPriority"
                  value={newPriority}
                  onChange={(e) =>
                    setNewPriority(e.target.value as "high" | "medium" | "low")
                  }
                  className="px-2 py-1 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  <option value="high">高优(上午)</option>
                  <option value="medium">中优(下午)</option>
                  <option value="low">普通(晚上)</option>
                </select>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#00C776] text-white text-xs font-bold rounded-xl hover:bg-[#00B068] cursor-pointer shrink-0"
                >
                  添加
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : viewMode === "week" ? (
        /* ════════════ 模式 B：7天周看板视图 (Weekly Kanban) ════════════ */
        <div className="bg-white dark:bg-slate-900/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-black text-gray-900 dark:text-white">
                周看板 · {currentWeekDays[0].dateStr} 至 {currentWeekDays[6].dateStr}
              </h3>
              <button
                onClick={() => setSelectedDate(new Date())}
                className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                本周
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={prevWeek}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-400 cursor-pointer"
              >
                ◀ 上周
              </button>
              <button
                onClick={nextWeek}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-400 cursor-pointer"
              >
                下周 ▶
              </button>
            </div>
          </div>

          {/* 7 列周看板 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {currentWeekDays.map(({ dateStr, label }) => {
              const dayTodos = todos.filter((t) => t.dueDate === dateStr);
              const isToday = dateStr === todayStr;
              const workload = getWorkloadStatus(dayTodos.length);

              return (
                <div
                  key={dateStr}
                  className={`flex flex-col justify-between p-3 rounded-2xl border min-h-[300px] ${
                    isToday
                      ? "bg-[#00C776]/5 border-[#00C776]/40 shadow-xs"
                      : "bg-gray-50/60 dark:bg-slate-800/40 border-gray-100 dark:border-slate-800"
                  }`}
                >
                  <div className="space-y-2.5">
                    {/* 列头 */}
                    <div className="flex items-center justify-between pb-2 border-b border-gray-200/60 dark:border-slate-700/60">
                      <div>
                        <span
                          className={`text-xs font-black ${
                            isToday ? "text-[#00C776]" : "text-gray-800 dark:text-slate-200"
                          }`}
                        >
                          {label}
                        </span>
                        <span className="block text-[10px] text-gray-400">
                          {dateStr.slice(5)}
                        </span>
                      </div>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${workload.badge}`}
                      >
                        {dayTodos.length} 项
                      </span>
                    </div>

                    {/* 卡片列表 */}
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                      {dayTodos.length === 0 ? (
                        <p className="text-[10px] text-gray-400 py-6 text-center">
                          无安排
                        </p>
                      ) : (
                        dayTodos.map((t) => (
                          <div
                            key={t.id}
                            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-gray-200/60 dark:border-slate-700 shadow-2xs space-y-1"
                          >
                            <div className="flex items-start gap-1.5">
                              <input
                                type="checkbox"
                                checked={t.done}
                                onChange={() => handleToggleTodo(t.id, t.done)}
                                className="mt-0.5 w-3 h-3 rounded text-[#00C776] focus:ring-[#00C776] cursor-pointer"
                              />
                              <span
                                className={`text-[11px] font-medium leading-snug line-clamp-2 ${
                                  t.done
                                    ? "line-through text-gray-400 dark:text-slate-500"
                                    : "text-gray-800 dark:text-slate-200"
                                }`}
                              >
                                {t.title}
                              </span>
                            </div>
                            <div className="flex items-center justify-between pt-0.5 text-[9px] text-gray-400">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={
                                    t.priority === "high"
                                      ? "text-rose-500 font-bold"
                                      : t.priority === "low"
                                      ? "text-gray-400"
                                      : "text-amber-500 font-bold"
                                  }
                                >
                                  {t.priority === "high"
                                    ? "高优"
                                    : t.priority === "low"
                                    ? "普通"
                                    : "中优"}
                                </span>
                                {t.assigneeName && (
                                  <span className="text-[9px] font-bold text-sky-600 dark:text-sky-400">
                                    👤 {t.assigneeName}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleOpenEditModal(t)}
                                className="hover:text-[#00C776]"
                              >
                                ✏️
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 列底快速加一项 */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate(new Date(dateStr + "T00:00:00"));
                      const input = prompt(`为 ${dateStr} 添加新待办事项:`);
                      if (input?.trim()) {
                        fetch("/api/todos", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            title: input.trim(),
                            priority: "medium",
                            dueDate: dateStr,
                          }),
                        }).then(() => refreshData());
                      }
                    }}
                    className="w-full py-1 mt-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-gray-200/50 dark:border-slate-700/60 text-[10px] font-bold text-gray-500 hover:text-[#00C776] transition-all cursor-pointer"
                  >
                    + 添加
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ════════════ 模式 C：今日流视图 (Today Timeline) ════════════ */
        <div className="bg-white dark:bg-slate-900/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-800 shadow-2xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                <span>⚡</span>
                <span>今日时间线与执行流 (Today Stream)</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {todayStr} · 专注执行闭环
              </p>
            </div>
            <span className="text-xs font-bold text-[#00C776]">
              已完成{" "}
              {todos.filter((t) => t.dueDate === todayStr && t.done).length} /{" "}
              {todos.filter((t) => t.dueDate === todayStr).length} 项
            </span>
          </div>

          <div className="space-y-4">
            {todos.filter((t) => t.dueDate === todayStr).length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">
                ☕ 今日暂无安排任务，点击上方快速新增！
              </div>
            ) : (
              todos
                .filter((t) => t.dueDate === todayStr)
                .map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-4 p-3.5 rounded-xl bg-gray-50/80 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800"
                  >
                    <span className="w-6 h-6 rounded-full bg-[#00C776]/15 text-[#00C776] font-black text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`text-sm font-bold truncate ${
                              item.done
                                ? "line-through text-gray-400 dark:text-slate-500"
                                : "text-gray-900 dark:text-white"
                            }`}
                          >
                            {item.title}
                          </span>
                          {item.assigneeName && (
                            <span className="px-1.5 py-0.2 rounded bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 text-[9px] font-bold shrink-0">
                              👤 {item.assigneeName}
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            item.priority === "high"
                              ? "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                              : item.priority === "low"
                              ? "bg-gray-100 text-gray-600 dark:bg-slate-700"
                              : "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
                          }`}
                        >
                          {item.priority === "high"
                            ? "🌅 深度专注"
                            : item.priority === "low"
                            ? "🌙 复盘收尾"
                            : "☀️ 协同推进"}
                        </span>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => handleToggleTodo(item.id, item.done)}
                      className="w-4 h-4 rounded text-[#00C776] focus:ring-[#00C776] cursor-pointer"
                    />
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* ── 4. iCal Export / Subscribe Modal ── */}
      <IcalExportModal
        open={showIcalModal}
        onClose={() => setShowIcalModal(false)}
      />

      {/* ── 5. AI Schedule Suggestion Modal (支持一键写入日历) ── */}
      <AiScheduleModal
        open={ai.open}
        onClose={() => ai.setOpen(false)}
        dateLabel={selectedDateStr}
        advice={ai.advice}
        warning={ai.warning}
        tasks={ai.tasks}
        selectedIndices={ai.selectedIndices}
        planning={ai.planning}
        applying={ai.applying}
        onToggleIndex={ai.toggleIndex}
        onUpdateTitle={ai.updateTaskTitle}
        onUpdatePriority={ai.updateTaskPriority}
        onDeleteTask={ai.deleteTask}
        onAddCustomTask={() => ai.addCustomTask(selectedDateStr)}
        onApply={() => ai.applyToCalendar(selectedDateStr)}
      />

      {/* ── 6. Edit Modal ── */}
      {editingSchedule && (
        <ScheduleEditModal
          item={editingSchedule}
          projects={projects}
          members={members}
          defaultDateStr={selectedDateStr}
          onClose={() => setEditingSchedule(null)}
          onSaved={handleScheduleModalSaved}
        />
      )}
    </div>
  );
}
