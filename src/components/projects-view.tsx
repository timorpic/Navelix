"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { Project, WorkspaceMember } from "@/types";
import { useNavelixData } from "@/context/navelix-context";
import { pushNotification } from "@/lib/client/notifications";
import { trackClientEvent } from "@/lib/client/analytics";
import { useConfirm } from "@/hooks/use-confirm";
import ConfirmDialog from "./confirm-dialog";
import ProjectGanttView from "./project-gantt-view";
import { useGantt } from "@/hooks/use-gantt";
import { useAiBreakdown, type GeneratedTask } from "@/hooks/use-ai-breakdown";
import AiBreakdownCard from "./ai-breakdown-card";
const STATUS_PRESETS = [
  {
    label: "进行中",
    color: "#00C776",
    badge:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900",
  },
  {
    label: "研究中",
    color: "#0284C7",
    badge:
      "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400 border-sky-200 dark:border-sky-900",
  },
  {
    label: "维护中",
    color: "#D97706",
    badge:
      "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900",
  },
  {
    label: "已完成",
    color: "#9333EA",
    badge:
      "bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 border-purple-200 dark:border-purple-900",
  },
];

type ProjectViewTab = "cards" | "gantt";

export default function ProjectsView() {
  const confirmDialog = useConfirm();
  const [viewTab, setViewTab] = useState<ProjectViewTab>("cards");
  const { projects, todos, refreshData, hydrated } = useNavelixData();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  // AI 拆解草稿：任务列表、微调操作与同步开关全部由 hook 持有
  const ai = useAiBreakdown(members);
  const [showAdd, setShowAdd] = useState(false);

  // 可选遥测：查看甘特图视图
  useEffect(() => {
    if (viewTab === "gantt") {
      trackClientEvent("project.gantt_view", {
        projectCount: projects.length,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewTab]);

  // Form States
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("进行中");
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
    setStatus("进行中");
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
          pushNotification("❌ 项目更新失败", "服务器未能保存本次修改，请稍后重试。", "project");
          return;
        }

        pushNotification(
          "🗂️ 项目与阶段任务已更新",
          `项目「${n}」已更新，关联的 ${ai.tasks.length} 项阶段里程碑已同步保存！`,
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
          pushNotification("❌ 项目创建失败", "服务器未能保存该项目，请稍后重试。", "project");
          return;
        }

        if (ai.syncToCalendar && ai.tasks.length > 0) {
          pushNotification(
            "🗂️ 项目与日程创建成功",
            `项目「${n}」已建立，并自动规划了 ${ai.tasks.length} 项日程待办投射至日历！`,
            "project",
          );
        }
      }
      window.dispatchEvent(new CustomEvent("navelix-workspace-updated"));
      resetForm();
      refreshData();
    } catch {
      pushNotification("❌ 保存失败", "网络异常，项目未能保存，请稍后重试。", "project");
    }
  };

  const handleEdit = (p: Project, triggerAi = false) => {
    setEditingId(p.id);
    setName(p.name);
    setStatus(p.status || "进行中");
    setColor(p.color || p.statusColor || "#00C776");
    setUrl(p.url || "");

    // 关键：读取该项目当前已有拆解的所有阶段里程碑任务，允许编辑、增删与指派！
    const currentProjectTodos = todos.filter((t) => t.projectId === p.id);
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
        `📋 已载入该项目当前 ${currentProjectTodos.length} 项阶段里程碑，您可在此修改任务内容、排期与责任人，或使用 AI 重新规划。`,
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
      title: "删除项目",
      message: "确认删除该项目？关联待办也将一并清理。",
      confirmLabel: "删除",
    });
    if (!okToDelete) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) {
        pushNotification("❌ 删除失败", "服务器未能删除该项目，请稍后重试。", "project");
        return;
      }
      window.dispatchEvent(new CustomEvent("navelix-workspace-updated"));
      refreshData();
    } catch {
      pushNotification("❌ 删除失败", "网络异常，请稍后重试。", "project");
    }
  };

  // Toggle todo done right inside project view
  const handleToggleTodo = async (id: string, done: boolean) => {
    try {
      await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !done }),
      });
      window.dispatchEvent(new CustomEvent("navelix-workspace-updated"));
      refreshData();
    } catch {
      // ignore
    }
  };

  const getProjectTodos = useCallback(
    (pid: string) => todos.filter((t) => t.projectId === pid),
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
            <span>项目管理与团队里程碑中心</span>
            <span className="px-2 py-0.5 rounded-full bg-[#00C776]/10 text-[#00C776] text-[10px] font-bold border border-[#00C776]/20">
              {viewTab === "gantt" ? "甘特图视界" : "卡片看板"}
            </span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            统筹数字化项目生命周期、AI 智能拆解、多用户责任人指派与甘特排期
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* 模式切换 (卡片 vs 甘特图) */}
          <div className="flex items-center p-1 rounded-xl bg-gray-100 dark:bg-slate-800 border border-gray-200/80 dark:border-slate-700">
            <button
              type="button"
              onClick={() => handleViewTabChange("cards")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewTab === "cards"
                  ? "bg-white dark:bg-slate-900 text-[#00C776] shadow-2xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              🗂️ 项目卡片
            </button>
            <button
              type="button"
              onClick={() => handleViewTabChange("gantt")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewTab === "gantt"
                  ? "bg-white dark:bg-slate-900 text-[#00C776] shadow-2xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              📊 甘特图视界
            </button>
          </div>

          <button
            onClick={() => {
              if (showAdd) resetForm();
              else setShowAdd(true);
            }}
            className="px-4 py-2 bg-[#00C776] hover:bg-[#00B068] text-white text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>{showAdd ? "✕" : "+"}</span>
            <span>{showAdd ? "收起面板" : "新建项目"}</span>
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
              <span>{editingId ? "编辑项目" : "新建项目与里程碑规划"}</span>
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
                项目名称 *
              </label>
              <div className="flex gap-2">
                <input
                  id="projects-view-name"
                  name="projectName"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：Navelix 2.0 升级 / 私有云 NAS 搭建"
                  className="flex-1 px-3 py-2 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00C776]/40"
                />
                <button
                  type="button"
                  onClick={() => ai.generate(name, description)}
                  disabled={ai.loading}
                  className="px-3 py-2 bg-gradient-to-r from-[#00C776] to-teal-500 hover:from-[#00B068] hover:to-teal-600 text-white text-xs font-black rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  title="让 AI 自动拆分阶段任务、责任人与截止日期"
                >
                  <span>{ai.loading ? "⏳" : "✨"}</span>
                  <span>{ai.loading ? "拆解中..." : editingId ? "AI 智能拆解" : "AI 拆解"}</span>
                </button>
              </div>
            </div>

            <div className="sm:col-span-4">
              <label
                htmlFor="projects-view-url"
                className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1"
              >
                关联入口链接
              </label>
              <input
                id="projects-view-url"
                name="projectUrl"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/..."
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00C776]/40"
              />
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="projects-view-status"
                className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1"
              >
                状态阶段
              </label>
              <select
                id="projects-view-status"
                name="projectStatus"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  const p = STATUS_PRESETS.find(
                    (item) => item.label === e.target.value,
                  );
                  if (p) setColor(p.color);
                }}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00C776]/40 cursor-pointer font-bold"
              >
                {STATUS_PRESETS.map((p) => (
                  <option key={p.label} value={p.label}>
                    {p.label}
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
              项目目标与背景（可选，供 AI 拆解参考）
            </label>
            <textarea
              id="projects-view-desc"
              name="projectDescription"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：重构前端架构，优化响应式排版，两周内交付上线..."
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00C776]/40"
            />
          </div>

          <AiBreakdownCard ai={ai} members={members} isEditing={!!editingId} />

          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">主题标识:</span>
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
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#00C776] hover:bg-[#00B068] text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
              >
                {ai.tasks.length > 0 && ai.syncToCalendar
                  ? editingId
                    ? "一键保存并追加日程至日历 🗓️"
                    : "一键创建项目并同步日历 🗓️"
                  : "保存项目"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── 视图模式渲染：卡片看板 vs 甘特图视界 ── */}
      {!hydrated ? (
        <div className="py-16 text-center text-xs text-gray-400">
          加载项目与排期数据中...
        </div>
      ) : projects.length === 0 ? (
        <div className="py-16 text-center text-xs text-gray-400 bg-white dark:bg-slate-900/90 rounded-2xl border border-gray-100 dark:border-slate-800">
          暂无项目，点击右上角新建项目或让 AI 智能拆解
        </div>
      ) : viewTab === "cards" ? (
        /* ════════════ 视图 1：项目卡片看板 (Grid Cards) ════════════ */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => {
            const matched = STATUS_PRESETS.find((s) => s.label === p.status);
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
                        {p.status || "进行中"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(p, true)}
                        className="px-2 py-0.5 rounded-md bg-[#00C776]/10 text-[#00C776] hover:bg-[#00C776]/20 text-[10px] font-bold transition-colors cursor-pointer"
                        title="使用 AI 智能拆解并指派任务"
                      >
                        ✨ AI 拆解
                      </button>
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

                  <h3 className="text-base font-black text-gray-900 dark:text-white truncate">
                    {p.name}
                  </h3>

                  {/* 进度概览条 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-gray-400">里程碑达成度</span>
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
                      className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 dark:text-slate-300 hover:text-[#00C776] cursor-pointer"
                    >
                      <span>{isExpanded ? "▼" : "▶"}</span>
                      <span>关联日程待办 ({done}/{total})</span>
                    </button>

                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-[#00C776] hover:underline flex items-center gap-0.5 truncate max-w-[130px]"
                        title={p.url}
                      >
                        <span className="truncate">
                          {p.url.replace(/^https?:\/\//, "")}
                        </span>
                        <span>↗</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-gray-300 dark:text-slate-600">
                        未绑定外部链接
                      </span>
                    )}
                  </div>

                  {/* 展开查看/勾选关联子任务 */}
                  {isExpanded && (
                    <div className="pt-2 space-y-1.5 border-t border-gray-100 dark:border-slate-800">
                      {projectTodos.length === 0 ? (
                        <p className="text-[11px] text-gray-400 py-1">
                          暂无关联待办，可在上方点击「✨ AI 拆解」快速规划。
                        </p>
                      ) : (
                        projectTodos.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-gray-50/80 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={t.done}
                                onChange={() => handleToggleTodo(t.id, t.done)}
                                className="w-3.5 h-3.5 rounded text-[#00C776] focus:ring-[#00C776] border-gray-300 cursor-pointer"
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
