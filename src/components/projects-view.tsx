"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { Project, TodoItem } from "@/types";

const STATUS_PRESETS = [
  { label: "进行中", color: "#00C776", badge: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900" },
  { label: "研究中", color: "#0284C7", badge: "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400 border-sky-200 dark:border-sky-900" },
  { label: "维护中", color: "#D97706", badge: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900" },
  { label: "已完成", color: "#9333EA", badge: "bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 border-purple-200 dark:border-purple-900" },
];

export default function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const [name, setName] = useState("");
  const [status, setStatus] = useState("进行中");
  const [color, setColor] = useState("#00C776");
  const [url, setUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
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
      fetchProjects();
    });
  }, [fetchProjects]);

  const resetForm = () => {
    setName("");
    setStatus("进行中");
    setColor("#00C776");
    setUrl("");
    setEditingId(null);
    setShowAdd(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;

    try {
      if (editingId) {
        await fetch(`/api/projects/${editingId}`, {
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
      fetchProjects();
    } catch {
      // ignore
    }
  };

  const handleEdit = (p: Project) => {
    setEditingId(p.id);
    setName(p.name);
    setStatus(p.status || "进行中");
    setColor(p.color || p.statusColor || "#00C776");
    setUrl(p.url || "");
    setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确认删除该项目？")) return;
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      fetchProjects();
    } catch {
      // ignore
    }
  };

  const todoCount = (pid: string) => todos.filter((t) => t.projectId === pid).length;
  const doneCount = (pid: string) => todos.filter((t) => t.projectId === pid && t.done).length;

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>🗂️</span>
            <span>项目管理中心</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            跟踪个人数字化项目生命周期、状态标记与关联入口
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowAdd(true);
          }}
          className="px-4 py-2 bg-[#00C776] text-white text-xs font-semibold rounded-xl hover:bg-[#009a5a] transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <span>＋</span>
          <span>新增项目</span>
        </button>
      </div>

      {/* Add / Edit Form Drawer */}
      {showAdd && (
        <form
          onSubmit={handleSave}
          className="bg-white dark:bg-slate-800/90 p-5 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              {editingId ? "编辑项目信息" : "新建数字项目"}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 cursor-pointer"
            >
              关闭
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-5">
              <label
                htmlFor="projects-view-name"
                className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1"
              >
                项目名称 *
              </label>
              <input
                id="projects-view-name"
                name="projectName"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：Hermes AI 节点"
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00C776]/40"
              />
            </div>

            <div className="sm:col-span-4">
              <label
                htmlFor="projects-view-url"
                className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1"
              >
                项目 URL（选填）
              </label>
              <input
                id="projects-view-url"
                name="projectUrl"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://192.168.x.x:8000"
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00C776]/40"
              />
            </div>

            <div className="sm:col-span-3 flex items-end gap-2">
              <div className="flex-1">
                <label
                  htmlFor="projects-view-status"
                  className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1"
                >
                  状态标记
                </label>
                <select
                  id="projects-view-status"
                  name="projectStatus"
                  value={status}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStatus(val);
                    const preset = STATUS_PRESETS.find((p) => p.label === val);
                    if (preset) setColor(preset.color);
                  }}
                  className="w-full px-2 py-2 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-slate-100 cursor-pointer"
                >
                  {STATUS_PRESETS.map((p) => (
                    <option key={p.label} value={p.label}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="projects-view-color"
                  className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1"
                >
                  主题色
                </label>
                <input
                  id="projects-view-color"
                  name="projectColor"
                  type="color"
                  aria-label="选择项目主题颜色"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-10 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer p-0.5"
                  title="项目主题颜色"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-400 dark:text-slate-400">快速状态预设:</span>
              {STATUS_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setStatus(preset.label);
                    setColor(preset.color);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                    status === preset.label ? "ring-1 ring-[#00C776] font-bold" : "opacity-60 hover:opacity-100"
                  } ${preset.badge}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-3.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#00C776] text-white text-xs font-semibold rounded-xl hover:bg-[#009a5a] cursor-pointer"
              >
                保存项目
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Projects Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs text-gray-400">加载项目数据中...</div>
      ) : projects.length === 0 ? (
        <div className="py-16 text-center text-xs text-gray-400 bg-white dark:bg-slate-800/90 rounded-2xl border border-gray-100 dark:border-slate-700">
          暂无项目，点击右上角新建项目
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const matched = STATUS_PRESETS.find((s) => s.label === p.status);
            const badgeStyle = matched
              ? matched.badge
              : "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400";
            const projectThemeColor = p.color || p.statusColor || "#00C776";
            const total = todoCount(p.id);
            const done = doneCount(p.id);
            const percent = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <div
                key={p.id}
                className="flex flex-col justify-between p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-gray-100 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-all duration-200 group"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: projectThemeColor }}
                      />
                      <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${badgeStyle}`}>
                        {p.status || "进行中"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(p)}
                        className="p-1 text-gray-400 hover:text-[#00C776] text-xs cursor-pointer"
                        title="编辑"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1 text-gray-400 hover:text-rose-500 text-xs cursor-pointer"
                        title="删除"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                    {p.name}
                  </h3>
                </div>

                {/* Bottom stats & URL */}
                <div className="mt-4 pt-3 border-t border-gray-50 dark:border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-slate-400">
                      <span>关联待办:</span>
                      <span className="font-bold text-gray-800 dark:text-slate-200">{total}</span>
                    </div>

                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-medium text-[#00C776] hover:underline flex items-center gap-0.5 truncate max-w-[150px]"
                        title={p.url}
                      >
                        <span className="truncate">{p.url.replace(/^https?:\/\//, "")}</span>
                        <span>↗</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-gray-300 dark:text-slate-600">未设置 URL</span>
                    )}
                  </div>

                  {total > 0 && (
                    <div className="space-y-1">
                      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${percent}%`, backgroundColor: projectThemeColor }}
                        />
                      </div>
                      <p className="text-[9px] text-gray-400 dark:text-slate-400 text-right">
                        已完成 {percent}%
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
  );
}
