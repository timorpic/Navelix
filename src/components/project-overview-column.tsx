"use client";

import { useMemo, useState } from "react";
import type { SiteLink } from "@/types";
import { useNavelixData } from "@/context/navelix-context";
import { addDaysLocal } from "@/lib/date-utils";
import { useWorkspaceTodos } from "@/hooks/use-workspace-todos";

/**
 * 栏目 1：项目概览与全维度指标中心 (Project Intelligence Hub)。
 *
 * 从 `workspace-overview-columns.tsx`（原 811 行）拆出 —— 该文件把
 * 「项目概览」与「日程概览」两个互不相关的栏目塞在一起。本组件只负责前者。
 */
export default function ProjectOverviewColumn({
  links,
  onSelectCategory,
  nowTs,
}: {
  links: SiteLink[];
  onSelectCategory: (id: string) => void;
  nowTs: number;
}) {
  const { projects, todos, hydrated } = useNavelixData();
  const projectsLoading = !hydrated;
  const { todayStr, toggleTodo: handleToggleTodo } = useWorkspaceTodos();

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

const currentActiveProject = useMemo(() => {
  if (projects.length === 0) return null;
  if (activeProjectId) {
    const found = projects.find((p) => p.id === activeProjectId);
    if (found) return found;
  }
  return projects[0];
}, [projects, activeProjectId]);

// 项目全维度指标分析计算 (进度、任务、风险、最近更新时间、相关任务、相关笔记)
const activeProjectAnalysis = useMemo(() => {
  if (!currentActiveProject) return null;
  const p = currentActiveProject;
  const pTodos = todos.filter((t) => t.projectId === p.id);
  const done = pTodos.filter((t) => t.done).length;
  const total = pTodos.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : p.status === "已完成" ? 100 : 0;

  // 风险评估
  const overdueList = pTodos.filter((t) => !t.done && t.dueDate && t.dueDate < todayStr);
  const highPriorityNear = pTodos.filter(
    (t) => !t.done && t.priority === "high" && t.dueDate && t.dueDate <= addDaysLocal(todayStr, 3),
  );

  let risk: { dot: string; label: string; badge: string };
  if (overdueList.length > 0) {
    risk = {
      dot: "🔴",
      label: `${overdueList.length}项逾期`,
      badge: "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60",
    };
  } else if (highPriorityNear.length > 0) {
    risk = {
      dot: "🟡",
      label: "近期攻坚",
      badge: "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60",
    };
  } else {
    risk = {
      dot: "🟢",
      label: "风险可控",
      badge: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60",
    };
  }

  // 多用户实时最近更新时间
  const timestamps = [
    p.updatedAt || 0,
    p.createdAt || 0,
    ...pTodos.map((t) => t.createdAt || 0),
  ];
  const latestTs = Math.max(...timestamps);

  // 计算相对时间
  let lastUpdatedStr = "刚刚";
  if (latestTs > 0 && nowTs > 0) {
    const diffSec = Math.max(0, Math.floor((nowTs - latestTs) / 1000));
    if (diffSec >= 86400) {
      lastUpdatedStr = `${Math.floor(diffSec / 86400)}d前`;
    } else if (diffSec >= 3600) {
      lastUpdatedStr = `${Math.floor(diffSec / 3600)}h前`;
    } else if (diffSec >= 60) {
      lastUpdatedStr = `${Math.floor(diffSec / 60)}m前`;
    }
  }

  // 关联笔记 / 文档 / 知识资产
  const relatedLinks = links.filter((l) => {
    const pName = p.name.toLowerCase();
    const pDesc = (p.description || "").toLowerCase();
    const lTitle = l.title.toLowerCase();
    const lDesc = (l.description || "").toLowerCase();
    return (
      lTitle.includes(pName) ||
      lDesc.includes(pName) ||
      (pDesc && (lTitle.includes(pDesc) || lDesc.includes(pDesc)))
    );
  });

  // 活跃近期任务 (未完成优先，取前 3 项)
  const activeTasks = [...pTodos]
    .sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1))
    .slice(0, 3);

  return {
    project: p,
    progress,
    done,
    total,
    risk,
    lastUpdatedStr,
    relatedLinks,
    activeTasks,
  };
}, [currentActiveProject, todos, links, todayStr, nowTs]);

  return (
<div className="flex flex-col justify-between bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-colors space-y-3.5">
  {/* 顶部标题与多项目切换 Tabs */}
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-gray-100 dark:border-slate-700/60">
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-base">🗂️</span>
      <h3 className="text-sm font-black text-gray-900 dark:text-white">
        项目概览
      </h3>
      <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[#00C776] text-[10px] font-bold">
        {projects.length} 个项目
      </span>
    </div>

    <div className="flex items-center gap-2">
      {/* 多项目轻量切换器 */}
      {projects.length > 1 && (
        <select
          name="active-project"
          value={currentActiveProject?.id || ""}
          onChange={(e) => setActiveProjectId(e.target.value)}
          className="px-2 py-0.5 text-xs font-bold bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-800 dark:text-slate-200 cursor-pointer max-w-[130px] truncate"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      <button
        onClick={() => onSelectCategory("feature-projects")}
        className="text-xs font-bold text-[#00C776] hover:underline flex items-center gap-1 cursor-pointer"
      >
        <span>全部项目</span>
        <span>→</span>
      </button>
    </div>
  </div>

  {/* 核心内容渲染 */}
  <div className="flex-1 flex flex-col justify-between space-y-3">
    {projectsLoading ? (
      <div className="py-12 text-center text-xs text-gray-400">
        加载项目实时数据中...
      </div>
    ) : projects.length === 0 ? (
      <div className="py-10 text-center text-xs text-gray-400">
        暂无进行中的项目，可在项目管理中心新建或由 AI 拆解
      </div>
    ) : activeProjectAnalysis ? (
      <div className="space-y-3">
        {/* 1. 项目基本信息条 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{
                backgroundColor:
                  activeProjectAnalysis.project.color ||
                  activeProjectAnalysis.project.statusColor ||
                  "#00C776",
              }}
            />
            <h4 className="text-sm font-black text-gray-900 dark:text-white truncate">
              {activeProjectAnalysis.project.name}
            </h4>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              {activeProjectAnalysis.project.status}
            </span>
          </div>

          {activeProjectAnalysis.project.url && (
            <a
              href={activeProjectAnalysis.project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-[#00C776] hover:underline flex items-center gap-1 truncate max-w-[120px]"
              title="打开项目入口"
            >
              <span>入口</span>
              <span>↗</span>
            </a>
          )}
        </div>

        {/* 2. 四维实时指标指示卡 (进度 🟢、任务 🟢、风险 🟡、最近更新 ⏱️) */}
        <div className="grid grid-cols-4 gap-2">
          {/* 进度 */}
          <div className="p-2 rounded-xl bg-gray-50/90 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-gray-400 font-bold mb-0.5">
              进度
            </span>
            <span className="text-xs font-black text-[#00C776] flex items-center gap-1">
              <span>🟢</span>
              <span>{activeProjectAnalysis.progress}%</span>
            </span>
          </div>

          {/* 任务 */}
          <div className="p-2 rounded-xl bg-gray-50/90 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-gray-400 font-bold mb-0.5">
              任务
            </span>
            <span className="text-xs font-black text-gray-800 dark:text-slate-100 flex items-center gap-1">
              <span>🟢</span>
              <span>
                {activeProjectAnalysis.done}/{activeProjectAnalysis.total}
              </span>
            </span>
          </div>

          {/* 风险 */}
          <div className="p-2 rounded-xl bg-gray-50/90 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-gray-400 font-bold mb-0.5">
              风险
            </span>
            <span className="text-[11px] font-black flex items-center gap-0.5 truncate">
              <span>{activeProjectAnalysis.risk.dot}</span>
              <span className="truncate">{activeProjectAnalysis.risk.label}</span>
            </span>
          </div>

          {/* 最近更新 (多用户实时) */}
          <div className="p-2 rounded-xl bg-gray-50/90 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-gray-400 font-bold mb-0.5">
              最近更新
            </span>
            <span className="text-xs font-black text-gray-700 dark:text-slate-200">
              {activeProjectAnalysis.lastUpdatedStr}
            </span>
          </div>
        </div>

        {/* 3. 相关任务阶段概览 (Related Tasks) */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-slate-400">
            <span>📌 关联阶段任务</span>
            <span className="text-[10px]">
              共 {activeProjectAnalysis.total} 项
            </span>
          </div>

          {activeProjectAnalysis.activeTasks.length === 0 ? (
            <p className="text-[11px] text-gray-400 py-1">
              暂无关联任务，可前往项目中心点击「✨ AI 拆解」规划
            </p>
          ) : (
            <div className="space-y-1.5 max-h-28 overflow-y-auto pr-0.5">
              {activeProjectAnalysis.activeTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-gray-50/70 dark:bg-slate-900/50 border border-gray-100/80 dark:border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => handleToggleTodo(task.id, task.done)}
                      className="w-3.5 h-3.5 rounded text-[#00C776] focus:ring-[#00C776] cursor-pointer"
                    />
                    <span
                      className={`truncate font-medium ${
                        task.done
                          ? "line-through text-gray-400 dark:text-slate-500"
                          : "text-gray-800 dark:text-slate-200"
                      }`}
                    >
                      {task.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                    {task.assigneeName && (
                      <span className="px-1.5 py-0.2 rounded bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 font-bold truncate max-w-[60px]">
                        👤 {task.assigneeName}
                      </span>
                    )}
                    {task.dueDate && (
                      <span className="text-gray-400 font-bold">
                        {task.dueDate.slice(5)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. 相关笔记与数字资产 (Related Notes & Assets) */}
        <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-gray-400 font-bold text-[11px] shrink-0">
              📝 相关资产/笔记:
            </span>
            {activeProjectAnalysis.relatedLinks.length === 0 &&
            !activeProjectAnalysis.project.url ? (
              <span className="text-[11px] text-gray-400">
                可在导航库中添加带有该项目名的笔记/链接
              </span>
            ) : (
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                {activeProjectAnalysis.project.url && (
                  <a
                    href={activeProjectAnalysis.project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-[#00C776] text-[10px] font-bold hover:underline shrink-0 flex items-center gap-1"
                  >
                    <span>🔗 官方入口</span>
                  </a>
                )}
                {activeProjectAnalysis.relatedLinks.slice(0, 2).map((l) => (
                  <a
                    key={l.id}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 text-[10px] font-bold hover:text-[#00C776] shrink-0 flex items-center gap-1"
                    title={l.description || l.title}
                  >
                    <span>📄</span>
                    <span className="truncate max-w-[80px]">{l.title}</span>
                  </a>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onSelectCategory("feature-projects")}
            className="text-[11px] font-bold text-[#00C776] hover:underline shrink-0 cursor-pointer"
          >
            去管理 ↗
          </button>
        </div>
      </div>
    ) : null}
  </div>
</div>
  );
}
