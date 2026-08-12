"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { TodoItem } from "@/types";

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch("/api/todos");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.todos)) {
          setTodos(data.todos);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  // Calendar math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
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

  const selectedDateStr = selectedDate.toISOString().split("T")[0];

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          priority: newPriority,
          dueDate: selectedDateStr,
        }),
      });
      if (res.ok) {
        setNewTitle("");
        fetchTodos();
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
      fetchTodos();
    } catch {
      // ignore
    }
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      await fetch(`/api/todos/${id}`, { method: "DELETE" });
      fetchTodos();
    } catch {
      // ignore
    }
  };

  const selectedDateTodos = todos.filter((t) => t.dueDate === selectedDateStr);

  const monthNames = [
    "一月", "二月", "三月", "四月", "五月", "六月",
    "七月", "八月", "九月", "十月", "十一月", "十二月"
  ];

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>📅</span>
            <span>日历日程管理</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            查看和规划工作日程、待办事项与任务进度
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={todayMonth}
            className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
          >
            今天
          </button>
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
          >
            ←
          </button>
          <span className="text-sm font-bold min-w-[100px] text-center text-gray-900 dark:text-white">
            {year}年 {monthNames[month]}
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
          >
            →
          </button>
        </div>
      </div>

      {/* Main Grid: Left Calendar, Right Agenda Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar Grid (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-2xs">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-3 text-center text-xs font-bold text-gray-400 dark:text-slate-500">
            <div>日</div>
            <div>一</div>
            <div>二</div>
            <div>三</div>
            <div>四</div>
            <div>五</div>
            <div>六</div>
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="h-14 p-1 opacity-20 pointer-events-none" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateObj = new Date(year, month, day);
              const dateStr = dateObj.toISOString().split("T")[0];
              const isSelected = dateStr === selectedDateStr;
              const isToday =
                new Date().toISOString().split("T")[0] === dateStr;

              const dayTodos = todos.filter((t) => t.dueDate === dateStr);
              const hasTodos = dayTodos.length > 0;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(dateObj)}
                  className={`h-14 p-1.5 rounded-xl flex flex-col justify-between text-left transition-all duration-150 relative cursor-pointer border ${
                    isSelected
                      ? "bg-[#00C776]/10 border-[#00C776] text-[#00C776]"
                      : isToday
                      ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 font-bold"
                      : "bg-gray-50/50 dark:bg-slate-900/50 border-transparent hover:bg-gray-100 dark:hover:bg-slate-700/60 text-gray-800 dark:text-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold">{day}</span>
                    {isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
                  </div>
                  {hasTodos && (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#00C776]" />
                      <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400">
                        {dayTodos.length}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Agenda & Todo Creator (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white dark:bg-slate-800/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-2xs">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center justify-between">
              <span>🗓️ {selectedDateStr} 日程计划</span>
              <span className="text-xs font-normal text-gray-400">
                {selectedDateTodos.length} 项日程
              </span>
            </h3>

            {/* Quick Add Todo for Selected Date */}
            <form onSubmit={handleAddTodo} className="flex gap-2 mb-4">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="新增该日期的日程待办..."
                className="flex-1 px-3 py-2 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00C776]/40 text-gray-800 dark:text-slate-100"
              />
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as any)}
                className="px-2 py-2 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-700 dark:text-slate-300"
              >
                <option value="high">高优</option>
                <option value="medium">中优</option>
                <option value="low">低优</option>
              </select>
              <button
                type="submit"
                className="px-3.5 py-2 bg-[#00C776] text-white text-xs font-semibold rounded-xl hover:bg-[#009a5a] transition-colors"
              >
                添加
              </button>
            </form>

            {/* Agenda Item List */}
            <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
              {loading ? (
                <div className="py-8 text-center text-xs text-gray-400">加载中...</div>
              ) : selectedDateTodos.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400 flex flex-col items-center gap-2">
                  <span>☕</span>
                  <span>该日期暂无日程安排</span>
                </div>
              ) : (
                selectedDateTodos.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/80 border border-gray-100 dark:border-slate-800 group hover:border-gray-200 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => handleToggleTodo(item.id, item.done)}
                        className="w-4 h-4 rounded text-[#00C776] focus:ring-[#00C776] border-gray-300 dark:border-slate-600"
                      />
                      <span
                        className={`text-xs font-medium truncate ${
                          item.done
                            ? "line-through text-gray-400 dark:text-slate-500"
                            : "text-gray-800 dark:text-slate-200"
                        }`}
                      >
                        {item.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          item.priority === "high"
                            ? "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400"
                            : item.priority === "medium"
                            ? "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
                            : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {item.priority === "high" ? "高" : item.priority === "medium" ? "中" : "低"}
                      </span>
                      <button
                        onClick={() => handleDeleteTodo(item.id)}
                        className="text-gray-400 hover:text-red-500 text-xs transition-colors opacity-0 group-hover:opacity-100"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
