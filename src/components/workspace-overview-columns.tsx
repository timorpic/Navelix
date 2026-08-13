"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { Category, Project, SiteLink, TodoItem } from "@/types";

interface WorkspaceOverviewColumnsProps {
  categories: Category[];
  links: SiteLink[];
  onSelectCategory: (id: string) => void;
}

export default function WorkspaceOverviewColumns({
  onSelectCategory,
}: WorkspaceOverviewColumnsProps) {
  // 1. Projects Data State
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  // 2. Todos Data State
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [todosLoading, setTodosLoading] = useState(true);
  const [quickTodoTitle, setQuickTodoTitle] = useState("");

  // Load Projects
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.projects)) setProjects(data.projects);
      }
    } catch {
      // ignore
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  // Load Todos
  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch("/api/todos");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.todos)) setTodos(data.todos);
      }
    } catch {
      // ignore
    } finally {
      setTodosLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchProjects();
      fetchTodos();
    });
  }, [fetchProjects, fetchTodos]);

  // Quick add todo right from the homepage schedule column
  const handleQuickAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTodoTitle.trim()) return;
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: quickTodoTitle.trim(),
          priority: "medium",
          dueDate: new Date().toISOString().split("T")[0],
        }),
      });
      if (res.ok) {
        setQuickTodoTitle("");
        fetchTodos();
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
      fetchTodos();
    } catch {
      // ignore
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 my-0">
      {/* 栏目 1：项目概览 (Project Overview) */}
      <div className="flex flex-col bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-colors">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <span className="text-base">🗂️</span>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              项目概览
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[#00C776] text-[10px] font-bold">
              {projects.length} 项
            </span>
          </div>
          <button
            onClick={() => onSelectCategory("feature-projects")}
            className="text-xs font-semibold text-[#00C776] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>管理</span>
            <span>→</span>
          </button>
        </div>

        {/* Projects List */}
        <div className="flex flex-col gap-2.5 flex-1 min-h-[220px]">
          {projectsLoading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
              加载项目列表中...
            </div>
          ) : projects.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-xs text-gray-400 gap-2 text-center">
              <span>🚀</span>
              <span>暂无数字化项目</span>
              <button
                onClick={() => onSelectCategory("feature-projects")}
                className="mt-1 px-3 py-1.5 rounded-xl bg-[#00C776]/10 text-[#00C776] text-xs font-bold hover:bg-[#00C776]/20 transition-colors"
              >
                + 创建新项目
              </button>
            </div>
          ) : (
            projects.slice(0, 5).map((p) => (
              <div
                key={p.id}
                className="group flex items-center justify-between p-3 rounded-xl bg-gray-50/80 dark:bg-slate-900/60 border border-gray-100/80 dark:border-slate-800 hover:border-gray-200 dark:hover:border-slate-700 transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      p.status === "进行中"
                        ? "bg-emerald-500 animate-pulse"
                        : p.status === "研究中"
                        ? "bg-sky-500"
                        : p.status === "维护中"
                        ? "bg-amber-500"
                        : "bg-purple-500"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-gray-800 dark:text-slate-100 group-hover:text-[#00C776] transition-colors">
                      {p.name}
                    </p>
                    {p.url && (
                      <p className="truncate text-[10px] text-gray-400 dark:text-slate-400">
                        {p.url.replace(/^https?:\/\//, "")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      p.statusColor ||
                      "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                    }`}
                  >
                    {p.status || "进行中"}
                  </span>
                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-[#00C776] text-xs transition-colors"
                      title="打开项目"
                    >
                      ↗
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 栏目 2：日程概览 (Schedule & Agenda Overview) */}
      <div className="flex flex-col bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-colors">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <span className="text-base">📅</span>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              日程概览
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
              {todos.filter((t) => !t.done).length} 待办
            </span>
          </div>
          <button
            onClick={() => onSelectCategory("feature-calendar")}
            className="text-xs font-semibold text-[#00C776] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>日历</span>
            <span>→</span>
          </button>
        </div>

        {/* Quick Add Form */}
        <form onSubmit={handleQuickAddTodo} className="flex gap-2 mb-3">
          <input
            id="overview-quick-todo-input"
            name="quickTodoTitle"
            type="text"
            value={quickTodoTitle}
            onChange={(e) => setQuickTodoTitle(e.target.value)}
            aria-label="快捷添加日程事项"
            placeholder="快捷添加日程事项..."
            className="flex-1 px-3 py-1.5 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00C776]/40 text-gray-800 dark:text-slate-100"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-[#00C776] text-white text-xs font-bold rounded-xl hover:bg-[#009a5a] transition-colors"
          >
            添加
          </button>
        </form>

        {/* Todos List */}
        <div className="flex flex-col gap-2 flex-1 min-h-[170px] max-h-[220px] overflow-y-auto pr-1">
          {todosLoading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
              加载日程待办中...
            </div>
          ) : todos.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-6 text-xs text-gray-400 gap-1 text-center">
              <span>☕</span>
              <span>暂无日程安排，在上方快速新建</span>
            </div>
          ) : (
            todos.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/80 dark:bg-slate-900/60 border border-gray-100/80 dark:border-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    id={`overview-todo-check-${item.id}`}
                    name={`todo-done-${item.id}`}
                    type="checkbox"
                    checked={item.done}
                    onChange={() => handleToggleTodo(item.id, item.done)}
                    aria-label={`标记待办事项 ${item.title}`}
                    className="w-4 h-4 rounded text-[#00C776] focus:ring-[#00C776] border-gray-300 dark:border-slate-600 cursor-pointer"
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

                {item.dueDate && (
                  <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 shrink-0">
                    {item.dueDate.slice(5)}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
