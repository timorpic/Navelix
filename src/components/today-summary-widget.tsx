"use client";

import { useTranslations } from "next-intl";
import { useNavelixData } from "@/context/navelix-context";

/** 右侧侧边栏小组件：今日摘要（待办完成度与项目进度概览） */
export default function TodaySummaryWidget() {
  const tx = useTranslations();
  const { todos, projects } = useNavelixData();

  const done = todos.filter((t) => t.done).length;
  const inProgress = projects.filter((p) =>
    [tx("in_progress_760aa168"), tx("development_9ec42862"), tx("research_4ff0f1dd"), "progress"].some((k) =>
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
        <h3 className="text-xs font-black text-gray-900 dark:text-white tracking-wide">{tx("today_s_summary_8d124959")}</h3>
      </div>

      {!data.totalTodos && !data.totalProjects ? (
        <p className="py-3 text-center text-[10px] text-gray-400 dark:text-slate-500">{tx("no_data_yet_497c8569")}</p>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-500 dark:text-slate-400">{tx("todo_completion_1e72911d")}</span>
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
              <p className="text-[9px] text-gray-400 dark:text-slate-500">{tx("pending_999a459c")}</p>
              <p className="text-base font-extrabold text-gray-900 dark:text-white">{data.pendingTodos}</p>
            </div>
            <div className="p-2 rounded-lg bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700">
              <p className="text-[9px] text-gray-400 dark:text-slate-500">{tx("active_projects_fce78671")}</p>
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
