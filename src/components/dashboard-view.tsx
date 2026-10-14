"use client";

import { useWorkspaceTodos } from "@/hooks/use-workspace-todos";


import { useTranslations } from "next-intl";
import { useState, useEffect, useMemo } from "react";
import type { Category, SiteLink, SystemConfig } from "@/types";
import { useFocusTracker } from "@/hooks/use-focus-tracker";
import { useNavelixData } from "@/context/navelix-context";
import type { LinkProbeInfo } from "@/hooks/use-link-status";
import { getStatusType } from "@/hooks/use-link-status";
import FocusStatsWidget from "./focus-stats-widget";
import {
  computeLinkAnalytics,
  computeProjectMetrics,
  computeServiceHealth,
  computeTodoMetrics,
} from "@/lib/dashboard-metrics";

interface DashboardViewProps {
  categories: Category[];
  links: SiteLink[];
  config: SystemConfig;
  statuses: Record<string, LinkProbeInfo>;
}

export default function DashboardView({
  categories,
  links,
  config,
  statuses,
}: DashboardViewProps) {
  const tx = useTranslations();
  // 1. 专注追踪数据 (Focus Tracker)
  const { totalHours, weeklyChange, dailyAverage, isPositive, weeklyData, todayMinutes } =
    useFocusTracker();

  const currentDayIdx = (new Date().getDay() + 6) % 7;
  const weekdaysLabels = [tx("mon_c430f4c1"), tx("tue_d1378a68"), tx("wed_29611689"), tx("thu_e9d3b01a"), tx("fri_572388f3"), tx("sat_f9aa11db"), tx("sun_ee239f39")];
  const maxWeeklyHours = Math.max(...weeklyData, 4);

  // 2. 项目与待办数据 (Projects & Todos) — 从 NavelixProvider 统一读取
  const { projects, todos, refreshData } = useNavelixData();

  // 3. 链路探针与服务健康度检测 (Link Status & Services)
  // statuses 由 page.tsx 统一实例化 useLinkStatus 并通过 props 注入，
  // 避免多份轮询对 /api/link-status 造成重复探测。
  const serviceHealth = useMemo(
    () => computeServiceHealth(links, statuses, Boolean(config.linkStatusEnabled)),
    [links, statuses, config.linkStatusEnabled],
  );

  // 4. 书签点击使用统计 (Usage Analytics)
  const [mounted, setMounted] = useState(false);
  const [usageMap, setUsageMap] = useState<Record<string, { count: number; lastUsed: number }>>({});

  useEffect(() => {
      queueMicrotask(() => setMounted(true));
            try {
              const raw = localStorage.getItem("navelix.link.usage");
              if (raw) {
                queueMicrotask(() => setUsageMap(JSON.parse(raw)));
              }
            } catch {
              // ignore
            }
          }, []);

  const analytics = useMemo(
    () => computeLinkAnalytics(links, usageMap, mounted),
    [links, mounted, usageMap],
  );

  // 5. 待办完成闭环率与即将到期预警 (Todos & Upcoming Deadlines)
  const todoMetrics = useMemo(() => computeTodoMetrics(todos), [todos]);

  // 6. 项目交付比率与生命周期分布 (Project Delivery & Distribution)
  const projectMetrics = useMemo(() => computeProjectMetrics(projects), [projects]);

  // 切换待办完成状态
  const { toggleTodo: handleToggleTodo } = useWorkspaceTodos();

  return (
    <div className="flex flex-col gap-6 animate-fadeIn pb-12">
      {/* ── View Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs">
        <div>
          <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
            <span>📈</span>
            <span>{tx("your_workspace_dashboard_3f5e2093")}</span>
            <span className="px-2 py-0.5 rounded-full bg-brand/10 text-brand text-[10px] font-bold border border-brand/20">
              {tx("live_overview_dc554371")}</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            {tx("track_focus_time_project_health_service_availabi_f8da2340")}</p>
        </div>

        <button
          type="button"
          onClick={() => refreshData()}
          className="px-3.5 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 text-xs font-bold border border-gray-200/80 dark:border-slate-700 transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <span>🔄</span>
          <span>{tx("refresh_24af1e94")}</span>
        </button>
      </div>

      {/* ── 专注统计（自首页侧栏迁移）── */}
      <FocusStatsWidget />

      {/* ── Top 4 Hero KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: ⏱️ 本周专注投入 */}
        <div className="bg-white dark:bg-slate-900/90 p-4.5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-slate-400 flex items-center gap-1">
              <span>⏱️</span> {tx("focus_this_week_473a9279")}</span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                isPositive
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                  : "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
              }`}
            >
              {isPositive ? `↑ ${weeklyChange}%` : `↓ ${weeklyChange}%`}
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-gray-900 dark:text-white">
              {totalHours}
            </span>
            <span className="text-xs font-bold text-gray-400 dark:text-slate-500">
              {tx("hours_3b6fefc5")}</span>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
            {tx("today_5a645296")}{todayMinutes} {tx("min_daily_average_89e2aa5d")}{dailyAverage}h
          </p>
        </div>

        {/* KPI 2: 📋 待办交付闭环率 */}
        <div className="bg-white dark:bg-slate-900/90 p-4.5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-slate-400 flex items-center gap-1">
              <span>📋</span> {tx("task_completion_rate_54729bb5")}</span>
            <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400 text-[10px] font-bold">
              {todoMetrics.rate}{tx("achieved_e9a45d1e")}</span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-sky-600 dark:text-sky-400">
              {todoMetrics.completed}
            </span>
            <span className="text-xs font-bold text-gray-400 dark:text-slate-500">
              / {todos.length} {tx("items_49ccde43")}</span>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
            {tx("still_41d048b9")}{todoMetrics.pending} {tx("pending_actions_ad497ca9")}</p>
        </div>

        {/* KPI 3: 🗂️ 项目健康度 */}
        <div className="bg-white dark:bg-slate-900/90 p-4.5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-slate-400 flex items-center gap-1">
              <span>🗂️</span> {tx("project_health_2d6cb08f")}</span>
            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 text-[10px] font-bold">
              {projectMetrics.inProgress} {tx("in_progress_139b261e")}</span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
              {projectMetrics.deliveryRate}%
            </span>
            <span className="text-xs font-bold text-gray-400 dark:text-slate-500">
              {tx("delivery_rate_281ad0c3")}</span>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
            {tx("completed_58de3aa7")}{projectMetrics.completed} {tx("items_total_projects_67b5d7da")}{projects.length} {tx("items_3a116815")}</p>
        </div>

        {/* KPI 4: 🛡️ 服务可用性 */}
        <div className="bg-white dark:bg-slate-900/90 p-4.5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-slate-400 flex items-center gap-1">
              <span>🛡️</span> {tx("service_availability_a1b431ee")}</span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                serviceHealth.offline > 0
                  ? "bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400 animate-pulse"
                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
              }`}
            >
              {serviceHealth.offline > 0
                ? tx("message_70e9c4be7a80", {v0: serviceHealth.offline})
                : tx("all_healthy_659cffc7")}
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-brand">
              {serviceHealth.uptimeRate}%
            </span>
            <span className="text-xs font-bold text-gray-400 dark:text-slate-500">
              {tx("availability_62907046")}</span>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
            {tx("checked_0f766cf9")}{serviceHealth.totalProbed} {tx("network_services_e06747fe")}</p>
        </div>
      </div>

      {/* ── Row 1: 个人周专注趋势图 + 基础设施自建服务健康度大盘 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 1.1 ⏱️ 周专注时长可视化趋势图 (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
              <span>📊</span>
              <span>{tx("weekly_focus_time_investment_67c62a88")}</span>
            </h3>
            <span className="text-[11px] font-bold text-gray-400 dark:text-slate-400">
              {tx("last_7_days_h_832b78bd")}</span>
          </div>

          {/* Bar Chart */}
          <div className="flex items-end justify-between gap-3 h-40 pt-4 pb-2 px-2 border-b border-gray-100 dark:border-slate-800">
            {weeklyData.map((hours, idx) => {
              const heightPercent =
                maxWeeklyHours > 0 ? Math.round((hours / maxWeeklyHours) * 100) : 0;
              const isToday = idx === currentDayIdx;

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <span className="text-[10px] font-bold text-gray-400 group-hover:text-brand transition-colors">
                    {hours > 0 ? `${hours}h` : "0"}
                  </span>
                  <div className="w-full max-w-[28px] bg-gray-100 dark:bg-slate-800 rounded-t-lg overflow-hidden h-full flex items-end">
                    <div
                      className={`w-full rounded-t-lg transition-all duration-500 ${
                        isToday
                          ? "bg-gradient-to-t from-brand to-teal-400 shadow-xs"
                          : "bg-emerald-200 dark:bg-emerald-900/60 group-hover:bg-brand"
                      }`}
                      style={{ height: `${Math.max(heightPercent, 6)}%` }}
                    />
                  </div>
                  <span
                    className={`text-[11px] font-bold ${
                      isToday
                        ? "text-brand"
                        : "text-gray-500 dark:text-slate-400"
                    }`}
                  >
                    {weekdaysLabels[idx]}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-3 text-[11px] text-gray-500 dark:text-slate-400">
            <span>{tx("highlighted_bar_shows_today_s_focus_time_aa9c4efa")}</span>
            <span>{tx("suggested_daily_target_4_0_hours_348156d0")}</span>
          </div>
        </div>

        {/* 1.2 🛡️ 基础设施与自建服务探针监控大盘 (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
              <span>🛡️</span>
              <span>{tx("infrastructure_service_availability_1e031c11")}</span>
            </h3>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
              {config.linkStatusEnabled ? tx("probes_running_10514361") : tx("probes_paused_e2cfeaa6")}
            </span>
          </div>

          <div className="flex flex-col gap-2 flex-1 max-h-52 overflow-y-auto pr-1">
            {serviceHealth.probedList.length === 0 ? (
              <div className="py-8 flex items-center justify-center text-xs text-gray-400">
                {tx("no_probe_services_configured_aeb910f9")}</div>
            ) : (
              serviceHealth.probedList.map((l) => {
                const s = getStatusType(statuses[l.id]);
                const rawInfo = typeof statuses[l.id] === "object" ? statuses[l.id] : undefined;
                const latency = rawInfo?.latencyMs;
                return (
                  <div
                    key={l.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-gray-50/80 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          s === "online"
                            ? "bg-emerald-500 animate-pulse"
                            : s === "slow"
                            ? "bg-amber-400"
                            : s === "offline"
                            ? "bg-red-500"
                            : "bg-sky-400"
                        }`}
                      />
                      <span className="truncate text-xs font-bold text-gray-800 dark:text-slate-200">
                        {l.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {typeof latency === "number" && (
                        <span className="text-[10px] font-mono text-gray-400">
                          {latency}ms
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          s === "online"
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : s === "slow"
                            ? "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300"
                            : s === "offline"
                            ? "bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300"
                            : "bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {s === "online" ? tx("online_b9086662") : s === "slow" ? tx("slow_002b4b0b") : s === "offline" ? tx("offline_be1b4f3c") : tx("probing_0c92f0e5")}
                      </span>
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-brand text-xs transition-colors"
                      >
                        ↗
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <p className="text-[10px] text-gray-400 dark:text-slate-500 pt-2 border-t border-gray-100 dark:border-slate-800">
            {tx("automatic_check_interval_437e831f")}{config.linkStatusInterval || 60}{tx("s_automatic_alert_indicators_5f4a1f1a")}</p>
        </div>
      </div>

      {/* ── Row 2: 临近到期待办预警 + 项目生命周期分布 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 2.1 ⚠️ 临近截止日与高优待办预警 (6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
              <span>⚠️</span>
              <span>{tx("upcoming_high_priority_tasks_a6eb3ba2")}</span>
            </h3>
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
              {todoMetrics.urgentOrUpcoming.length} {tx("key_items_1f8a4caa")}</span>
          </div>

          <div className="flex flex-col gap-2 flex-1 max-h-56 overflow-y-auto pr-1">
            {todoMetrics.urgentOrUpcoming.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-xs text-gray-400 gap-1">
                <span>✨</span>
                <span>{tx("no_urgent_or_upcoming_tasks_all_clear_8e8bd4ca")}</span>
              </div>
            ) : (
              todoMetrics.urgentOrUpcoming.map((item) => (
                <div
                  key={`${item.ownerId ?? ""}:${item.id}`}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/80 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => handleToggleTodo(item.id, item.done, item.ownerId)}
                      className="w-4 h-4 rounded text-brand focus:ring-brand border-gray-300 dark:border-slate-600 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-gray-800 dark:text-slate-200 truncate">
                        {item.title}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.priority === "high" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/50">
                        {tx("high_323a1d5c")}</span>
                    )}
                    {item.dueDate && (
                      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        {item.dueDate === todoMetrics.todayStr
                          ? tx("due_today_87b9b659")
                          : item.dueDate.slice(5)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <p className="text-[10px] text-gray-400 dark:text-slate-500 pt-2 border-t border-gray-100 dark:border-slate-800">
            {tx("check_a_task_to_mark_it_complete_immediately_1fb031f8")}</p>
        </div>

        {/* 2.2 🗂️ 项目全景交付比率与阶段分布 (6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
              <span>🗂️</span>
              <span>{tx("project_lifecycle_distribution_da4eedb3")}</span>
            </h3>
            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">
              {tx("total_76e547a8")}{projectMetrics.total} {tx("projects_5e7e8850")}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-2">
            <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 text-center">
              <span className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                {tx("in_progress_dc9591e5")}</span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                {projectMetrics.inProgress}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/40 text-center">
              <span className="block text-[11px] font-bold text-purple-700 dark:text-purple-300">
                {tx("delivered_624ecd84")}</span>
              <span className="text-xl font-black text-purple-600 dark:text-purple-400">
                {projectMetrics.completed}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-sky-50/60 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/40 text-center">
              <span className="block text-[11px] font-bold text-sky-700 dark:text-sky-300">
                {tx("research_69f307d7")}</span>
              <span className="text-xl font-black text-sky-600 dark:text-sky-400">
                {projectMetrics.research}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 text-center">
              <span className="block text-[11px] font-bold text-amber-700 dark:text-amber-300">
                {tx("maintenance_d7021d9f")}</span>
              <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                {projectMetrics.maintenance}
              </span>
            </div>
          </div>

          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px] font-bold text-gray-500 dark:text-slate-400">
              <span>{tx("overall_project_completion_c7932462")}</span>
              <span className="text-purple-600 dark:text-purple-400">
                {projectMetrics.deliveryRate}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                style={{ width: `${projectMetrics.deliveryRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 3: 资产分类占比分布 + 最常访问书签排行 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Breakdown (6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs">
          <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>📂</span>
            <span>{tx("digital_assets_by_category_32e1c11b")}</span>
          </h3>

          <div className="flex flex-col gap-3">
            {categories.map((cat) => {
              const catLinks = links.filter((l) => l.category === cat.id);
              const percentage = links.length
                ? Math.round((catLinks.length / links.length) * 100)
                : 0;

              return (
                <div key={cat.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span>{cat.icon || "📁"}</span>
                      <span>{cat.name}</span>
                    </span>
                    <span className="text-gray-400 font-medium">
                      {catLinks.length} {tx("items_c3c813b8")}{percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: cat.color || "#00C776",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Clicked Links (6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs">
          <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>🔥</span>
            <span>{tx("most_visited_bookmarks_c3238529")}</span>
          </h3>

          <div className="flex flex-col gap-2">
            {analytics.rankedLinks.slice(0, 6).map((item, idx) => (
              <div
                key={item.link.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                      idx === 0
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300"
                        : idx === 1
                        ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                        : idx === 2
                        ? "bg-amber-900/20 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                        : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-xs font-semibold text-gray-800 dark:text-slate-200 truncate max-w-[200px]">
                    {item.link.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-brand">
                    {item.clicks} {tx("clicks_de6122e0")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
