"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Category, Project, SiteLink, SystemConfig, TodoItem } from "@/types";
import { toLocalDateStr } from "@/lib/date-utils";
import { useFocusTracker } from "@/hooks/use-focus-tracker";
import { useLinkStatus, getStatusType } from "@/hooks/use-link-status";
import FocusStatsWidget from "./focus-stats-widget";

interface DashboardViewProps {
  categories: Category[];
  links: SiteLink[];
  config: SystemConfig;
}

export default function DashboardView({
  categories,
  links,
  config,
}: DashboardViewProps) {
  // 1. 专注追踪数据 (Focus Tracker)
  const { totalHours, weeklyChange, dailyAverage, isPositive, weeklyData } =
    useFocusTracker();

  const currentDayIdx = (new Date().getDay() + 6) % 7;
  const todayFocus = weeklyData[currentDayIdx] || 0;
  const weekdaysLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const maxWeeklyHours = Math.max(...weeklyData, 4);

  // 2. 项目与待办数据 (Projects & Todos)
  const [projects, setProjects] = useState<Project[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);

  const fetchWorkspaceData = useCallback(async () => {
    try {
      const [pRes, tRes] = await Promise.all([
        fetch("/api/projects").catch(() => null),
        fetch("/api/todos").catch(() => null),
      ]);
      if (pRes && pRes.ok) {
        const pData = await pRes.json();
        if (Array.isArray(pData.projects)) setProjects(pData.projects);
      }
      if (tRes && tRes.ok) {
        const tData = await tRes.json();
        if (Array.isArray(tData.todos)) setTodos(tData.todos);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchWorkspaceData();
    });
    const handleUpdate = () => fetchWorkspaceData();
    window.addEventListener("navelix-workspace-updated", handleUpdate);
    window.addEventListener("focus", handleUpdate);
    return () => {
      window.removeEventListener("navelix-workspace-updated", handleUpdate);
      window.removeEventListener("focus", handleUpdate);
    };
  }, [fetchWorkspaceData]);

  // 3. 链路探针与服务健康度检测 (Link Status & Services)
  const { statuses } = useLinkStatus(
    config.linkStatusEnabled ? links : [],
    (config.linkStatusInterval || 60) * 1000,
  );

  const serviceHealth = useMemo(() => {
    const probedLinks = links.filter((l) => l.url.startsWith("http"));
    let online = 0;
    let offline = 0;
    let pending = 0;

    for (const l of probedLinks) {
      const s = getStatusType(statuses[l.id]);
      if (s === "online" || s === "slow") online++;
      else if (s === "offline") offline++;
      else pending++;
    }

    const uptimeRate = config.linkStatusEnabled
      ? Math.round((online / (online + offline || 1)) * 100)
      : 100;

    return {
      totalProbed: probedLinks.length,
      online,
      offline,
      pending,
      uptimeRate,
      probedList: probedLinks.slice(0, 8),
    };
  }, [links, statuses, config.linkStatusEnabled]);

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

  const analytics = useMemo(() => {
    const map = mounted ? usageMap : {};
    const totalClicks = Object.values(map).reduce(
      (sum, u) => sum + u.count,
      0,
    );

    const rankedLinks = links
      .map((l) => ({
        link: l,
        clicks: map[l.id]?.count || 0,
        lastUsed: map[l.id]?.lastUsed || 0,
      }))
      .sort((a, b) => b.clicks - a.clicks);

    const quickAccessCount = links.filter((l) => l.isQuickAccess).length;

    return {
      totalClicks,
      rankedLinks,
      quickAccessCount,
    };
  }, [links, mounted, usageMap]);

  // 5. 待办完成闭环率与即将到期预警 (Todos & Upcoming Deadlines)
  const todoMetrics = useMemo(() => {
    const completed = todos.filter((t) => t.done).length;
    const pending = todos.filter((t) => !t.done).length;
    const total = todos.length || 1;
    const rate = Math.round((completed / total) * 100);

    const todayStr = toLocalDateStr();
    const urgentOrUpcoming = todos
      .filter((t) => !t.done)
      .sort((a, b) => {
        if (a.priority === "high" && b.priority !== "high") return -1;
        if (b.priority === "high" && a.priority !== "high") return 1;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        return 0;
      })
      .slice(0, 5);

    return {
      completed,
      pending,
      rate,
      urgentOrUpcoming,
      todayStr,
    };
  }, [todos]);

  // 6. 项目交付比率与生命周期分布 (Project Delivery & Distribution)
  const projectMetrics = useMemo(() => {
    const total = projects.length || 1;
    const inProgress = projects.filter(
      (p) =>
        (p.status || "").includes("进行") ||
        (p.status || "").includes("开发") ||
        (p.status || "").toLowerCase().includes("progress"),
    ).length;
    const completed = projects.filter(
      (p) => p.status === "已完成" || (p.status || "").includes("完成"),
    ).length;
    const research = projects.filter(
      (p) => p.status === "研究中" || (p.status || "").includes("研究"),
    ).length;
    const maintenance = projects.filter(
      (p) => p.status === "维护中" || (p.status || "").includes("维护"),
    ).length;

    const deliveryRate = Math.round((completed / total) * 100);

    return {
      total: projects.length,
      inProgress,
      completed,
      research,
      maintenance,
      deliveryRate,
    };
  }, [projects]);

  // 切换待办完成状态
  const handleToggleTodo = async (id: string, done: boolean) => {
    try {
      await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !done }),
      });
      window.dispatchEvent(new CustomEvent("navelix-workspace-updated"));
      fetchWorkspaceData();
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn pb-12">
      {/* ── View Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs">
        <div>
          <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
            <span>📈</span>
            <span>全景数字化工作空间看板</span>
            <span className="px-2 py-0.5 rounded-full bg-[#00C776]/10 text-[#00C776] text-[10px] font-bold border border-[#00C776]/20">
              实时驾驶舱
            </span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            全景监控个人效能投入、项目健康度、自建服务可用性、待办预警与数字资产分布
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchWorkspaceData()}
          className="px-3.5 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 text-xs font-bold border border-gray-200/80 dark:border-slate-700 transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <span>🔄</span>
          <span>同步刷新</span>
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
              <span>⏱️</span> 本周专注投入
            </span>
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
              小时
            </span>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
            今日投入 {todayFocus}h · 日均 {dailyAverage}h
          </p>
        </div>

        {/* KPI 2: 📋 待办交付闭环率 */}
        <div className="bg-white dark:bg-slate-900/90 p-4.5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-slate-400 flex items-center gap-1">
              <span>📋</span> 待办闭环率
            </span>
            <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400 text-[10px] font-bold">
              {todoMetrics.rate}% 达成
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-sky-600 dark:text-sky-400">
              {todoMetrics.completed}
            </span>
            <span className="text-xs font-bold text-gray-400 dark:text-slate-500">
              / {todos.length} 项
            </span>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
            当前仍有 {todoMetrics.pending} 项待处理行动
          </p>
        </div>

        {/* KPI 3: 🗂️ 项目健康度 */}
        <div className="bg-white dark:bg-slate-900/90 p-4.5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-slate-400 flex items-center gap-1">
              <span>🗂️</span> 项目健康度
            </span>
            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 text-[10px] font-bold">
              {projectMetrics.inProgress} 个进行中
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
              {projectMetrics.deliveryRate}%
            </span>
            <span className="text-xs font-bold text-gray-400 dark:text-slate-500">
              交付率
            </span>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
            已闭环 {projectMetrics.completed} 项 · 总项目 {projects.length} 个
          </p>
        </div>

        {/* KPI 4: 🛡️ 服务可用性 */}
        <div className="bg-white dark:bg-slate-900/90 p-4.5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-slate-400 flex items-center gap-1">
              <span>🛡️</span> 服务可用性
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                serviceHealth.offline > 0
                  ? "bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400 animate-pulse"
                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
              }`}
            >
              {serviceHealth.offline > 0
                ? `${serviceHealth.offline} 项异常`
                : "全部正常"}
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-[#00C776]">
              {serviceHealth.uptimeRate}%
            </span>
            <span className="text-xs font-bold text-gray-400 dark:text-slate-500">
              存活率
            </span>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
            已探活 {serviceHealth.totalProbed} 处网络服务
          </p>
        </div>
      </div>

      {/* ── Row 1: 个人周专注趋势图 + 基础设施自建服务健康度大盘 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 1.1 ⏱️ 周专注时长可视化趋势图 (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
              <span>📊</span>
              <span>周专注时长与精力投入趋势</span>
            </h3>
            <span className="text-[11px] font-bold text-gray-400 dark:text-slate-400">
              近 7 日分布 (h)
            </span>
          </div>

          {/* Bar Chart */}
          <div className="flex items-end justify-between gap-3 h-40 pt-4 pb-2 px-2 border-b border-gray-100 dark:border-slate-800">
            {weeklyData.map((hours, idx) => {
              const heightPercent =
                maxWeeklyHours > 0 ? Math.round((hours / maxWeeklyHours) * 100) : 0;
              const isToday = idx === currentDayIdx;

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <span className="text-[10px] font-bold text-gray-400 group-hover:text-[#00C776] transition-colors">
                    {hours > 0 ? `${hours}h` : "0"}
                  </span>
                  <div className="w-full max-w-[28px] bg-gray-100 dark:bg-slate-800 rounded-t-lg overflow-hidden h-full flex items-end">
                    <div
                      className={`w-full rounded-t-lg transition-all duration-500 ${
                        isToday
                          ? "bg-gradient-to-t from-[#00C776] to-teal-400 shadow-xs"
                          : "bg-emerald-200 dark:bg-emerald-900/60 group-hover:bg-[#00C776]"
                      }`}
                      style={{ height: `${Math.max(heightPercent, 6)}%` }}
                    />
                  </div>
                  <span
                    className={`text-[11px] font-bold ${
                      isToday
                        ? "text-[#00C776]"
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
            <span>🟢 高亮柱代表今天投入</span>
            <span>日均建议目标：4.0 小时</span>
          </div>
        </div>

        {/* 1.2 🛡️ 基础设施与自建服务探针监控大盘 (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
              <span>🛡️</span>
              <span>基础设施与服务可用性</span>
            </h3>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
              {config.linkStatusEnabled ? "探针运行中" : "探针已暂停"}
            </span>
          </div>

          <div className="flex flex-col gap-2 flex-1 max-h-52 overflow-y-auto pr-1">
            {serviceHealth.probedList.length === 0 ? (
              <div className="py-8 flex items-center justify-center text-xs text-gray-400">
                暂无配置探针服务
              </div>
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
                        {s === "online" ? "在线" : s === "slow" ? "缓慢" : s === "offline" ? "离线" : "探测中"}
                      </span>
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-[#00C776] text-xs transition-colors"
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
            自动检测间隔：{config.linkStatusInterval || 60}s · 智能异常标记
          </p>
        </div>
      </div>

      {/* ── Row 2: 临近到期待办预警 + 项目生命周期分布 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 2.1 ⚠️ 临近截止日与高优待办预警 (6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
              <span>⚠️</span>
              <span>临近截止与高优先待办预警</span>
            </h3>
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
              {todoMetrics.urgentOrUpcoming.length} 项关键事项
            </span>
          </div>

          <div className="flex flex-col gap-2 flex-1 max-h-56 overflow-y-auto pr-1">
            {todoMetrics.urgentOrUpcoming.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-xs text-gray-400 gap-1">
                <span>✨</span>
                <span>当前无紧急或临近截止待办，状态极佳</span>
              </div>
            ) : (
              todoMetrics.urgentOrUpcoming.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/80 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => handleToggleTodo(item.id, item.done)}
                      className="w-4 h-4 rounded text-[#00C776] focus:ring-[#00C776] border-gray-300 dark:border-slate-600 cursor-pointer"
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
                        高优
                      </span>
                    )}
                    {item.dueDate && (
                      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        {item.dueDate === todoMetrics.todayStr
                          ? "今日截止"
                          : item.dueDate.slice(5)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <p className="text-[10px] text-gray-400 dark:text-slate-500 pt-2 border-t border-gray-100 dark:border-slate-800">
            勾选即可在看板中即时闭环任务
          </p>
        </div>

        {/* 2.2 🗂️ 项目全景交付比率与阶段分布 (6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
              <span>🗂️</span>
              <span>项目全生命周期阶段分布</span>
            </h3>
            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">
              共 {projectMetrics.total} 个项目
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-2">
            <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 text-center">
              <span className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                进行中
              </span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                {projectMetrics.inProgress}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/40 text-center">
              <span className="block text-[11px] font-bold text-purple-700 dark:text-purple-300">
                已交付
              </span>
              <span className="text-xl font-black text-purple-600 dark:text-purple-400">
                {projectMetrics.completed}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-sky-50/60 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/40 text-center">
              <span className="block text-[11px] font-bold text-sky-700 dark:text-sky-300">
                研究中
              </span>
              <span className="text-xl font-black text-sky-600 dark:text-sky-400">
                {projectMetrics.research}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 text-center">
              <span className="block text-[11px] font-bold text-amber-700 dark:text-amber-300">
                维护中
              </span>
              <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                {projectMetrics.maintenance}
              </span>
            </div>
          </div>

          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px] font-bold text-gray-500 dark:text-slate-400">
              <span>项目整体完工比率</span>
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
            <span>数字资产分类分布</span>
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
                      {catLinks.length} 项 ({percentage}%)
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
            <span>最常访问书签排行</span>
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
                  <span className="text-xs font-bold text-[#00C776]">
                    {item.clicks} 次点击
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
