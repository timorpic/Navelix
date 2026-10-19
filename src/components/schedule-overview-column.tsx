"use client";

import { useTranslations } from "next-intl";
import React, { useMemo, useState } from "react";
import { useNavelixData } from "@/context/navelix-context";
import { useFocusTracker } from "@/hooks/use-focus-tracker";
import { useWorkspaceTodos } from "@/hooks/use-workspace-todos";
import { addDaysLocal, toLocalDateStr } from "@/lib/date-utils";

type AgendaTab = "today" | "upcoming" | "completed";

/**
 * 栏目 2：日程概览与行动中心 (Smart Schedule & Agenda Action Hub)。
 *
 * 从 `workspace-overview-columns.tsx`（原 811 行）拆出，见
 * `project-overview-column.tsx` 的说明。
 */
export default function ScheduleOverviewColumn({
  onSelectCategory,
}: {
  onSelectCategory: (id: string) => void;
}) {
  const tx = useTranslations();
  const { weeklyData, todayMinutes } = useFocusTracker();
  const currentDayIdx = (new Date().getDay() + 6) % 7;
  const todayFocusHours = weeklyData[currentDayIdx] || 0;
  const yesterdayFocusHours = weeklyData[(currentDayIdx + 6) % 7] || 0;

  const focusTrend = useMemo(() => {
    if (yesterdayFocusHours === 0) return todayMinutes > 0 ? tx("on_track_f9de9a02") : tx("not_started_a00d8da6");
    const diff = ((todayFocusHours - yesterdayFocusHours) / yesterdayFocusHours) * 100;
    if (diff > 0) return `↑ ${Math.round(diff)}%`;
    if (diff < 0) return `↓ ${Math.abs(Math.round(diff))}%`;
    return tx("unchanged_10ad8178");
  }, [todayFocusHours, yesterdayFocusHours, todayMinutes, tx]);

  const { projects, todos, hydrated } = useNavelixData();
  const todosLoading = !hydrated;
  const { todayStr, toggleTodo: handleToggleTodo, postponeOneDay: handlePostponeOneDay, quickAddTodo } = useWorkspaceTodos();

  const [quickTodoTitle, setQuickTodoTitle] = useState("");
  const [quickTodoPriority, setQuickTodoPriority] = useState<"high" | "medium" | "low">("medium");
  const [agendaTab, setAgendaTab] = useState<AgendaTab>("today");
  const [selectedDayFilter, setSelectedDayFilter] = useState<string | null>(null);

  const handleQuickAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await quickAddTodo({
      title: quickTodoTitle,
      priority: quickTodoPriority,
      dueDate: selectedDayFilter || todayStr,
    });
    if (ok) {
      setQuickTodoTitle("");
    }
  };

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
  const labels = [tx("mon_51a75f46"), tx("tue_084b42f6"), tx("wed_a4c3313d"), tx("thu_754a9d58"), tx("fri_c9b87f51"), tx("sat_de07b538"), tx("sun_85217f7a")];
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
}, [todos, todayStr, tx]);

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

  return (
<div className="flex flex-col justify-between bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-colors space-y-3">
  {/* Header & Tabs */}
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-100 dark:border-slate-700/60">
    <div className="flex items-center gap-2">
      <span className="text-base">📅</span>
      <h3 className="text-sm font-bold text-gray-900 dark:text-white">
        {tx("schedule_overview_eadb6af8")}</h3>
      <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[#00C776] text-[10px] font-bold">
        {todayCompletedCount}/{todayTodos.length} {tx("completed_bc3a7758")}{todayProgressPercent}%
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
          {tx("today_97f0b215")}</button>
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
          {tx("next_7_days_19b7bedd")}</button>
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
          {tx("completed_f28461bb")}</button>
      </div>

      <button
        onClick={() => onSelectCategory("feature-calendar")}
        className="text-xs font-semibold text-[#00C776] hover:underline flex items-center gap-0.5 ml-1 cursor-pointer shrink-0"
        title={tx("open_full_calendar_eea24503")}
      >
        <span>{tx("calendar_a00f295c")}</span>
        <span>→</span>
      </button>
    </div>
  </div>

  {/* 今日专注 */}
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
    <div className="flex items-center gap-2">
      <span aria-hidden="true">🎯</span>
      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{tx("focus_today_4372b8b6")}</span>
      <span className="text-xl font-extrabold text-gray-900 dark:text-white">{todayMinutes}</span>
      <span className="text-xs text-gray-500 dark:text-slate-400">{tx("minutes_bd957bc4")}</span>
    </div>
    <span className="rounded bg-emerald-100/70 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">{focusTrend}</span>
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
        {tx("loading_todos_and_schedules_045a21e2")}</div>
    ) : displayedTodos.length === 0 ? (
      <div className="flex-1 flex flex-col items-center justify-center py-6 text-xs text-gray-400 gap-1 text-center">
        <span>☕</span>
        <span>
          {selectedDayFilter
            ? tx("no_tasks_on_this_date_61b916c7")
            : agendaTab === "completed"
            ? tx("no_completed_todos_yet_c85f8662")
            : tx("no_pending_tasks_quickly_add_one_below_40a9d3ec")}
        </span>
      </div>
    ) : (
      displayedTodos.map((item) => {
        const projectName = getProjectName(item.projectId);
        const isOverdue =
          !item.done && item.dueDate && item.dueDate < todayStr;

        return (
          <div
            key={`${item.ownerId ?? ""}:${item.id}`}
            className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/80 dark:bg-slate-900/60 border border-gray-100/80 dark:border-slate-800 hover:border-gray-200 transition-all group text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <input
                id={`overview-todo-check-${item.id}`}
                name={`todo-done-${item.id}`}
                type="checkbox"
                checked={item.done}
                onChange={() => handleToggleTodo(item.id, item.done, item.ownerId)}
                aria-label={tx("message_ac34883a8f3d", {v0: item.title})}
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
                  title={tx("message_67622b005ca2", {v0: item.ownerName || tx("member_6e6d6ddb")})}
                  className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0 truncate max-w-[90px]"
                >
                  {tx("from_0188c132")}{item.ownerName || tx("member_6e6d6ddb")}
                </span>
              ) : item.assigneeName ? (
                <span
                  title={tx("message_357129d9aafa", {v0: item.assigneeName})}
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
                  {tx("overdue_1d40bb81")}</span>
              ) : item.priority === "high" ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                  {tx("high_323a1d5c")}</span>
              ) : item.priority === "low" ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold text-gray-400">
                  {tx("normal_de907d10")}</span>
              ) : (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold text-amber-500">
                  {tx("medium_7319b6d5")}</span>
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
                  title={tx("move_to_tomorrow_15f4d177")}
                >
                  {tx("1_day_fdeaec10")}</button>
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
      aria-label={tx("quick_add_schedule_8e31762e")}
      placeholder={
        selectedDayFilter
          ? tx("message_a5c1b0090662", {v0: selectedDayFilter.slice(5)})
          : tx("quick_add_a_task_for_today_c92cbc93")
      }
      className="flex-1 px-3 py-1.5 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00C776]/40 text-gray-800 dark:text-slate-100"
    />
    <select
      name="quickTodoPriority"
      value={quickTodoPriority}
      onChange={(e) =>
        setQuickTodoPriority(e.target.value as "high" | "medium" | "low")
      }
      className="px-2 py-1 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl font-bold cursor-pointer"
    >
      <option value="high">{tx("high_323a1d5c")}</option>
      <option value="medium">{tx("medium_7319b6d5")}</option>
      <option value="low">{tx("normal_de907d10")}</option>
    </select>
    <button
      type="submit"
      className="px-3.5 py-1.5 bg-[#00C776] text-white text-xs font-bold rounded-xl hover:bg-[#00B068] transition-colors cursor-pointer shrink-0"
    >
      {tx("add_7a8a11ea")}</button>
  </form>
</div>
  );
}
