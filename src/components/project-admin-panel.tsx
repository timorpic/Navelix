"use client";

import React, { useEffect, useState, useCallback } from "react";
import type { Project, TodoItem } from "@/types";

export default function ProjectAdminPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#00C776");
  const [editing, setEditing] = useState<Project | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [pRes, tRes] = await Promise.all([fetch("/api/projects"), fetch("/api/todos")]);
      const pData = await pRes.json();
      const tData = await tRes.json();
      if (pData.projects) setProjects(pData.projects);
      if (tData.todos) setTodos(tData.todos);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setName(""); setColor("#00C776"); setEditing(null); setError(""); };

  const submit = async () => {
    const n = name.trim();
    if (!n) { setError("请输入项目名称"); return; }
    try {
      if (editing) {
        await fetch(`/api/projects/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: n, color }),
        });
      } else {
        await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: n, color }),
        });
      }
      resetForm();
      load();
    } catch {
      setError("保存失败");
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    load();
  };

  const startEdit = (p: Project) => { setEditing(p); setName(p.name); setColor(p.color || "#00C776"); setError(""); };

  const todoCount = (pid: string) => todos.filter((t) => t.projectId === pid).length;
  const doneCount = (pid: string) => todos.filter((t) => t.projectId === pid && t.done).length;

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100/90 dark:border-slate-700 shadow-2xs space-y-5 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">项目管理</h2>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            为待办任务建立项目归属，形成「项目 → 任务」的工作结构
          </p>
        </div>
      </div>

      {/* Add/Edit form */}
      <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">{editing ? "✏️" : "➕"}</span>
          <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
            {editing ? "编辑项目" : "新建项目"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="项目名称..."
            className="flex-1 h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-12 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer"
            title="项目颜色"
          />
          <button
            onClick={submit}
            className="h-9 px-4 bg-[#00C776] hover:bg-[#009a5a] text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            {editing ? "保存" : "添加"}
          </button>
          {editing && (
            <button
              onClick={resetForm}
              className="h-9 px-4 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-xs font-medium transition-colors cursor-pointer"
            >
              取消
            </button>
          )}
        </div>
        {error && <p className="text-[11px] text-rose-500">{error}</p>}
      </div>

      {/* Project list */}
      <div>
        {loading ? (
          <p className="py-8 text-center text-xs text-gray-400 dark:text-slate-400">加载中…</p>
        ) : projects.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-400 dark:text-slate-400">
            暂无项目，创建一个开始规划任务
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => startEdit(p)} className="text-gray-400 hover:text-[#00C776] transition-colors cursor-pointer text-xs">✏️</button>
                    <button onClick={() => remove(p.id)} className="text-gray-400 hover:text-rose-500 transition-colors cursor-pointer text-xs">🗑️</button>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{todoCount(p.id)}</p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-400">个任务</p>
                  </div>
                  {todoCount(p.id) > 0 && (
                    <div className="w-20">
                      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.round((doneCount(p.id) / todoCount(p.id)) * 100)}%`, backgroundColor: p.color }}
                        />
                      </div>
                      <p className="text-[9px] text-gray-400 dark:text-slate-400 mt-1 text-right">
                        {Math.round((doneCount(p.id) / todoCount(p.id)) * 100)}% 完成
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}