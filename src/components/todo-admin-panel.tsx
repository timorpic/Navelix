"use client";

import { todoUrl } from "@/lib/todo-url";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { TodoItem } from "@/types";
import { useNavelixData } from "@/context/navelix-context";

const PRIORITY_LABEL: Record<TodoItem["priority"], string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export default function TodoAdminPanel() {
  const tx = useTranslations();
  const { todos, refreshData } = useNavelixData();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TodoItem["priority"]>("medium");
  const [dueDate, setDueDate] = useState("");
  const [editing, setEditing] = useState<TodoItem | null>(null);
  const [error, setError] = useState("");

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
      setError(tx("enter_a_task_84c15f1a"));
      return;
    }
    try {
      if (editing) {
        const response = await fetch(todoUrl(editing.id, editing.ownerId), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: t, priority, dueDate: dueDate || undefined }),
        });
        if (!response.ok) throw new Error("Save failed");
      } else {
        const response = await fetch("/api/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: t, priority, dueDate: dueDate || undefined }),
        });
        if (!response.ok) throw new Error("Save failed");
      }
      resetForm();
      refreshData();
    } catch {
      setError(tx("failed_to_save_try_again_f42a1238"));
    }
  };

  const toggle = async (todo: TodoItem) => {
    const response = await fetch(todoUrl(todo.id, todo.ownerId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !todo.done }),
    });
    if (!response.ok) { setError(tx("failed_to_save_try_again_f42a1238")); return; }
    refreshData();
  };

  const remove = async (id: string, ownerId?: string) => {
    const response = await fetch(todoUrl(id, ownerId), { method: "DELETE" });
    if (!response.ok) { setError(tx("failed_to_save_try_again_f42a1238")); return; }
    refreshData();
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
            {tx("todo_management_24a5c70e")}</h2>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            {tx("manage_home_page_todos_priorities_and_due_dates_72f22041")}</p>
        </div>
        <span className="text-xs text-gray-400 dark:text-slate-400">
          {tx("total_76e547a8")}{todos.length} {tx("items_pending_a5cdfd7b")}{todos.filter((t) => !t.done).length} {tx("items_49ccde43")}</span>
      </div>

      {/* Add / Edit Form */}
      <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">{editing ? "✏️" : "➕"}</span>
          <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
            {editing ? tx("edit_todo_2c279284") : tx("new_todo_6cb1f607")}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <input
              id="todo-admin-title"
              name="todoTitle"
              type="text"
              aria-label={tx("task_4950de87")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={tx("task_9d5683cc")}
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
          </div>
          <select
            id="todo-admin-priority"
            name="todoPriority"
            aria-label={tx("choose_priority_d9013de5")}
            value={priority}
            onChange={(e) => setPriority(e.target.value as TodoItem["priority"])}
            className="h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-2 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
          >
            <option value="high">{tx("high_priority_b755604e")}</option>
            <option value="medium">{tx("medium_priority_8642409d")}</option>
            <option value="low">{tx("low_priority_11bcaa97")}</option>
          </select>
          <input
            id="todo-admin-due-date"
            name="todoDueDate"
            type="date"
            aria-label={tx("due_date_15f26621")}
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
            {editing ? tx("save_changes_991bb7cf") : tx("add_7a8a11ea")}
          </button>
          {editing && (
            <button
              onClick={resetForm}
              className="h-9 px-4 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-xs font-medium transition-colors cursor-pointer"
            >
              {tx("cancel_editing_4b29ce8e")}</button>
          )}
        </div>
      </div>

      {/* Todo List */}
      <div>
        {todos.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-400 dark:text-slate-400">
            {tx("no_todos_yet_add_one_to_get_started_4d914652")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-400 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="pb-3 pr-4 w-8">{tx("status_6320b4a8")}</th>
                  <th className="pb-3 pr-4">{tx("content_7a688306")}</th>
                  <th className="pb-3 pr-4">{tx("priority_565d6460")}</th>
                  <th className="pb-3 pr-4">{tx("due_date_31802424")}</th>
                  <th className="pb-3 text-right">{tx("actions_ed31fbb4")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {todos.map((todo) => (
                  <tr
                    key={`${todo.ownerId ?? ""}:${todo.id}`}
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
                          {tx("edit_a2e86c4b")}</button>
                        <button
                          onClick={() => remove(todo.id, todo.ownerId)}
                          className="text-gray-400 dark:text-slate-400 hover:text-rose-500 font-medium transition-colors cursor-pointer"
                        >
                          {tx("delete_a6c5bde8")}</button>
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