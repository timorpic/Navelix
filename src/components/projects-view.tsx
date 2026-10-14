"use client";

import { normalizeProjectStatus, projectStatusLabel } from "@/lib/project-status";

import { useWorkspaceTodos } from "@/hooks/use-workspace-todos";


import { useText } from "@/hooks/use-text";
import { useTranslations } from "next-intl";
import React, { useState, useEffect, useCallback } from "react";
import type { Project, WorkspaceMember } from "@/types";
import { useNavelixData } from "@/context/navelix-context";
import { pushNotification } from "@/lib/client/notifications";
import { useConfirm } from "@/hooks/use-confirm";
import ConfirmDialog from "./confirm-dialog";
import ProjectGanttView from "./project-gantt-view";
import { useGantt } from "@/hooks/use-gantt";
import { useAiBreakdown, type GeneratedTask } from "@/hooks/use-ai-breakdown";
import AiBreakdownCard from "./ai-breakdown-card";
const STATUS_PRESETS = [
  {
    label: "进行中", value: "in-progress",
    color: "#00C776",
    badge:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900",
  },
  {
    label: "研究中", value: "research",
    color: "#0284C7",
    badge:
      "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400 border-sky-200 dark:border-sky-900",
  },
  {
    label: "维护中", value: "maintenance",
    color: "#D97706",
    badge:
      "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900",
  },
  {
    label: "已完成", value: "completed",
    color: "#9333EA",
    badge:
      "bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 border-purple-200 dark:border-purple-900",
  },
];

type ProjectViewTab = "cards" | "gantt";

