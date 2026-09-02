"use client";

import { useState } from "react";
import type { TodoItem } from "@/types";
import { useNavelixData } from "@/hooks/use-navelix-data";

export default function TodoWidget() {
  const { todos, projects, refreshData } = useNavelixData();
  const [newTitle, setNewTitle] = useState("");

  const addTodo = async () => {
    const title = newTitle.trim();
    if (!title) return;
    try {
      await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      setNewTitle("");
      refreshData();
    } catch {
      // ignore
    }
  };

  const toggleTodo = async (todo: TodoItem) => {
    try {
      await fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !todo.done }),
      });
      refreshData();
    } catch {
      // ignore
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      await fetch(`/api/todos/${id}`, { method: "DELETE" });
      refreshData();
    } catch {
      // ignore
    }
  };

  const priorityColor = (p: string) => {
    if (p === "high") return "text-rose-500";
    if (p === "low") return "text-gray-400";
    return "text-amber-500";
  };

  const priorityDot = (p: string) => {
    if (p === "high") return "bg-rose-500";
    if (p === "low") return "bg-gray-300 dark:bg-slate-600";
    return "bg-amber-500";
  };

  const undone = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  return (
    <div className="flex flex-col bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 shadow-2xs transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="p-1 rounded-md bg-[#00C776]/10 text-[#00C776] flex items-center justify-center">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3l8 -8" />
              <path d="M20 12v6a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h9" />
            </svg>
          </span>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            待办事项
          </h3>
          {undone.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#00C776]/10 text-[#00C776] text-[10px] font-bold">
              {undone.length}
            </span>
          )}
        </div>
      </div>

      {/* Quick Add */}
      <div className="relative mb-3">
        <input
          id="todo-widget-quick-input"
          name="todoTitle"
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTodo()}
          placeholder="添加待办..."
          className="w-full pl-3 pr-8 py-1.5 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-200/80 dark:border-slate-700 text-xs text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00C776]/40 focus:border-[#00C776]"
        />
        <button
          onClick={addTodo}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-[#00C776] hover:text-[#009a5a] transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Todo List */}
      <div className="flex flex-col gap-1 max-h-52 overflow-y-auto pr-1">
        {todos.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-gray-400 dark:text-slate-400">
            暂无待办
          </p>
        ) : (
          <>
            {/* Undone */}
            {undone.map((todo) => (
              <div
                key={todo.id}
                className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 group transition-colors"
              >
                <button
                  onClick={() => toggleTodo(todo)}
                  className="w-4 h-4 shrink-0 rounded border-2 border-gray-300 dark:border-slate-500 hover:border-[#00C776] transition-colors cursor-pointer flex items-center justify-center"
                >
                  <span className="w-2 h-2 rounded-full opacity-0 group-hover:opacity-30 bg-[#00C776]" />
                </button>
                <span
                  className={`flex-1 text-xs text-gray-700 dark:text-slate-200 truncate ${priorityColor(todo.priority)}`}
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${priorityDot(todo.priority)} mr-1.5 align-middle`} />
                  {todo.title}
                </span>
                {todo.projectId && (() => {
                  const p = projects.find((pr) => pr.id === todo.projectId);
                  return p ? (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-md shrink-0 font-medium"
                      style={{ backgroundColor: p.color + "18", color: p.color }}
                    >
                      {p.name}
                    </span>
                  ) : null;
                })()}
                {todo.dueDate && (
                  <span className="text-[9px] text-gray-400 dark:text-slate-500 shrink-0">
                    {todo.dueDate.slice(5)}
                  </span>
                )}
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 dark:text-slate-600 hover:text-rose-400 transition-all cursor-pointer shrink-0"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}

            {/* Done items (collapsed) */}
            {done.length > 0 && (
              <details className="group mt-1">
                <summary className="text-[10px] text-gray-400 dark:text-slate-500 cursor-pointer hover:text-gray-600 dark:hover:text-slate-300 select-none">
                  已完成 {done.length} 项
                </summary>
                <div className="flex flex-col gap-1 mt-1">
                  {done.map((todo) => (
                    <div
                      key={todo.id}
                      className="flex items-center gap-2 py-1 px-2 rounded-lg opacity-60"
                    >
                      <button
                        onClick={() => toggleTodo(todo)}
                        className="w-4 h-4 shrink-0 rounded border-2 border-[#00C776] bg-[#00C776]/10 transition-colors cursor-pointer flex items-center justify-center"
                      >
                        <svg className="w-2.5 h-2.5 text-[#00C776]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <span className="flex-1 text-xs text-gray-400 dark:text-slate-500 line-through truncate">
                        {todo.title}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}