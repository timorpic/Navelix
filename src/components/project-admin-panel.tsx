"use client";

import { useEffect, useState, useCallback } from "react";
import type { Project, TodoItem } from "@/types";

const STATUS_OPTIONS = [
  { label: "进行中", color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400" },
  { label: "研究中", color: "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400" },
  { label: "维护中", color: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400" },
  { label: "已完成", color: "bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400" },
];

export default function ProjectAdminPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("进行中");
  const [url, setUrl] = useState("");
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

  useEffect(() => {
    queueMicrotask(() => {
      load();
    });
  }, [load]);

  const resetForm = () => {
    setName("");
    setStatus("进行中");
    setUrl("");
    setColor("#00C776");
    setEditing(null);
    setError("");
  };

  const submit = async () => {
    const n = name.trim();
    if (!n) { setError("请输入项目名称"); return; }
    try {
      if (editing) {
        await fetch(`/api/projects/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: n, status, color, url }),
        });
      } else {
        await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: n, status, color, url }),
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

  const startEdit = (p: Project) => {
    setEditing(p);
    setName(p.name);
    setStatus(p.status || "进行中");
    setUrl(p.url || "");
    setColor(p.color || p.statusColor || "#00C776");
    setError("");
  };

  const todoCount = (pid: string) => todos.filter((t) => t.projectId === pid).length;
  const doneCount = (pid: string) => todos.filter((t) => t.projectId === pid && t.done).length;

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100/90 dark:border-slate-700 shadow-2xs space-y-5 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">项目管理</h2>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            管理数字化项目、运行状态与关联 URL，形成「项目 → 任务」的管理结构
          </p>
        </div>
      </div>

      {/* Add/Edit form */}
      <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">{editing ? "✏️" : "➕"}</span>
            <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
              {editing ? "编辑项目" : "新建项目"}
            </span>
          </div>
          {editing && (
            <button
              onClick={resetForm}
              className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
            >
              取消编辑
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-5">
            <label
              htmlFor="project-admin-name"
              className="block text-[10px] font-semibold text-gray-500 dark:text-slate-400 mb-1"
            >
              项目名称
            </label>
            <input
              id="project-admin-name"
              name="projectName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="例如：Hermes AI 节点..."
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-4">
            <label
              htmlFor="project-admin-url"
              className="block text-[10px] font-semibold text-gray-500 dark:text-slate-400 mb-1"
            >
              项目 URL（选填）
            </label>
            <input
              id="project-admin-url"
              name="projectUrl"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://192.168.x.x:8000"
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-3 flex items-end gap-2">
            <div className="flex-1">
              <label
                htmlFor="project-admin-status"
                className="block text-[10px] font-semibold text-gray-500 dark:text-slate-400 mb-1"
              >
                状态标记
              </label>
              <select
                id="project-admin-status"
                name="projectStatus"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-2 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white cursor-pointer"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.label}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="project-admin-color"
                className="block text-[10px] font-semibold text-gray-500 dark:text-slate-400 mb-1"
              >
                主题色
              </label>
              <input
                id="project-admin-color"
                name="projectColor"
                type="color"
                aria-label="选择项目主题颜色"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-10 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer p-0.5"
                title="项目主题颜色"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 dark:text-slate-400">快速状态:</span>
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setStatus(opt.label)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
                  status === opt.label
                    ? "ring-1 ring-[#00C776] font-bold"
                    : "opacity-60 hover:opacity-100"
                } ${opt.color}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={submit}
            className="h-8 px-4 bg-[#00C776] hover:bg-[#009a5a] text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            {editing ? "保存项目" : "添加项目"}
          </button>
        </div>

        {error && <p className="text-[11px] text-rose-500">{error}</p>}
      </div>

      {/* Project list */}
      <div>
        {loading ? (
          <p className="py-8 text-center text-xs text-gray-400 dark:text-slate-400">加载项目列表中…</p>
        ) : projects.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-400 dark:text-slate-400">
            暂无项目，在上方新建一个开始规划吧
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => {
              const matchedOpt = STATUS_OPTIONS.find((s) => s.label === p.status);
              const badgeClass = matchedOpt
                ? matchedOpt.color
                : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400";

              return (
                <div
                  key={p.id}
                  className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: p.color || p.statusColor || "#00C776" }}
                      />
                      <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                        {p.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => startEdit(p)}
                        className="text-gray-400 hover:text-[#00C776] transition-colors cursor-pointer text-xs"
                        title="编辑"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => remove(p.id)}
                        className="text-gray-400 hover:text-rose-500 transition-colors cursor-pointer text-xs"
                        title="删除"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${badgeClass}`}>
                      {p.status || "进行中"}
                    </span>
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-gray-400 hover:text-[#00C776] truncate max-w-[140px]"
                        title={p.url}
                      >
                        {p.url.replace(/^https?:\/\//, "")} ↗
                      </a>
                    )}
                  </div>

                  <div className="flex items-end justify-between pt-1">
                    <div>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{todoCount(p.id)}</p>
                      <p className="text-[10px] text-gray-400 dark:text-slate-400">关联待办</p>
                    </div>
                    {todoCount(p.id) > 0 && (
                      <div className="w-20">
                        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.round((doneCount(p.id) / todoCount(p.id)) * 100)}%`,
                              backgroundColor: p.color || p.statusColor || "#00C776",
                            }}
                          />
                        </div>
                        <p className="text-[9px] text-gray-400 dark:text-slate-400 mt-1 text-right">
                          {Math.round((doneCount(p.id) / todoCount(p.id)) * 100)}% 完成
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}