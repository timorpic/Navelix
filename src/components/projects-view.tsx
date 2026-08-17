"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { Project, TodoItem, WorkspaceMember } from "@/types";
import { pushNotification } from "@/lib/notifications";
import { toLocalDateStr, addDaysLocal } from "@/lib/date-utils";
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

interface GeneratedTask {
  id?: string;
  title: string;
  priority: "high" | "medium" | "low";
  dueDate: string;
  assigneeId?: string;
  assigneeName?: string;
}

type ProjectViewTab = "cards" | "gantt";
export type GanttScale = "day" | "month" | "year";

interface GanttColumn {
  key: string;
  label: string;
  subLabel: string;
  isCurrent: boolean;
  isWeekend?: boolean;
}

export default function ProjectsView() {
  const [viewTab, setViewTab] = useState<ProjectViewTab>("cards");
  const [projects, setProjects] = useState<Project[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  // Form States
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("进行中");
  const [color, setColor] = useState("#00C776");
  const [url, setUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // AI Breakdown States
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNotice, setAiNotice] = useState("");
  const [brokenTasks, setBrokenTasks] = useState<GeneratedTask[]>([]);
  const [syncToCalendar, setSyncToCalendar] = useState(true);

  // Expanded project tasks view (支持多项目同时展开)
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([]);
  // 甘特图折叠状态（默认全展开，单独记录折叠的项目）
  const [ganttCollapsedIds, setGanttCollapsedIds] = useState<string[]>([]);

  // 甘特图时间多尺度缩放（日视图 21天 / 月视图 12个月 / 年视图 3年12季度）
  const [ganttScale, setGanttScale] = useState<GanttScale>("day");
  const [ganttOffset, setGanttOffset] = useState(0);

  // 挂载后同步本地设备状态记忆（卡片展开、甘特图折叠、视图模式、甘特图尺度）
  useEffect(() => {
    try {
      const savedTab = localStorage.getItem("navelix_projects_view_tab");
      if (savedTab === "cards" || savedTab === "gantt") {
        setViewTab(savedTab);
      }
      const savedExpanded = localStorage.getItem("navelix_projects_expanded_ids");
      if (savedExpanded) {
        setExpandedProjectIds(JSON.parse(savedExpanded));
      }
      const savedGantt = localStorage.getItem("navelix_projects_gantt_collapsed_ids");
      if (savedGantt) {
        setGanttCollapsedIds(JSON.parse(savedGantt));
      }
      const savedScale = localStorage.getItem("navelix_projects_gantt_scale");
      if (savedScale === "day" || savedScale === "month" || savedScale === "year") {
        setGanttScale(savedScale);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleScaleChange = (scale: GanttScale) => {
    setGanttScale(scale);
    setGanttOffset(0);
    try {
      localStorage.setItem("navelix_projects_gantt_scale", scale);
    } catch {}
  };

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

  const toggleGanttCollapse = (id: string) => {
    setGanttCollapsedIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((itemId) => itemId !== id)
        : [...prev, id];
      try {
        localStorage.setItem("navelix_projects_gantt_collapsed_ids", JSON.stringify(next));
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

  // Gantt Chart time window offset (days from today)
  const [ganttOffsetDays, setGanttOffsetDays] = useState(0);

  const fetchProjects = useCallback(async () => {
    try {
      const [pRes, tRes, mRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/todos"),
        fetch("/api/user/members"),
      ]);
      const pData = await pRes.json();
      const tData = await tRes.json();
      if (pData.projects) setProjects(pData.projects);
      if (tData.todos) setTodos(tData.todos);
      if (mRes.ok) {
        const mData = await mRes.json();
        if (Array.isArray(mData.members)) setMembers(mData.members);
      }
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
    const handleUpdate = () => fetchProjects();
    window.addEventListener("navelix-workspace-updated", handleUpdate);
    window.addEventListener("focus", handleUpdate);
    return () => {
      window.removeEventListener("navelix-workspace-updated", handleUpdate);
      window.removeEventListener("focus", handleUpdate);
    };
  }, [fetchProjects]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setStatus("进行中");
    setColor("#00C776");
    setUrl("");
    setEditingId(null);
    setBrokenTasks([]);
    setAiNotice("");
    setShowAdd(false);
  };

  // 触发 AI 拆解任务
  const handleAiBreakdown = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert("请先输入项目名称，再让 AI 帮您拆解！");
      return;
    }

    setAiLoading(true);
    setAiNotice("");
    try {
      const res = await fetch("/api/ai/project-breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: trimmedName,
          projectDescription: description.trim(),
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.tasks)) {
        setBrokenTasks(data.tasks);
        setAiNotice(
          data.source === "ai_model"
            ? "✨ AI 大模型已为您规划并指派里程碑与排期，您可随时在下方微调任务与责任人！"
            : "⚡ 已使用敏捷工程规划引擎为您智能排期与指派责任人，您可随时在下方微调！",
        );
      } else {
        setAiNotice(data.error || "拆解失败，请手动添加任务");
      }
    } catch {
      setAiNotice("⚠️ 请求拆解服务失败，请稍后重试。");
    } finally {
      setAiLoading(false);
    }
  };

  const handleUpdateTaskTitle = (index: number, newTitle: string) => {
    setBrokenTasks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], title: newTitle };
      return next;
    });
  };

  const handleUpdateTaskPriority = (
    index: number,
    newPriority: "high" | "medium" | "low",
  ) => {
    setBrokenTasks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], priority: newPriority };
      return next;
    });
  };

  const handleUpdateTaskDueDate = (index: number, newDate: string) => {
    setBrokenTasks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], dueDate: newDate };
      return next;
    });
  };

  const handleUpdateTaskAssignee = (index: number, memberId: string) => {
    const matched = members.find((m) => m.id === memberId);
    setBrokenTasks((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        assigneeId: memberId,
        assigneeName: matched ? matched.displayName || matched.username : "",
      };
      return next;
    });
  };

  const handleDeleteTaskItem = (index: number) => {
    setBrokenTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddNewTaskItem = () => {
    const dateStr = addDaysLocal(new Date(), 3);
    const defaultMember = members[0];

    setBrokenTasks((prev) => [
      ...prev,
      {
        title: "新阶段行动任务",
        priority: "medium",
        dueDate: dateStr,
        assigneeId: defaultMember?.id || "",
        assigneeName: defaultMember
          ? defaultMember.displayName || defaultMember.username
          : "",
      },
    ]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;

    try {
      if (editingId) {
        // 编辑模式：将项目基本信息与拆解/修改后的里程碑 todos 原子提交更新
        await fetch(`/api/projects/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: n,
            status,
            color,
            url,
            todos: brokenTasks,
          }),
        });

        pushNotification(
          "🗂️ 项目与阶段任务已更新",
          `项目「${n}」已更新，关联的 ${brokenTasks.length} 项阶段里程碑已同步保存！`,
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

        if (syncToCalendar && brokenTasks.length > 0) {
          payload.todos = brokenTasks;
        }

        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok && syncToCalendar && brokenTasks.length > 0) {
          pushNotification(
            "🗂️ 项目与日程创建成功",
            `项目「${n}」已建立，并自动规划了 ${brokenTasks.length} 项日程待办投射至日历！`,
            "project",
          );
        }
      }
      window.dispatchEvent(new CustomEvent("navelix-workspace-updated"));
      resetForm();
      fetchProjects();
    } catch {
      // ignore
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
      setBrokenTasks(
        currentProjectTodos.map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority || "medium",
          dueDate: t.dueDate || "",
          assigneeId: t.assigneeId || "",
          assigneeName: t.assigneeName || "",
        })),
      );
      setAiNotice(
        `📋 已载入该项目当前 ${currentProjectTodos.length} 项阶段里程碑，您可在此修改任务内容、排期与责任人，或使用 AI 重新规划。`,
      );
    } else {
      setBrokenTasks([]);
      setAiNotice("");
    }

    setShowAdd(true);

    if (triggerAi) {
      setTimeout(() => {
        handleAiBreakdown();
      }, 100);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确认删除该项目？关联待办也将一并清理。")) return;
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      window.dispatchEvent(new CustomEvent("navelix-workspace-updated"));
      fetchProjects();
    } catch {
      // ignore
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
      fetchProjects();
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

  // ── 甘特图多尺度时间轴计算 (Gantt Multi-Scale Engine) ──
  const todayStr = useMemo(() => toLocalDateStr(new Date()), []);

  const { ganttColumns, timelineLabel, prevLabel, nextLabel, stepAmount } = useMemo(() => {
    const cols: GanttColumn[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    const currentQuarter = Math.floor(currentMonth / 3) + 1; // 1-4

    if (ganttScale === "day") {
      // 21 天微观敏捷视窗
      const base = new Date();
      base.setDate(base.getDate() - 3 + ganttOffset);
      const dayNames = ["日", "一", "二", "三", "四", "五", "六"];
      for (let i = 0; i < 21; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        const dStr = toLocalDateStr(d);
        const dayOfWeek = d.getDay();
        cols.push({
          key: dStr,
          label: String(d.getDate()),
          subLabel: `周${dayNames[dayOfWeek]}`,
          isCurrent: dStr === todayStr,
          isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        });
      }
      return {
        ganttColumns: cols,
        timelineLabel: `日排期视界：${cols[0].key} ~ ${cols[cols.length - 1].key}`,
        prevLabel: "◀ 前移 7 天",
        nextLabel: "后移 7 天 ▶",
        stepAmount: 7,
      };
    }

    if (ganttScale === "month") {
      // 12 个月年度推进视窗 (当前月份前后推算 + offset)
      const baseDate = new Date(currentYear, currentMonth - 2 + ganttOffset, 1);
      for (let i = 0; i < 12; i++) {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
        const yr = d.getFullYear();
        const mo = d.getMonth() + 1;
        const key = `${yr}-${String(mo).padStart(2, "0")}`;
        cols.push({
          key,
          label: `${mo}月`,
          subLabel: `${yr}年`,
          isCurrent: yr === currentYear && mo === currentMonth + 1,
        });
      }
      return {
        ganttColumns: cols,
        timelineLabel: `月推进视界：${cols[0].subLabel}${cols[0].label} ~ ${cols[cols.length - 1].subLabel}${cols[cols.length - 1].label}`,
        prevLabel: "◀ 前移 3 个月",
        nextLabel: "后移 3 个月 ▶",
        stepAmount: 3,
      };
    }

    // ganttScale === "year" (跨年战略路线图：3 年 = 12 个季度)
    const baseYear = currentYear - 1 + ganttOffset;
    for (let yr = baseYear; yr <= baseYear + 2; yr++) {
      for (let q = 1; q <= 4; q++) {
        const key = `${yr}-Q${q}`;
        cols.push({
          key,
          label: `Q${q}`,
          subLabel: `${yr}年`,
          isCurrent: yr === currentYear && q === currentQuarter,
        });
      }
    }
    return {
      ganttColumns: cols,
      timelineLabel: `年路线图视界：${baseYear}年 ~ ${baseYear + 2}年 (12 个季度)`,
      prevLabel: "◀ 前移 1 年",
      nextLabel: "后移 1 年 ▶",
      stepAmount: 1,
    };
  }, [ganttScale, ganttOffset, todayStr]);

  // 计算任务在甘特图列中的位置
  const calculateGanttPosition = useCallback(
    (dueDate?: string) => {
      const colCount = ganttColumns.length;
      if (!dueDate || !/^\d{4}-\d{2}-\d{2}/.test(dueDate)) {
        return { startIdx: 2, span: 2 };
      }

      if (ganttScale === "day") {
        const dueIdx = ganttColumns.findIndex((c) => c.key === dueDate);
        if (dueIdx === -1) {
          if (dueDate < ganttColumns[0].key) return { startIdx: 0, span: 1, outOfRange: "past" };
          return { startIdx: colCount - 1, span: 1, outOfRange: "future" };
        }
        const startIdx = Math.max(0, dueIdx - 2);
        const span = Math.max(1, dueIdx - startIdx + 1);
        return { startIdx, span };
      }

      if (ganttScale === "month") {
        const targetMonth = dueDate.slice(0, 7); // YYYY-MM
        const dueIdx = ganttColumns.findIndex((c) => c.key === targetMonth);
        if (dueIdx === -1) {
          if (targetMonth < ganttColumns[0].key) return { startIdx: 0, span: 1, outOfRange: "past" };
          return { startIdx: colCount - 1, span: 1, outOfRange: "future" };
        }
        return { startIdx: dueIdx, span: 1 };
      }

      // year
      const yr = parseInt(dueDate.slice(0, 4), 10);
      const mo = parseInt(dueDate.slice(5, 7), 10);
      const q = Math.floor((mo - 1) / 3) + 1;
      const targetQuarter = `${yr}-Q${q}`;
      const dueIdx = ganttColumns.findIndex((c) => c.key === targetQuarter);
      if (dueIdx === -1) {
        if (targetQuarter < ganttColumns[0].key) return { startIdx: 0, span: 1, outOfRange: "past" };
        return { startIdx: colCount - 1, span: 1, outOfRange: "future" };
      }
      return { startIdx: dueIdx, span: 1 };
    },
    [ganttScale, ganttColumns],
  );

  // 计算父项目在甘特图上的整体跨度
  const calculateProjectSpan = useCallback(
    (projectTodos: TodoItem[]) => {
      const colCount = ganttColumns.length;
      if (projectTodos.length === 0) {
        return { startIdx: 0, span: colCount };
      }

      const validDates = projectTodos
        .map((t) => t.dueDate)
        .filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d));

      if (validDates.length === 0) {
        return { startIdx: 0, span: colCount };
      }

      const minDate = validDates.reduce((min, d) => (d < min ? d : min), validDates[0]);
      const maxDate = validDates.reduce((max, d) => (d > max ? d : max), validDates[0]);

      const startPos = calculateGanttPosition(minDate);
      const endPos = calculateGanttPosition(maxDate);

      const startIdx = Math.min(startPos.startIdx, endPos.startIdx);
      const endIdx = Math.max(startPos.startIdx + startPos.span - 1, endPos.startIdx + endPos.span - 1);
      const span = Math.max(1, endIdx - startIdx + 1);

      return { startIdx, span };
    },
    [calculateGanttPosition, ganttColumns.length],
  );

  return (
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
                  onClick={handleAiBreakdown}
                  disabled={aiLoading}
                  className="px-3 py-2 bg-gradient-to-r from-[#00C776] to-teal-500 hover:from-[#00B068] hover:to-teal-600 text-white text-xs font-black rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  title="让 AI 自动拆分阶段任务、责任人与截止日期"
                >
                  <span>{aiLoading ? "⏳" : "✨"}</span>
                  <span>{aiLoading ? "拆解中..." : editingId ? "AI 智能拆解" : "AI 拆解"}</span>
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

          {/* ── AI 拆解任务预览与微调卡片 ── */}
          {brokenTasks.length > 0 && (
            <div className="p-4 rounded-xl bg-[#00C776]/5 border border-[#00C776]/30 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">✨</span>
                  <h4 className="text-xs font-black text-gray-900 dark:text-white">
                    {editingId
                      ? "AI 为当前项目追加阶段任务与排期"
                      : "AI 里程碑任务拆解与团队指派预览"}
                  </h4>
                  <span className="text-[11px] text-gray-500 dark:text-slate-400">
                    (共 {brokenTasks.length} 个阶段)
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-slate-300 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncToCalendar}
                      onChange={(e) => setSyncToCalendar(e.target.checked)}
                      className="w-4 h-4 rounded text-[#00C776] focus:ring-[#00C776]"
                    />
                    <span>自动同步写入日历日程 🗓️</span>
                  </label>
                </div>
              </div>

              {aiNotice && (
                <p className="text-[11px] text-[#00C776] font-medium">
                  {aiNotice}
                </p>
              )}

              {/* 拆解任务列表 */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {brokenTasks.map((task, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-gray-200/70 dark:border-slate-700 shadow-2xs"
                  >
                    <span className="w-5 h-5 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 text-[10px] font-black flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>

                    {/* 任务名称输入 */}
                    <input
                      type="text"
                      name="projectTaskTitle"
                      value={task.title}
                      onChange={(e) => handleUpdateTaskTitle(idx, e.target.value)}
                      placeholder="任务名称..."
                      className="flex-1 px-2.5 py-1 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#00C776]"
                    />

                    {/* 指派责任人 */}
                    {members.length > 0 && (
                      <select
                        name="projectTaskAssignee"
                        value={task.assigneeId || ""}
                        onChange={(e) =>
                          handleUpdateTaskAssignee(idx, e.target.value)
                        }
                        className="px-2 py-1 text-xs font-bold rounded-lg border bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 cursor-pointer max-w-[110px] truncate"
                        title="指派责任人"
                      >
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            👤 {m.displayName || m.username}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* 优先级选择 */}
                    <select
                      name="projectTaskPriority"
                      value={task.priority}
                      onChange={(e) =>
                        handleUpdateTaskPriority(
                          idx,
                          e.target.value as "high" | "medium" | "low",
                        )
                      }
                      className={`px-2 py-1 text-xs font-bold rounded-lg border cursor-pointer ${
                        task.priority === "high"
                          ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400"
                          : task.priority === "low"
                          ? "bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-slate-400"
                          : "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400"
                      }`}
                    >
                      <option value="high">高优</option>
                      <option value="medium">中优</option>
                      <option value="low">普通</option>
                    </select>

                    {/* 截止日期 */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-gray-400">
                        截止:
                      </span>
                      <input
                        type="date"
                        name="projectTaskDueDate"
                        value={task.dueDate}
                        onChange={(e) =>
                          handleUpdateTaskDueDate(idx, e.target.value)
                        }
                        className="px-2 py-1 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-800 dark:text-slate-100 cursor-pointer"
                      />
                    </div>

                    {/* 删除按钮 */}
                    <button
                      type="button"
                      onClick={() => handleDeleteTaskItem(idx)}
                      className="p-1 text-gray-400 hover:text-rose-500 text-xs cursor-pointer"
                      title="删除此项"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-1">
                <button
                  type="button"
                  onClick={handleAddNewTaskItem}
                  className="text-xs text-[#00C776] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span>+</span>
                  <span>添加自定义阶段任务</span>
                </button>
                <span className="text-[11px] text-gray-400">
                  可自由增删、指派责任人与调整排期
                </span>
              </div>
            </div>
          )}

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
                {brokenTasks.length > 0 && syncToCalendar
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
      {loading ? (
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
        <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col">
          {/* 甘特图工具栏 (Gantt Toolbar) */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                <span>🗓️</span>
                <span>{timelineLabel}</span>
              </span>
              <button
                type="button"
                onClick={() => setGanttOffset(0)}
                className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-700 dark:text-slate-300 hover:text-[#00C776] cursor-pointer shadow-2xs transition-colors"
              >
                {ganttScale === "day" ? "定位今天" : ganttScale === "month" ? "定位本月" : "定位今年"}
              </button>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* 多尺度缩放分段器 (Scale Zoom Controller) */}
              <div className="flex items-center p-0.5 rounded-xl bg-gray-200/70 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => handleScaleChange("day")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    ganttScale === "day"
                      ? "bg-white dark:bg-slate-900 text-[#00C776] shadow-2xs"
                      : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                  title="21 天微观敏捷排期视界"
                >
                  🌞 日 (21天)
                </button>
                <button
                  type="button"
                  onClick={() => handleScaleChange("month")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    ganttScale === "month"
                      ? "bg-white dark:bg-slate-900 text-[#00C776] shadow-2xs"
                      : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                  title="12 个月中期推进视界"
                >
                  📅 月 (年度推进)
                </button>
                <button
                  type="button"
                  onClick={() => handleScaleChange("year")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    ganttScale === "year"
                      ? "bg-white dark:bg-slate-900 text-[#00C776] shadow-2xs"
                      : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                  title="3 年跨度战略路线图"
                >
                  🪐 年 (跨年路线图)
                </button>
              </div>

              {/* 前后翻页 */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setGanttOffset((d) => d - stepAmount)}
                  className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer shadow-2xs transition-colors"
                >
                  {prevLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setGanttOffset((d) => d + stepAmount)}
                  className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer shadow-2xs transition-colors"
                >
                  {nextLabel}
                </button>
              </div>
            </div>
          </div>

          {/* 甘特图主体容器 (横向滚动支持) */}
          <div className="overflow-x-auto">
            <div className="min-w-[960px]">
              {/* 表头：左侧固定项目信息 (240px) + 右侧多尺度刻度 */}
              <div className="flex border-b border-gray-200 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-800/80 text-[11px] font-black text-gray-600 dark:text-slate-300">
                <div className="w-64 p-3 border-r border-gray-200 dark:border-slate-800 shrink-0 flex items-center justify-between">
                  <span>项目 / 里程碑阶段</span>
                  <span className="text-[10px] text-gray-400 font-normal">
                    共 {projects.length} 项
                  </span>
                </div>

                <div
                  className="flex-1 grid divide-x divide-gray-100 dark:divide-slate-800/80 text-center"
                  style={{ gridTemplateColumns: `repeat(${ganttColumns.length}, minmax(0, 1fr))` }}
                >
                  {ganttColumns.map((col) => (
                    <div
                      key={col.key}
                      className={`py-2 px-0.5 flex flex-col items-center justify-center transition-colors ${
                        col.isCurrent
                          ? "bg-[#00C776]/15 text-[#00C776] font-black"
                          : col.isWeekend
                          ? "bg-gray-100/50 dark:bg-slate-800/40 text-amber-600 dark:text-amber-400"
                          : "text-gray-700 dark:text-slate-300"
                      }`}
                    >
                      <span className="text-[9px] opacity-70 truncate max-w-full px-0.5">{col.subLabel}</span>
                      <span className="text-xs font-black">{col.label}</span>
                      {col.isCurrent && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00C776] mt-0.5 animate-ping" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 表体：按项目循环渲染甘特图行 */}
              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                {projects.map((p) => {
                  const projectThemeColor = p.color || p.statusColor || "#00C776";
                  const projectTodos = getProjectTodos(p.id);
                  const total = projectTodos.length;
                  const done = doneCount(p.id);
                  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
                  const isExpanded = !ganttCollapsedIds.includes(p.id); // 甘特图默认展开
                  const { startIdx: pStart, span: pSpan } = calculateProjectSpan(projectTodos);

                  return (
                    <div key={p.id} className="group/project">
                      {/* 项目总览行 (Parent Project Bar) */}
                      <div className="flex items-center hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        {/* 左侧项目信息 */}
                        <div className="w-64 p-3 border-r border-gray-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              type="button"
                              onClick={() => toggleGanttCollapse(p.id)}
                              className="text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer text-xs"
                            >
                              {isExpanded ? "▼" : "▶"}
                            </button>
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: projectThemeColor }}
                            />
                            <span className="truncate text-xs font-black text-gray-900 dark:text-white">
                              {p.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-black text-gray-600 dark:text-slate-300">
                              {percent}%
                            </span>
                            <button
                              onClick={() => handleEdit(p, true)}
                              className="p-1 text-gray-400 hover:text-[#00C776] text-xs cursor-pointer"
                              title="使用 AI 拆解追加任务"
                            >
                              ✨
                            </button>
                          </div>
                        </div>

                        {/* 右侧项目进度跨度条 (Project Track) */}
                        <div className="flex-1 h-12 relative flex items-center px-1">
                          {/* 背景刻度辅助线 */}
                          <div
                            className="absolute inset-0 grid divide-x divide-gray-100 dark:divide-slate-800/60 pointer-events-none"
                            style={{ gridTemplateColumns: `repeat(${ganttColumns.length}, minmax(0, 1fr))` }}
                          >
                            {ganttColumns.map((col) => (
                              <div
                                key={col.key}
                                className={`h-full ${
                                  col.isCurrent
                                    ? "bg-[#00C776]/5"
                                    : col.isWeekend
                                    ? "bg-gray-50/50 dark:bg-slate-800/20"
                                    : ""
                                }`}
                              />
                            ))}
                          </div>

                          {/* 跨度进度块 (自适应尺度百分比) */}
                          <div
                            className="h-6 rounded-xl absolute overflow-hidden shadow-2xs flex items-center justify-between px-3 transition-all cursor-pointer z-10"
                            style={{
                              left: `${(pStart / ganttColumns.length) * 100}%`,
                              width: `${Math.max(8, (pSpan / ganttColumns.length) * 100)}%`,
                              backgroundColor: `${projectThemeColor}20`,
                              border: `1.5px solid ${projectThemeColor}`,
                            }}
                            title={`${p.name} · 里程碑完成度 ${percent}% (${done}/${total})`}
                          >
                            <div
                              className="absolute left-0 top-0 bottom-0 opacity-40 transition-all duration-300"
                              style={{
                                width: `${percent}%`,
                                backgroundColor: projectThemeColor,
                              }}
                            />
                            <span className="relative z-10 text-[10px] font-black text-gray-800 dark:text-white truncate">
                              {p.name} · {p.status}
                            </span>
                            <span className="relative z-10 text-[10px] font-black text-gray-800 dark:text-white shrink-0 ml-1">
                              {done}/{total} ({percent}%)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 里程碑子任务列表 (Child Milestone Gantt Rows) */}
                      {isExpanded &&
                        projectTodos.map((t) => {
                          const { startIdx, span } = calculateGanttPosition(t.dueDate);
                          const isDone = t.done;

                          return (
                            <div
                              key={t.id}
                              className="flex items-center hover:bg-gray-50/40 dark:hover:bg-slate-800/30 transition-colors bg-gray-50/20 dark:bg-slate-900/40"
                            >
                              {/* 左侧子任务标题与勾选 */}
                              <div className="w-64 py-2 px-3 pl-8 border-r border-gray-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={isDone}
                                    onChange={() => handleToggleTodo(t.id, t.done)}
                                    className="w-3.5 h-3.5 rounded text-[#00C776] focus:ring-[#00C776] cursor-pointer"
                                  />
                                  <span
                                    className={`truncate text-xs font-medium ${
                                      isDone
                                        ? "line-through text-gray-400 dark:text-slate-500"
                                        : "text-gray-800 dark:text-slate-200"
                                    }`}
                                    title={t.title}
                                  >
                                    {t.title}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {t.assigneeName && (
                                    <span className="px-1.5 py-0.2 rounded bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 text-[9px] font-bold truncate max-w-[65px]">
                                      👤 {t.assigneeName}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* 右侧甘特图条块 (Gantt Milestone Bar) */}
                              <div className="flex-1 h-9 relative flex items-center">
                                {/* 背景网格 */}
                                <div
                                  className="absolute inset-0 grid divide-x divide-gray-100 dark:divide-slate-800/40 pointer-events-none"
                                  style={{ gridTemplateColumns: `repeat(${ganttColumns.length}, minmax(0, 1fr))` }}
                                >
                                  {ganttColumns.map((col) => (
                                    <div
                                      key={col.key}
                                      className={`h-full ${
                                        col.isCurrent
                                          ? "bg-[#00C776]/5"
                                          : col.isWeekend
                                          ? "bg-gray-50/30 dark:bg-slate-800/10"
                                          : ""
                                      }`}
                                    />
                                  ))}
                                </div>

                                {/* 单个里程碑任务条块 */}
                                <div
                                  className="absolute h-6 rounded-lg px-2 flex items-center justify-between text-[10px] font-bold shadow-2xs transition-all z-10 cursor-pointer"
                                  style={{
                                    left: `${(startIdx / ganttColumns.length) * 100}%`,
                                    width: `${Math.max(ganttScale === "day" ? 4 : 7, (span / ganttColumns.length) * 100)}%`,
                                    backgroundColor: isDone
                                      ? "#94A3B8"
                                      : t.priority === "high"
                                      ? "#F43F5E"
                                      : t.priority === "low"
                                      ? "#64748B"
                                      : projectThemeColor,
                                    color: "#FFFFFF",
                                    opacity: isDone ? 0.6 : 0.95,
                                  }}
                                  onClick={() => handleToggleTodo(t.id, t.done)}
                                  title={`${t.title} · 截止: ${t.dueDate || "未设定"} · 责任人: ${
                                    t.assigneeName || "未指派"
                                  } (点击切换完成)`}
                                >
                                  <span className="truncate flex items-center gap-1">
                                    <span>{isDone ? "✓" : "⚡"}</span>
                                    <span className="truncate">{t.title}</span>
                                  </span>

                                  {t.assigneeName && (
                                    <span className="hidden sm:inline-block ml-1 opacity-90 shrink-0 text-[9px]">
                                      {t.assigneeName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 底部甘特图例 */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-[11px] text-gray-500 dark:text-slate-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-bold">
                <span className="w-3 h-3 rounded-md bg-rose-500" /> 高优里程碑
              </span>
              <span className="flex items-center gap-1.5 font-bold">
                <span className="w-3 h-3 rounded-md bg-[#00C776]" /> 项目阶段推进
              </span>
              <span className="flex items-center gap-1.5 font-bold">
                <span className="w-3 h-3 rounded-md bg-slate-400" /> 已达成闭环
              </span>
            </div>
            <p className="text-[10px] text-gray-400">
              💡 提示：在甘特图上直接点击任务条块可快速标记完成，点击项目可一键呼出 AI 智能拆解追加。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
