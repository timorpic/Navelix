"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { Project } from "@/types";

export default function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const [name, setName] = useState("");
  const [status, setStatus] = useState("进行中");
  const [statusColor, setStatusColor] = useState(
    "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900"
  );
  const [url, setUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.projects)) {
          setProjects(data.projects);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const resetForm = () => {
    setName("");
    setStatus("进行中");
    setStatusColor(
      "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900"
    );
    setUrl("");
    setEditingId(null);
    setShowAdd(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (editingId) {
        await fetch(`/api/projects/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, status, statusColor, url }),
        });
      } else {
        await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, status, statusColor, url }),
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
    setStatusColor(p.statusColor || "");
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

  const statusPresets = [
    {
      label: "进行中",
      color: "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900",
    },
    {
      label: "研究中",
      color: "bg-sky-50 text-sky-600 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-400 dark:border-sky-900",
    },
    {
      label: "维护中",
      color: "bg-teal-50 text-teal-600 border border-teal-200 dark:bg-teal-950/50 dark:text-teal-400 dark:border-teal-900",
    },
    {
      label: "已完成",
      color: "bg-purple-50 text-purple-600 border border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-900",
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>🗂️</span>
            <span>项目管理中心</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            跟踪个人数字化项目生命周期、代码库与发布状态
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowAdd(true);
          }}
          className="px-4 py-2 bg-[#00C776] text-white text-xs font-semibold rounded-xl hover:bg-[#009a5a] transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span>＋</span>
          <span>新增项目</span>
        </button>
      </div>

      {/* Add / Edit Form Modal/Drawer */}
      {showAdd && (
        <form
          onSubmit={handleSave}
          className="bg-white dark:bg-slate-800/90 p-5 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col gap-4"
        >
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            {editingId ? "编辑项目信息" : "新建数字项目"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                项目名称 *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：IT 运维管家官网"
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00C776]/40 text-gray-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                项目地址 (URL)
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/your-repo"
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00C776]/40 text-gray-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                状态标签
              </label>
              <select
                value={status}
                onChange={(e) => {
                  const val = e.target.value;
                  setStatus(val);
                  const preset = statusPresets.find((p) => p.label === val);
                  if (preset) setStatusColor(preset.color);
                }}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-slate-100"
              >
                {statusPresets.map((p) => (
                  <option key={p.label} value={p.label}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-3.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#00C776] text-white text-xs font-semibold rounded-xl hover:bg-[#009a5a]"
            >
              保存项目
            </button>
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
          {projects.map((p) => (
            <div
              key={p.id}
              className="flex flex-col justify-between p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-gray-100 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-all duration-200 group"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${p.statusColor}`}>
                    {p.status}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(p)}
                      className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white text-xs"
                      title="编辑"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1 text-gray-400 hover:text-red-500 text-xs"
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

              {p.url && (
                <div className="mt-4 pt-3 border-t border-gray-50 dark:border-slate-700/60 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400 dark:text-slate-500 truncate max-w-[180px]">
                    {p.url.replace(/^https?:\/\//, "")}
                  </span>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-[#00C776] hover:underline flex items-center gap-1"
                  >
                    <span>访问</span>
                    <span>↗</span>
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