export default function ProjectsView() {
  const text = useText();
  const tx = useTranslations();
  const confirmDialog = useConfirm();
  const [viewTab, setViewTab] = useState<ProjectViewTab>("cards");
  const { projects, todos, refreshData, hydrated } = useNavelixData();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  // AI 拆解草稿：任务列表、微调操作与同步开关全部由 hook 持有
  const ai = useAiBreakdown(members);
  const [showAdd, setShowAdd] = useState(false);

  // Form States
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("in-progress");
  const [color, setColor] = useState("#00C776");
  const [url, setUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // AI Breakdown States

  // Expanded project tasks view (支持多项目同时展开)
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([]);
  // 甘特图：时间轴状态、折叠状态与多尺度计算全部由 hook 持有
  const gantt = useGantt();

  // 挂载后同步本地设备状态记忆（卡片展开、甘特图折叠、视图模式、甘特图尺度）
    useEffect(() => {
      try {
        const savedTab = localStorage.getItem("navelix_projects_view_tab");
        if (savedTab === "cards" || savedTab === "gantt") {
          queueMicrotask(() => setViewTab(savedTab));
        }
        const savedExpanded = localStorage.getItem("navelix_projects_expanded_ids");
        if (savedExpanded) {
          queueMicrotask(() => setExpandedProjectIds(JSON.parse(savedExpanded)));
        }
      } catch {
        // ignore
      }
    }, []);

  const toggleExpandProject = (id: string) => {
    setExpandedProjectIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((itemId) => itemId !== id)
        : [...prev, id];
      try {
        localStorage.setItem("navelix_projects_expanded_ids", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleViewTabChange = (tab: ProjectViewTab) => {
    setViewTab(tab);
    try {
      localStorage.setItem("navelix_projects_view_tab", tab);
    } catch {}
  };

    const fetchMembers = useCallback(async () => {
    try {
      const mRes = await fetch("/api/user/members");
      if (mRes.ok) {
        const mData = await mRes.json();
        if (Array.isArray(mData.members)) setMembers(mData.members);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchMembers();
    });
  }, [fetchMembers]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setStatus("in-progress");
    setColor("#00C776");
    setUrl("");
    setEditingId(null);
    ai.reset();
    setShowAdd(false);
  };

  // 触发 AI 拆解任务
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;

    try {
      if (editingId) {
        // 编辑模式：将项目基本信息与拆解/修改后的里程碑 todos 原子提交更新
        const res = await fetch(`/api/projects/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: n,
            status,
            color,
            url,
            todos: ai.tasks,
          }),
        });

        if (!res.ok) {
          pushNotification(tx("project_update_failed_1ae41d93"), tx("the_server_could_not_save_your_changes_try_again_654bf0e1"), "project");
          return;
        }

        pushNotification(
          tx("project_stage_tasks_updated_4d5cf2e7"),
          tx("message_a3457651b260", {v0: n, v1: ai.tasks.length}),
          "project",
        );
      } else {
        // 创建项目，并一并提交拆解的任务
        const payload: {
          name: string;
          status: string;
          color: string;
          url: string;
          todos?: GeneratedTask[];
        } = {
          name: n,
          status,
          color,
          url,
        };

        if (ai.syncToCalendar && ai.tasks.length > 0) {
          payload.todos = ai.tasks;
        }

        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          pushNotification(tx("project_creation_failed_69e6fd96"), tx("the_server_could_not_save_the_project_try_again__f0dc2104"), "project");
          return;
        }

        if (ai.syncToCalendar && ai.tasks.length > 0) {
          pushNotification(
            tx("project_schedules_created_2a04b788"),
            tx("message_109f02097e71", {v0: n, v1: ai.tasks.length}),
            "project",
          );
        }
      }
      window.dispatchEvent(new CustomEvent("navelix-workspace-updated"));
      resetForm();
      refreshData();
    } catch {
      pushNotification(tx("save_failed_cc35f455"), tx("network_error_your_project_was_not_saved_try_aga_06c3af76"), "project");
    }
  };

  const handleEdit = (p: Project, triggerAi = false) => {
    setEditingId(p.id);
    setName(p.name);
    setStatus(normalizeProjectStatus(p.status));
    setColor(p.color || p.statusColor || "#00C776");
    setUrl(p.url || "");

    // 关键：读取该项目当前已有拆解的所有阶段里程碑任务，允许编辑、增删与指派！
    const currentProjectTodos = todos.filter((t) => !t.isDelegated && t.projectId === p.id);
    if (currentProjectTodos.length > 0) {
      ai.loadDraft(
        currentProjectTodos.map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority || "medium",
          dueDate: t.dueDate || "",
          assigneeId: t.assigneeId || "",
          assigneeName: t.assigneeName || "",
        })),
        tx("message_11ae20b617ff", {v0: currentProjectTodos.length}),
      );
    } else {
      ai.reset();
    }

    setShowAdd(true);

    if (triggerAi) {
      const titleForAi = p.name;
      const descForAi = p.description || "";
      setTimeout(() => {
        ai.generate(titleForAi, descForAi);
      }, 100);
    }
  };

  const handleDelete = async (id: string) => {
    const okToDelete = await confirmDialog.confirm({
      title: tx("delete_project_f6dc6a11"),
      message: tx("delete_this_project_related_todos_will_also_be_r_25a6d2f2"),
      confirmLabel: tx("delete_2f9daa82"),
    });
    if (!okToDelete) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) {
        pushNotification(tx("delete_failed_8a7bf43e"), tx("the_server_could_not_delete_this_project_try_aga_befb1e22"), "project");
        return;
      }
      refreshData();
    } catch {
      pushNotification(tx("delete_failed_8a7bf43e"), tx("network_error_try_again_later_c59e54b9"), "project");
    }
  };

  // Toggle todo done right inside project view
  const { toggleTodo: handleToggleTodo } = useWorkspaceTodos();

  const getProjectTodos = useCallback(
    (pid: string) => todos.filter((t) => !t.isDelegated && t.projectId === pid),
    [todos],
  );

  const doneCount = useCallback(
    (pid: string) => todos.filter((t) => t.projectId === pid && t.done).length,
    [todos],
  );

  return (
    <>
      <ConfirmDialog {...confirmDialog.dialogProps} />
    <div className="flex flex-col gap-6 animate-fadeIn pb-12">
      {/* ── View Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs">
        <div>
          <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
            <span>🗂️</span>
            <span>{tx("projects_team_milestones_f4a026d0")}</span>
            <span className="px-2 py-0.5 rounded-full bg-brand/10 text-brand text-[10px] font-bold border border-brand/20">
              {viewTab === "gantt" ? tx("gantt_view_9d71057a") : tx("cards_a7b7324c")}
            </span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            {tx("manage_project_lifecycles_ai_breakdowns_team_ass_84dd7991")}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* 模式切换 (卡片 vs 甘特图) */}
          <div className="flex items-center p-1 rounded-xl bg-gray-100 dark:bg-slate-800 border border-gray-200/80 dark:border-slate-700">
            <button
              type="button"
              onClick={() => handleViewTabChange("cards")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewTab === "cards"
                  ? "bg-white dark:bg-slate-900 text-brand shadow-2xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {tx("project_cards_d82d1c09")}</button>
            <button
              type="button"
              onClick={() => handleViewTabChange("gantt")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewTab === "gantt"
                  ? "bg-white dark:bg-slate-900 text-brand shadow-2xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {tx("gantt_view_79de07a8")}</button>
          </div>

          <button
            onClick={() => {
              if (showAdd) resetForm();
              else setShowAdd(true);
            }}
            className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>{showAdd ? "✕" : "+"}</span>
            <span>{showAdd ? tx("collapse_panel_90bb34c2") : tx("new_project_0e1a7040")}</span>
          </button>
        </div>
      </div>

      {/* Add / Edit Project Form */}
      {showAdd && (
        <form
          onSubmit={handleSave}
          className="bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs space-y-4 animate-fadeIn"
        >
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
              <span>{editingId ? "✏️" : "✨"}</span>
              <span>{editingId ? tx("edit_project_577feeef") : tx("new_project_milestones_8b01b94e")}</span>
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-5">
              <label
                htmlFor="projects-view-name"
                className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1"
              >
                {tx("project_name_bdeb781f")}</label>
              <div className="flex gap-2">
                <input
                  id="projects-view-name"
                  name="projectName"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={tx("e_g_navelix_2_0_upgrade_private_nas_setup_5a2358c5")}
                  className="flex-1 px-3 py-2 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
                <button
                  type="button"
                  onClick={() => ai.generate(name, description)}
                  disabled={ai.loading}
                  className="px-3 py-2 bg-gradient-to-r from-brand to-teal-500 hover:from-brand-hover hover:to-teal-600 text-white text-xs font-black rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  title={tx("let_ai_plan_stages_owners_and_deadlines_12e10c9d")}
                >
                  <span>{ai.loading ? "⏳" : "✨"}</span>
                  <span>{ai.loading ? tx("breaking_down_b18b2441") : editingId ? tx("ai_breakdown_0b83f8cd") : tx("ai_breakdown_c3a0c242")}</span>
                </button>
              </div>
            </div>

            <div className="sm:col-span-4">
              <label
                htmlFor="projects-view-url"
                className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1"
              >
                {tx("related_url_89bc331e")}</label>
              <input
                id="projects-view-url"
                name="projectUrl"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/..."
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="projects-view-status"
                className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1"
              >
                {tx("stage_99736957")}</label>
              <select
                id="projects-view-status"
                name="projectStatus"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  const p = STATUS_PRESETS.find(
                    (item) => item.value === e.target.value,
                  );
                  if (p) setColor(p.color);
                }}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand/40 cursor-pointer font-bold"
              >
                {STATUS_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {text(p.label)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="projects-view-desc"
              className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1"
            >
              {tx("goals_background_optional_used_by_ai_31297d45")}</label>
            <textarea
              id="projects-view-desc"
              name="projectDescription"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tx("e_g_refactor_the_frontend_improve_responsive_lay_ec1be730")}
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>

          <AiBreakdownCard ai={ai} members={members} isEditing={!!editingId} />

          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">{tx("color_c65fdbe1")}</span>
              <div className="flex gap-1.5">
                {["#00C776", "#0284C7", "#D97706", "#9333EA", "#EF4444"].map(
                  (c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-5 h-5 rounded-full transition-transform ${
                        color === c ? "scale-125 ring-2 ring-offset-2 ring-gray-400" : ""
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ),
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-3.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 cursor-pointer"
              >
                {tx("cancel_2cd0f3be")}</button>
              <button
                type="submit"
                className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
              >
                {ai.tasks.length > 0 && ai.syncToCalendar
                  ? editingId
                    ? tx("save_add_schedules_to_calendar_97a35eef")
                    : tx("create_project_sync_calendar_cd22aa04")
                  : tx("save_project_a637cf46")}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── 视图模式渲染：卡片看板 vs 甘特图视界 ── */}
      {!hydrated ? (
        <div className="py-16 text-center text-xs text-gray-400">
          {tx("loading_projects_and_schedules_d21d33a0")}</div>
      ) : projects.length === 0 ? (
        <div className="py-16 text-center text-xs text-gray-400 bg-white dark:bg-slate-900/90 rounded-2xl border border-gray-100 dark:border-slate-800">
          {tx("no_projects_yet_create_one_above_or_use_ai_break_1ed29768")}</div>
      ) : viewTab === "cards" ? (
        /* ════════════ 视图 1：项目卡片看板 (Grid Cards) ════════════ */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => {
            const matched = STATUS_PRESETS.find((s) => s.value === normalizeProjectStatus(p.status));
            const badgeStyle = matched
              ? matched.badge
              : "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400";
            const projectThemeColor = p.color || p.statusColor || "#00C776";
            const projectTodos = getProjectTodos(p.id);
            const total = projectTodos.length;
            const done = doneCount(p.id);
            const percent = total > 0 ? Math.round((done / total) * 100) : 0;
            const isExpanded = expandedProjectIds.includes(p.id);

            return (
              <div
                key={p.id}
                className="flex flex-col justify-between p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-gray-100 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-all duration-200 group"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: projectThemeColor }}
                      />
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${badgeStyle}`}
                      >
                        {text(projectStatusLabel(p.status))}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(p, true)}
                        className="px-2 py-0.5 rounded-md bg-brand/10 text-brand hover:bg-brand/20 text-[10px] font-bold transition-colors cursor-pointer"
                        title={tx("use_ai_to_break_down_and_assign_tasks_3b8c9eec")}
                      >
                        {tx("ai_breakdown_f0e9e3be")}</button>
                      <button
                        onClick={() => handleEdit(p)}
                        className="p-1 text-gray-400 hover:text-brand text-xs cursor-pointer"
                        title={tx("edit_05183656")}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1 text-gray-400 hover:text-rose-500 text-xs cursor-pointer"
                        title={tx("delete_2f9daa82")}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <h3 className="text-base font-black text-gray-900 dark:text-white truncate">
                    {p.name}
                  </h3>

                  {/* 进度概览条 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-gray-400">{tx("milestone_completion_773618e0")}</span>
                      <span className="text-gray-700 dark:text-slate-300">
                        {percent}% ({done}/{total})
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${percent}%`,
                          backgroundColor: projectThemeColor,
                        }}
                      />
                    </div>
                  </div>

                  {/* 展开查看/收起关联子任务 */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => toggleExpandProject(p.id)}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 dark:text-slate-300 hover:text-brand cursor-pointer"
                    >
                      <span>{isExpanded ? "▼" : "▶"}</span>
                      <span>{tx("related_schedules_df61e292")}{done}/{total})</span>
                    </button>

                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-brand hover:underline flex items-center gap-0.5 truncate max-w-[130px]"
                        title={p.url}
                      >
                        <span className="truncate">
                          {p.url.replace(/^https?:\/\//, "")}
                        </span>
                        <span>↗</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-gray-300 dark:text-slate-600">
                        {tx("no_external_link_6fd4049b")}</span>
                    )}
                  </div>

                  {/* 展开查看/勾选关联子任务 */}
                  {isExpanded && (
                    <div className="pt-2 space-y-1.5 border-t border-gray-100 dark:border-slate-800">
                      {projectTodos.length === 0 ? (
                        <p className="text-[11px] text-gray-400 py-1">
                          {tx("no_related_todos_use_ai_breakdown_above_to_plan__19ba7e80")}</p>
                      ) : (
                        projectTodos.map((t) => (
                          <div
                            key={`${t.ownerId ?? ""}:${t.id}`}
                            className="flex items-center justify-between p-2 rounded-xl bg-gray-50/80 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={t.done}
                                onChange={() => handleToggleTodo(t.id, t.done, t.ownerId)}
                                className="w-3.5 h-3.5 rounded text-brand focus:ring-brand border-gray-300 cursor-pointer"
                              />
                              <span
                                className={`truncate font-medium ${
                                  t.done
                                    ? "line-through text-gray-400 dark:text-slate-500"
                                    : "text-gray-800 dark:text-slate-200"
                                }`}
                              >
                                {t.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {t.assigneeName && (
                                <span className="px-1.5 py-0.2 rounded bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 text-[10px] font-bold">
                                  👤 {t.assigneeName}
                                </span>
                              )}
                              {t.dueDate && (
                                <span className="text-[10px] font-bold text-gray-400">
                                  {t.dueDate.slice(5)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ════════════ 视图 2：项目甘特图视界 (Interactive Gantt Chart) ════════════ */
        <ProjectGanttView
          gantt={gantt}
          projects={projects}
          getProjectTodos={getProjectTodos}
          doneCount={doneCount}
          onToggleTodo={handleToggleTodo}
          onEditProject={handleEdit}
        />
      )}
    </div>
    </>
  );
}
