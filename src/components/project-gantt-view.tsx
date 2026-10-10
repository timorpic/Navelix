"use client";

import type { Project, TodoItem } from "@/types";
import type { UseGanttResult } from "@/hooks/use-gantt";

/**
 * 项目甘特图视界（多尺度时间轴 + 项目跨度条 + 里程碑条块）。
 *
 * 从 `projects-view.tsx`（原 1501 行）抽出 —— 该文件把「卡片看板」与「甘特图视界」
 * 两个互不相关的视图塞在一起。时间轴状态与计算全部来自 `useGantt()`，
 * 本组件只负责渲染与事件转发。
 */
export default function ProjectGanttView({
  gantt,
  projects,
  getProjectTodos,
  doneCount,
  onToggleTodo,
  onEditProject,
}: {
  gantt: UseGanttResult;
  projects: Project[];
  getProjectTodos: (projectId: string) => TodoItem[];
  doneCount: (projectId: string) => number;
  onToggleTodo: (id: string, done: boolean) => void;
  /** 点击项目上的 ✨ 呼出 AI 拆解 */
  onEditProject: (project: Project, triggerAi?: boolean) => void;
}) {
  return (
    <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col">
      {/* 甘特图工具栏 (Gantt Toolbar) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span>🗓️</span>
                      <span>{gantt.timelineLabel}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => gantt.setOffset(0)}
                      className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-700 dark:text-slate-300 hover:text-[#00C776] cursor-pointer shadow-2xs transition-colors"
                    >
                      {gantt.scale === "day" ? "定位今天" : gantt.scale === "month" ? "定位本月" : "定位今年"}
                    </button>
                    {/* 项目筛选下拉 */}
                    <select
                      value={gantt.projectFilter}
                      onChange={(e) => gantt.setProjectFilter(e.target.value)}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-700 dark:text-slate-300 cursor-pointer shadow-2xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#00C776]/40"
                    >
                      <option value="all">全部项目</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* 多尺度缩放分段器 (Scale Zoom Controller) */}
          <div className="flex items-center p-0.5 rounded-xl bg-gray-200/70 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => gantt.handleScaleChange("day")}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                gantt.scale === "day"
                  ? "bg-white dark:bg-slate-900 text-[#00C776] shadow-2xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
              title="21 天微观敏捷排期视界"
            >
              🌞 日 (21天)
            </button>
            <button
              type="button"
              onClick={() => gantt.handleScaleChange("month")}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                gantt.scale === "month"
                  ? "bg-white dark:bg-slate-900 text-[#00C776] shadow-2xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
              title="12 个月中期推进视界"
            >
              📅 月 (年度推进)
            </button>
            <button
              type="button"
              onClick={() => gantt.handleScaleChange("year")}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                gantt.scale === "year"
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
              onClick={() => gantt.setOffset((d) => d - gantt.stepAmount)}
              className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer shadow-2xs transition-colors"
            >
              {gantt.prevLabel}
            </button>
            <button
              type="button"
              onClick={() => gantt.setOffset((d) => d + gantt.stepAmount)}
              className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer shadow-2xs transition-colors"
            >
              {gantt.nextLabel}
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
                                  共 {gantt.projectFilter === "all" ? projects.length : 1} 项
                                </span>
            </div>

            <div
              className="flex-1 grid divide-x divide-gray-100 dark:divide-slate-800/80 text-center"
              style={{ gridTemplateColumns: `repeat(${gantt.columns.length}, minmax(0, 1fr))` }}
            >
              {gantt.columns.map((col) => (
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
                          {(gantt.projectFilter === "all"
                            ? projects
                            : projects.filter((p) => p.id === gantt.projectFilter)
                          ).map((p) => {
              const projectThemeColor = p.color || p.statusColor || "#00C776";
              const projectTodos = getProjectTodos(p.id);
              const total = projectTodos.length;
              const done = doneCount(p.id);
              const percent = total > 0 ? Math.round((done / total) * 100) : 0;
              const isExpanded = !gantt.collapsedIds.includes(p.id); // 甘特图默认展开
              const { startIdx: pStart, span: pSpan } = gantt.calculateProjectSpan(projectTodos);

              return (
                <div key={p.id} className="group/project">
                  {/* 项目总览行 (Parent Project Bar) */}
                  <div className="flex items-center hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    {/* 左侧项目信息 */}
                    <div className="w-64 p-3 border-r border-gray-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => gantt.toggleCollapse(p.id)}
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
                          onClick={() => onEditProject(p, true)}
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
                        style={{ gridTemplateColumns: `repeat(${gantt.columns.length}, minmax(0, 1fr))` }}
                      >
                        {gantt.columns.map((col) => (
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
                          left: `${(pStart / gantt.columns.length) * 100}%`,
                          width: `${Math.max(8, (pSpan / gantt.columns.length) * 100)}%`,
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
                      const { startIdx, span } = gantt.calculateGanttPosition(t.dueDate);
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
                                onChange={() => onToggleTodo(t.id, t.done)}
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
                              style={{ gridTemplateColumns: `repeat(${gantt.columns.length}, minmax(0, 1fr))` }}
                            >
                              {gantt.columns.map((col) => (
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
                                left: `${(startIdx / gantt.columns.length) * 100}%`,
                                width: `${Math.max(gantt.scale === "day" ? 4 : 7, (span / gantt.columns.length) * 100)}%`,
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
                              onClick={() => onToggleTodo(t.id, t.done)}
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
    </div>  );
}
