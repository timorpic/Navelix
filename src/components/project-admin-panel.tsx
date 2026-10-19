"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Project } from "@/types";
import { useNavelixData } from "@/context/navelix-context";
import {
  DEFAULT_PROJECT_STATUS,
  displayProjectStatus,
  normalizeProjectStatus,
  projectStatusOptions,
  toStoredStatus,
} from "@/lib/project-status";

// 规范键是存储契约；展示文案由 displayProjectStatus 走字典翻译
const STATUS_OPTIONS = [
  { key: "in-progress", color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400" },
  { key: "research", color: "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400" },
  { key: "maintenance", color: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400" },
  { key: "completed", color: "bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400" },
];

export default function ProjectAdminPanel() {
  const tx = useTranslations();
  const { projects, todos, refreshData, mutateWorkspace } = useNavelixData();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string>(DEFAULT_PROJECT_STATUS);
  const [url, setUrl] = useState("");
  const [color, setColor] = useState("#00C776");
  const [editing, setEditing] = useState<Project | null>(null);
  const [error, setError] = useState("");

  const resetForm = () => {
    setName("");
    setStatus(DEFAULT_PROJECT_STATUS);
    setUrl("");
    setColor("#00C776");
    setEditing(null);
    setError("");
  };

  const submit = async () => {
    const n = name.trim();
    if (!n) { setError(tx("enter_a_project_name_0fb3237e")); return; }
    try {
      // 冲突时不 resetForm：保留用户已输入的字段，仅提示重新提交
      const res = editing
        ? await mutateWorkspace(`/api/projects/${editing.id}`, {
            method: "PATCH",
            body: { name: n, status, color, url },
          })
        : await mutateWorkspace("/api/projects", {
            method: "POST",
            body: { name: n, status, color, url },
          });
      if (!res.ok) {
        setError(res.conflict ? tx("workspace_save_conflict") : tx("failed_to_save_6309a3bb"));
        return;
      }
      resetForm();
      refreshData();
    } catch {
      setError(tx("failed_to_save_6309a3bb"));
    }
  };

  const remove = async (id: string) => {
    const res = await mutateWorkspace(`/api/projects/${id}`, { method: "DELETE" });
    if (!res.ok && res.conflict) setError(tx("workspace_save_conflict"));
    refreshData();
  };

  const startEdit = (p: Project) => {
    setEditing(p);
    setName(p.name);
    setStatus(toStoredStatus(p.status));
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
          <h2 className="text-base font-bold text-gray-900 dark:text-white">{tx("projects_a049dca9")}</h2>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            {tx("manage_projects_status_and_related_urls_in_a_pro_3cc9d0d9")}</p>
        </div>
      </div>

      {/* Add/Edit form */}
      <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">{editing ? "✏️" : "➕"}</span>
            <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
              {editing ? tx("edit_project_577feeef") : tx("new_project_0e1a7040")}
            </span>
          </div>
          {editing && (
            <button
              onClick={resetForm}
              className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
            >
              {tx("cancel_editing_4b29ce8e")}</button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-5">
            <label
              htmlFor="project-admin-name"
              className="block text-[10px] font-semibold text-gray-500 dark:text-slate-400 mb-1"
            >
              {tx("project_name_867698fb")}</label>
            <input
              id="project-admin-name"
              name="projectName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={tx("e_g_hermes_ai_node_9d714c24")}
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-4">
            <label
              htmlFor="project-admin-url"
              className="block text-[10px] font-semibold text-gray-500 dark:text-slate-400 mb-1"
            >
              {tx("project_url_optional_15c0721f")}</label>
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
                {tx("status_ce28a3c7")}</label>
              <select
                id="project-admin-status"
                name="projectStatus"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-2 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white cursor-pointer"
              >
                {projectStatusOptions(editing?.status).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {displayProjectStatus(opt.value, tx)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="project-admin-color"
                className="block text-[10px] font-semibold text-gray-500 dark:text-slate-400 mb-1"
              >
                {tx("theme_color_0f132a45")}</label>
              <input
                id="project-admin-color"
                name="projectColor"
                type="color"
                aria-label={tx("choose_project_theme_color_fe817d92")}
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-10 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer p-0.5"
                title={tx("project_theme_color_a7b1aed8")}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 dark:text-slate-400">{tx("quick_status_9411738e")}</span>
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setStatus(opt.key)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
                  normalizeProjectStatus(status) === opt.key
                    ? "ring-1 ring-[#00C776] font-bold"
                    : "opacity-60 hover:opacity-100"
                } ${opt.color}`}
              >
                {displayProjectStatus(opt.key, tx)}
              </button>
            ))}
          </div>

          <button
            onClick={submit}
            className="h-8 px-4 bg-[#00C776] hover:bg-[#009a5a] text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            {editing ? tx("save_project_a637cf46") : tx("add_project_8964f53a")}
          </button>
        </div>

        {error && <p className="text-[11px] text-rose-500">{error}</p>}
      </div>

      {/* Project list */}
      <div>
        {projects.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-400 dark:text-slate-400">
            {tx("no_projects_yet_create_one_above_to_start_planni_732af2df")}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => {
              // 历史库可能存中文/英文/自定义变体，徽章必须按归一化后的规范键匹配
              const statusKey = normalizeProjectStatus(p.status);
              const matchedOpt = STATUS_OPTIONS.find((s) => s.key === statusKey);
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
                        title={tx("edit_05183656")}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => remove(p.id)}
                        className="text-gray-400 hover:text-rose-500 transition-colors cursor-pointer text-xs"
                        title={tx("delete_2f9daa82")}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${badgeClass}`}>
                      {displayProjectStatus(p.status, tx)}
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
                      <p className="text-[10px] text-gray-400 dark:text-slate-400">{tx("related_todos_6f0251e2")}</p>
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
                          {Math.round((doneCount(p.id) / todoCount(p.id)) * 100)}{tx("complete_ac2c8e23")}</p>
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