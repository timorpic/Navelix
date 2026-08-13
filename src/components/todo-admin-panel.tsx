"use client";

import React, { useEffect, useState, useCallback } from "react";
import type { TodoItem } from "@/types";

const PRIORITY_LABEL: Record<TodoItem["priority"], string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export default function TodoAdminPanel() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TodoItem["priority"]>("medium");
  const [dueDate, setDueDate] = useState("");
  const [editing, setEditing] = useState<TodoItem | null>(null);
  const [error, setError] = useState("");

  const loadTodos = useCallback(async () => {
    try {
      const res = await fetch("/api/todos");
      const data = await res.json();
      if (data.todos) setTodos(data.todos);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadTodos();
    });
  }, [loadTodos]);

  const resetForm = () => {
    setTitle("");
    setPriority("medium");
    setDueDate("");
    setEditing(null);
    setError("");
  };

  const submit = async () => {
    const t = title.trim();
    if (!t) {
      setError("请输入待办内容");
      return;
    }
    try {
      if (editing) {
        await fetch(`/api/todos/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: t, priority, dueDate: dueDate || undefined }),
        });
      } else {
        await fetch("/api/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: t, priority, dueDate: dueDate || undefined }),
        });
      }
      resetForm();
      loadTodos();
    } catch {
      setError("保存失败，请重试");
    }
  };

  const toggle = async (todo: TodoItem) => {
    await fetch(`/api/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !todo.done }),
    });
    loadTodos();
  };

  const remove = async (id: string) => {
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
    loadTodos();
  };

  const startEdit = (todo: TodoItem) => {
    setEditing(todo);
    setTitle(todo.title);
    setPriority(todo.priority);
    setDueDate(todo.dueDate || "");
    setError("");
  };

  const priorityBadge = (p: TodoItem["priority"]) => {
    const cls =
      p === "high"
        ? "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900"
        : p === "low"
        ? "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700"
        : "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900";
    return `px-2 py-0.5 rounded-md text-[10px] font-semibold border ${cls}`;
  };

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100/90 dark:border-slate-700 shadow-2xs space-y-5 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            待办事项管理
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            管理首页「✅ 待办事项」组件，支持优先级与截止日期
          </p>
        </div>
        <span className="text-xs text-gray-400 dark:text-slate-400">
          共 {todos.length} 项 · 未完成 {todos.filter((t) => !t.done).length} 项
        </span>
      </div>

      {/* Add / Edit Form */}
      <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">{editing ? "✏️" : "➕"}</span>
          <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
            {editing ? "编辑待办" : "新建待办"}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="待办内容..."
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
          </div>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TodoItem["priority"])}
            className="h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-2 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
          >
            <option value="high">🔴 高优先级</option>
            <option value="medium">🟡 中优先级</option>
            <option value="low">🟢 低优先级</option>
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-2 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
          />
        </div>
        {error && <p className="text-[11px] text-rose-500">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            onClick={submit}
            className="h-9 px-4 bg-[#00C776] hover:bg-[#009a5a] text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            {editing ? "保存修改" : "添加"}
          </button>
          {editing && (
            <button
              onClick={resetForm}
              className="h-9 px-4 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-xs font-medium transition-colors cursor-pointer"
            >
              取消编辑
            </button>
          )}
        </div>
      </div>

      {/* Todo List */}
      <div>
        {loading ? (
          <p className="py-8 text-center text-xs text-gray-400 dark:text-slate-400">加载中…</p>
        ) : todos.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-400 dark:text-slate-400">
            暂无待办，添加一条开始吧
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-400 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="pb-3 pr-4 w-8">状态</th>
                  <th className="pb-3 pr-4">内容</th>
                  <th className="pb-3 pr-4">优先级</th>
                  <th className="pb-3 pr-4">截止日期</th>
                  <th className="pb-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {todos.map((todo) => (
                  <tr
                    key={todo.id}
                    className="hover:bg-gray-50/60 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <button
                        onClick={() => toggle(todo)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                          todo.done
                            ? "border-[#00C776] bg-[#00C776]/10"
                            : "border-gray-300 dark:border-slate-500 hover:border-[#00C776]"
                        }`}
                      >
                        {todo.done && (
                          <svg className="w-3 h-3 text-[#00C776]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`font-medium ${todo.done ? "text-gray-400 dark:text-slate-500 line-through" : "text-gray-900 dark:text-white"}`}
                      >
                        {todo.title}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={priorityBadge(todo.priority)}>
                        {PRIORITY_LABEL[todo.priority]}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-400 dark:text-slate-400">
                      {todo.dueDate || "—"}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => startEdit(todo)}
                          className="text-gray-500 dark:text-slate-400 hover:text-[#00C776] font-medium transition-colors cursor-pointer"
                        >
                          ✏️ 修改
                        </button>
                        <button
                          onClick={() => remove(todo.id)}
                          className="text-gray-400 dark:text-slate-400 hover:text-rose-500 font-medium transition-colors cursor-pointer"
                        >
                          🗑️ 删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}