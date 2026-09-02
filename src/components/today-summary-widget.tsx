"use client";

import { useNavelixData } from "@/hooks/use-navelix-data";

/** 右侧侧边栏小组件：今日摘要（待办完成度与项目进度概览） */
export default function TodaySummaryWidget() {
  const { todos, projects } = useNavelixData();

  const done = todos.filter((t) => t.done).length;
  const inProgress = projects.filter((p) =>
    ["进行", "开发", "研究", "progress"].some((k) =>
      (p.status || "").toLowerCase().includes(k),
    ),
  ).length;

  const data = {
    totalTodos: todos.length,
    doneTodos: done,
    pendingTodos: todos.length - done,
    totalProjects: projects.length,
    inProgressProjects: inProgress,
  };

  const donePct =
    data.totalTodos > 0 ? Math.round((data.doneTodos / data.totalTodos) * 100) : 0;

  return (
    <div className="rounded-2xl p-4 bg-white/90 dark:bg-slate-900/70 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-3 transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-sm">📋</span>
        <h3 className="text-xs font-black text-gray-900 dark:text-white tracking-wide">今日摘要</h3>
      </div>

      {!data.totalTodos && !data.totalProjects ? (
        <p className="py-3 text-center text-[10px] text-gray-400 dark:text-slate-500">暂无数据</p>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-500 dark:text-slate-400">待办完成度</span>
              <span className="text-[10px] font-bold text-gray-700 dark:text-slate-200">
                {data.doneTodos}/{data.totalTodos} · {donePct}%
              </span>
            </div>
            <div className="h-1 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#00C776] transition-all"
                style={{ width: `${donePct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700">
              <p className="text-[9px] text-gray-400 dark:text-slate-500">待处理</p>
              <p className="text-base font-extrabold text-gray-900 dark:text-white">{data.pendingTodos}</p>
            </div>
            <div className="p-2 rounded-lg bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700">
              <p className="text-[9px] text-gray-400 dark:text-slate-500">推进中项目</p>
              <p className="text-base font-extrabold text-gray-900 dark:text-white">
                {data.inProgressProjects}/{data.totalProjects}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
