"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import type { SiteLink } from "@/types";
import Modal from "./modal";

export type ActivitySource =
  | "all"
  | "api"
  | "calendar"
  | "project"
  | "system"
  | "link";

export type TimeRangePreset = "all" | "today" | "3d" | "7d" | "30d" | "custom";

interface ActivityItem {
  id: string;
  rawId: string;
  source: ActivitySource;
  sourceLabel: string;
  sourceBadgeClass: string;
  title: string;
  detail?: string;
  url?: string;
  icon: string;
  ts: number;
}

function renderActivityIcon(icon: string, className = "w-4 h-4") {
  if (!icon) return <span className="text-sm shrink-0">📌</span>;
  if (
    icon.startsWith("data:image/") ||
    icon.startsWith("http://") ||
    icon.startsWith("https://") ||
    icon.startsWith("/")
  ) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={icon}
        alt=""
        className={`${className} rounded object-contain shrink-0`}
      />
    );
  }
  return <span className="text-sm shrink-0 mt-0.5">{icon}</span>;
}

// 统一解析来源类型与徽标样式
function resolveActivitySource(
  rawSource?: string,
  title: string = "",
  content: string = "",
): {
  source: ActivitySource;
  label: string;
  badgeClass: string;
  defaultIcon: string;
} {
  const s = (rawSource || "").toLowerCase().trim();
  const text = `${title} ${content}`.toLowerCase();

  if (
    s === "api" ||
    s === "external" ||
    s === "webhook" ||
    text.includes("docker") ||
    text.includes("github actions") ||
    text.includes("webhook") ||
    text.includes("ci/cd") ||
    text.includes("api 推送") ||
    text.includes("外部推送") ||
    title.includes("🐳")
  ) {
    return {
      source: "api",
      label: "API推送",
      badgeClass:
        "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800",
      defaultIcon: "🌐",
    };
  }

  if (
    s === "calendar" ||
    s === "todo" ||
    s === "agenda" ||
    text.includes("日程") ||
    text.includes("待办") ||
    text.includes("日历") ||
    title.includes("📅")
  ) {
    return {
      source: "calendar",
      label: "日历日程",
      badgeClass:
        "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800",
      defaultIcon: "📅",
    };
  }

  if (
    s === "project" ||
    s === "projects" ||
    text.includes("项目") ||
    text.includes("project") ||
    title.includes("🗂️") ||
    title.includes("🚀")
  ) {
    return {
      source: "project",
      label: "项目管理",
      badgeClass:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800",
      defaultIcon: "🗂️",
    };
  }



  if (
    s === "link" ||
    s === "bookmark" ||
    s === "visit"
  ) {
    return {
      source: "link",
      label: "快捷访问",
      badgeClass:
        "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800",
      defaultIcon: "🔗",
    };
  }

  // 默认：系统设置
  return {
    source: "system",
    label: "系统设置",
    badgeClass:
      "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200/50 dark:border-teal-800",
    defaultIcon: "⚙️",
  };
}

function formatExactTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const date = pad(d.getDate());
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  const secs = pad(d.getSeconds());
  return `${year}-${month}-${date} ${hours}:${mins}:${secs}`;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = 60_000,
    hour = 60 * min,
    day = 24 * hour;
  if (diff < min) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / min)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  return new Date(ts).toLocaleDateString("zh-CN");
}

export default function RecentActivitiesCard({ links }: { links: SiteLink[] }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. 多维过滤状态 (Multi-dimensional Filter States)
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSource, setFilterSource] = useState<ActivitySource>("all");
  const [timeRange, setTimeRange] = useState<TimeRangePreset>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [nowTimestamp, setNowTimestamp] = useState(() => 0);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);

  // 2. 批量选择与分页状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 3. 模态框与操作状态
  const [selectedDetailItem, setSelectedDetailItem] = useState<ActivityItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [batchDeleting, setBatchDeleting] = useState(false);

  // 4. 读取数据 (Read)
  const loadActivities = useCallback(async () => {
    try {
      // 4.1 系统通知与操作日志（/api/notifications）
      let notifs: ActivityItem[] = [];
      try {
        const notifRes = await fetch("/api/notifications");
        if (notifRes.ok) {
          const notifData = await notifRes.json();
          notifs = (notifData.notifications || []).map(
            (n: {
              id: string;
              title: string;
              content: string;
              source?: string;
              createdAt: number;
            }) => {
              const meta = resolveActivitySource(n.source, n.title, n.content);
              let icon = meta.defaultIcon;
              if (n.title.includes("Docker") || n.title.includes("🐳")) icon = "🐳";
              else if (n.title.includes("服务器") || n.title.includes("🖥️")) icon = "🖥️";
              else if (n.title.includes("备份") || n.title.includes("还原")) icon = "💾";
              else if (n.title.includes("密钥") || n.title.includes("令牌")) icon = "🔐";
              else if (n.title.includes("告警") || n.title.includes("负载")) icon = "⚠️";
              else if (n.title.includes("快捷访问") || n.title.includes("置顶")) icon = "📌";

              return {
                id: `n-${n.id}`,
                rawId: n.id,
                source: meta.source,
                sourceLabel: meta.label,
                sourceBadgeClass: meta.badgeClass,
                title: n.title,
                detail: n.content,
                icon,
                ts: n.createdAt,
              };
            },
          );
        }
      } catch {
        // ignore
      }

      // 4.2 链接访问与点击记录（localStorage: navelix.link.usage）
      const linkActivities: ActivityItem[] = [];
      try {
        const raw = localStorage.getItem("navelix.link.usage");
        const usage: Record<string, { count: number; lastUsed: number }> = raw
          ? JSON.parse(raw)
          : {};
        for (const [id, u] of Object.entries(usage)) {
          const link = links.find((l) => l.id === id);
          if (link) {
            const meta = resolveActivitySource("link", link.title, link.url);
            linkActivities.push({
              id: `l-${id}`,
              rawId: id,
              source: "link",
              sourceLabel: meta.label,
              sourceBadgeClass: meta.badgeClass,
              title: `访问 ${link.title}`,
              detail: link.url,
              url: link.url,
              icon: link.icon || "🔗",
              ts: u.lastUsed,
            });
          }
        }
      } catch {
        // ignore
      }

      // 4.3 汇总合并与排序（按时间倒序）
      const merged = [...notifs, ...linkActivities].sort((a, b) => b.ts - a.ts);
      setItems(merged);
      setNowTimestamp(Date.now());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [links]);

  useEffect(() => {
    queueMicrotask(() => {
      loadActivities();
    });
    const handleUpdate = () => loadActivities();
    window.addEventListener("navelix-link-clicked", handleUpdate);
    return () => window.removeEventListener("navelix-link-clicked", handleUpdate);
  }, [loadActivities]);

  // 重置所有筛选条件 (Reset All Filters)
  const handleResetFilters = () => {
    setSearchQuery("");
    setFilterSource("all");
    setTimeRange("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setCurrentPage(1);
  };

  const isFilterActive = useMemo(() => {
    return (
      Boolean(searchQuery.trim()) ||
      filterSource !== "all" ||
      timeRange !== "all" ||
      Boolean(customStartDate) ||
      Boolean(customEndDate)
    );
  }, [searchQuery, filterSource, timeRange, customStartDate, customEndDate]);

  // 多条件组合联合筛选 (Combined Multi-dimensional Filtering)
  const filteredItems = useMemo(() => {
    const now = nowTimestamp || 0;
    const oneDay = 24 * 60 * 60 * 1000;

    return items.filter((item) => {
      // 1. 来源筛选
      if (filterSource !== "all" && item.source !== filterSource) {
        return false;
      }

      // 2. 关键字搜索 (标题、内容、来源)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDetail = (item.detail || "").toLowerCase().includes(q);
        const matchSource = item.sourceLabel.toLowerCase().includes(q);
        if (!matchTitle && !matchDetail && !matchSource) return false;
      }

      // 3. 时间范围筛选
      if (timeRange === "today") {
        const itemDate = new Date(item.ts).toDateString();
        const todayDate = new Date(now).toDateString();
        if (itemDate !== todayDate) return false;
      } else if (timeRange === "3d") {
        if (now - item.ts > 3 * oneDay) return false;
      } else if (timeRange === "7d") {
        if (now - item.ts > 7 * oneDay) return false;
      } else if (timeRange === "30d") {
        if (now - item.ts > 30 * oneDay) return false;
      } else if (timeRange === "custom") {
        if (customStartDate) {
          const startTs = new Date(`${customStartDate}T00:00:00`).getTime();
          if (item.ts < startTs) return false;
        }
        if (customEndDate) {
          const endTs = new Date(`${customEndDate}T23:59:59`).getTime();
          if (item.ts > endTs) return false;
        }
      }

      return true;
    });
  }, [
    items,
    filterSource,
    searchQuery,
    timeRange,
    customStartDate,
    customEndDate,
    nowTimestamp,
  ]);

  // 各来源实时统计数量
  const counts = useMemo(() => {
    const total = items.length;
    const api = items.filter((i) => i.source === "api").length;
    const calendar = items.filter((i) => i.source === "calendar").length;
    const project = items.filter((i) => i.source === "project").length;
    const system = items.filter((i) => i.source === "system").length;
    const link = items.filter((i) => i.source === "link").length;
    return { total, api, calendar, project, system, link };
  }, [items]);

  // 分页数据截取
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // 多选逻辑
  const isAllSelected =
    paginatedItems.length > 0 &&
    paginatedItems.every((item) => selectedIds.has(item.id));

  const handleToggleSelectAll = () => {
    const next = new Set(selectedIds);
    if (isAllSelected) {
      for (const item of paginatedItems) {
        next.delete(item.id);
      }
    } else {
      for (const item of paginatedItems) {
        next.add(item.id);
      }
    }
    setSelectedIds(next);
  };

  const handleToggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // 单条删除
  const handleDeleteItem = async (item: ActivityItem) => {
    if (!confirm(`确定要删除记录 “${item.title}” 吗？`)) return;
    setDeletingId(item.id);
    try {
      if (item.source === "link") {
        try {
          const raw = localStorage.getItem("navelix.link.usage");
          if (raw) {
            const usage = JSON.parse(raw);
            delete usage[item.rawId];
            localStorage.setItem("navelix.link.usage", JSON.stringify(usage));
          }
        } catch {
          // ignore
        }
      } else {
        await fetch(`/api/notifications/${item.rawId}`, { method: "DELETE" });
      }
      await loadActivities();
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  };

  // 批量删除所选项
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要批量删除选中的 ${selectedIds.size} 条记录吗？`)) return;
    setBatchDeleting(true);
    try {
      const selectedItems = items.filter((i) => selectedIds.has(i.id));
      for (const item of selectedItems) {
        if (item.source === "link") {
          try {
            const raw = localStorage.getItem("navelix.link.usage");
            if (raw) {
              const usage = JSON.parse(raw);
              delete usage[item.rawId];
              localStorage.setItem("navelix.link.usage", JSON.stringify(usage));
            }
          } catch {
            // ignore
          }
        } else {
          await fetch(`/api/notifications/${item.rawId}`, { method: "DELETE" });
        }
      }
      setSelectedIds(new Set());
      await loadActivities();
    } catch {
      // ignore
    } finally {
      setBatchDeleting(false);
    }
  };

  // 清空全部记录
  const handleClearAll = async () => {
    if (!confirm("⚠️ 确定要清空全部活动记录吗？此操作无法撤销。")) return;
    try {
      await fetch("/api/notifications", { method: "DELETE" });
      localStorage.removeItem("navelix.link.usage");
      setSelectedIds(new Set());
      await loadActivities();
    } catch {
      // ignore
    }
  };

  // 来源标签列表
  const sourceTabs: { id: ActivitySource; label: string; count: number; icon: string }[] = [
    { id: "all", label: "全部来源", count: counts.total, icon: "⚡" },
    { id: "api", label: "API推送", count: counts.api, icon: "🌐" },
    { id: "calendar", label: "日历日程", count: counts.calendar, icon: "📅" },
    { id: "project", label: "项目管理", count: counts.project, icon: "🗂️" },
    { id: "system", label: "系统设置", count: counts.system, icon: "⚙️" },
    { id: "link", label: "快捷访问", count: counts.link, icon: "🔗" },
  ];

  return (
    <div className="flex flex-col bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-colors mt-5">
      {/* 1. 头部标题栏与全局操作 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-slate-700/60">
        <div className="flex items-center gap-2.5">
          <span className="text-base">🔔</span>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>消息通知与活动动态</span>
              <span className="px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-[#00C776] text-[10px] font-bold">
                共 {items.length} 条
              </span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 高级筛选展开切换 */}
          <button
            type="button"
            onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              showAdvancedFilter || isFilterActive
                ? "border-[#00C776] bg-emerald-50/60 text-[#00C776] dark:bg-emerald-950/40"
                : "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
            }`}
          >
            <span>⚙️</span>
            <span>{showAdvancedFilter ? "收起筛选" : "组合检索"}</span>
            {isFilterActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#00C776]" />
            )}
          </button>

          {/* 刷新数据 */}
          <button
            type="button"
            onClick={() => loadActivities()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            title="刷新数据"
          >
            <span>🔄</span>
            <span>刷新</span>
          </button>

          {/* 清空所有 */}
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
            >
              清空
            </button>
          )}
        </div>
      </div>

      {/* 2. 检索控制台 (Advanced Multi-dimensional Filter Bar) */}
      <div className="bg-gray-50/70 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-gray-200/60 dark:border-slate-800/80 mb-4 space-y-3">
        {/* 第一行：搜索关键字 + 来源下拉 + 时间范围预设 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
          {/* 1. 关键字搜索 */}
          <div className="md:col-span-5 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="🔍 搜索标题、详细日志、内容、来源..."
              className="w-full h-9 pl-3 pr-8 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00C776]/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-xs text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* 2. 来源下拉选择 */}
          <div className="md:col-span-3">
            <select
              value={filterSource}
              onChange={(e) => {
                setFilterSource(e.target.value as ActivitySource);
                setCurrentPage(1);
              }}
              className="w-full h-9 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00C776]/40 cursor-pointer"
            >
              {sourceTabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.icon} {tab.label} ({tab.count})
                </option>
              ))}
            </select>
          </div>

          {/* 3. 时间范围选择 */}
          <div className="md:col-span-4">
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-gray-200 dark:border-slate-700 text-xs">
              {[
                { id: "all", label: "全部" },
                { id: "today", label: "今天" },
                { id: "3d", label: "近3天" },
                { id: "7d", label: "近7天" },
                { id: "custom", label: "自定义" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTimeRange(t.id as TimeRangePreset);
                    setCurrentPage(1);
                  }}
                  className={`flex-1 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                    timeRange === t.id
                      ? "bg-[#00C776] text-white shadow-2xs"
                      : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 第二行（条件展开或自定义时间选择）：自定义起始日期与结束日期 */}
        {(timeRange === "custom" || showAdvancedFilter) && (
          <div className="pt-2.5 border-t border-gray-200/60 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-gray-500 dark:text-slate-400 font-bold">
                自定义时间段：
              </span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setTimeRange("custom");
                  setCurrentPage(1);
                }}
                className="h-8 px-2.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 text-xs"
              />
              <span className="text-gray-400">至</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setTimeRange("custom");
                  setCurrentPage(1);
                }}
                className="h-8 px-2.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 text-xs"
              />
            </div>

            {/* 单页容量选择 */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500 dark:text-slate-400">每页条数：</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 px-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-gray-800 dark:text-slate-100"
              >
                <option value={10}>10 条 / 页</option>
                <option value={20}>20 条 / 页</option>
                <option value={50}>50 条 / 页</option>
              </select>
            </div>
          </div>
        )}

        {/* 来源快捷胶囊切换条 */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {sourceTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setFilterSource(tab.id);
                setCurrentPage(1);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                filterSource === tab.id
                  ? "bg-[#00C776] text-white shadow-2xs"
                  : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200/60 dark:border-slate-700 hover:bg-gray-50"
              }`}
            >
              <span className="text-[11px]">{tab.icon}</span>
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  filterSource === tab.id
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* 筛选状态汇总 & 一键重置 */}
        {isFilterActive && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-200/60 dark:border-slate-800 text-xs">
            <span className="text-gray-500 dark:text-slate-400">
              已筛选出{" "}
              <strong className="text-[#00C776]">{filteredItems.length}</strong>{" "}
              条记录（共 {items.length} 条）
            </span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[#00C776] hover:underline font-bold cursor-pointer"
            >
              ↺ 重置所有筛选
            </button>
          </div>
        )}
      </div>

      {/* 3. 批量操作工具条 (Batch Action Bar) */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs mb-3.5 animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="text-[#00C776] font-bold">
              ✓ 已选择 {selectedIds.size} 条记录
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={batchDeleting}
              onClick={handleBatchDelete}
              className="px-3 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              {batchDeleting ? "删除中…" : "🗑️ 批量删除"}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-semibold cursor-pointer"
            >
              取消选择
            </button>
          </div>
        </div>
      )}

      {/* 4. 结构化数据表格展示 (Table View) */}
      {loading ? (
        <div className="py-14 text-center text-xs text-gray-400 dark:text-slate-400">
          加载通知与活动数据中…
        </div>
      ) : paginatedItems.length === 0 ? (
        <div className="py-14 text-center text-xs text-gray-400 dark:text-slate-400 flex flex-col items-center justify-center gap-2">
          <span className="text-2xl">🔍</span>
          <span>在当前筛选条件下未找到匹配的通知记录</span>
          {isFilterActive && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-1 px-3 py-1.5 rounded-xl bg-[#00C776]/10 text-[#00C776] font-bold hover:bg-[#00C776]/20 transition-colors cursor-pointer"
            >
              清除所有筛选条件
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-slate-700/80">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700/80 bg-gray-50/80 dark:bg-slate-900/60 text-[11px] font-bold text-gray-500 dark:text-slate-400">
                <th className="py-2.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    aria-label="全选当前页"
                    className="w-3.5 h-3.5 rounded text-[#00C776] focus:ring-[#00C776] border-gray-300 dark:border-slate-600 cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3 w-40">时间</th>
                <th className="py-2.5 px-3 min-w-[240px]">内容与描述</th>
                <th className="py-2.5 px-3 w-28 text-center">来源</th>
                <th className="py-2.5 px-3 w-28 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100/80 dark:divide-slate-800/80 text-xs bg-white dark:bg-slate-800/40">
              {paginatedItems.map((item, idx) => {
                const isSelected = selectedIds.has(item.id);
                const globalIndex = (currentPage - 1) * pageSize + idx + 1;

                return (
                  <tr
                    key={item.id}
                    className={`group transition-colors ${
                      isSelected
                        ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                        : "hover:bg-gray-50/80 dark:hover:bg-slate-900/40"
                    }`}
                  >
                    {/* 勾选框 */}
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectOne(item.id)}
                        aria-label={`选择条目 ${item.title}`}
                        className="w-3.5 h-3.5 rounded text-[#00C776] focus:ring-[#00C776] border-gray-300 dark:border-slate-600 cursor-pointer"
                      />
                    </td>

                    {/* 序号 */}
                    <td className="py-3 px-3 text-center text-gray-400 dark:text-slate-500 font-mono text-[11px]">
                      {globalIndex}
                    </td>

                    {/* 时间 */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-800 dark:text-slate-200 text-[11px]">
                          {formatExactTime(item.ts)}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-400">
                          {formatRelativeTime(item.ts)}
                        </span>
                      </div>
                    </td>

                    {/* 内容 */}
                    <td className="py-3 px-3">
                      <div className="flex items-start gap-2.5">
                        {renderActivityIcon(item.icon, "w-4 h-4 mt-0.5")}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 dark:text-slate-100 truncate">
                            {item.title}
                          </p>
                          {item.detail && (
                            <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate mt-0.5 leading-relaxed">
                              {item.detail}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 来源 */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap ${item.sourceBadgeClass}`}
                      >
                        {item.sourceLabel}
                      </span>
                    </td>

                    {/* 操作 */}
                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-[#00C776] hover:bg-emerald-100 font-semibold text-[11px] transition-colors"
                            title="访问目标网址"
                          >
                            访问 ↗
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedDetailItem(item)}
                            className="px-2 py-1 rounded-md bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 font-semibold text-[11px] transition-colors cursor-pointer"
                            title="查看详情"
                          >
                            详情
                          </button>
                        )}

                        {/* 单条删除 */}
                        <button
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={() => handleDeleteItem(item)}
                          className="p-1 rounded-md text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer disabled:opacity-50"
                          title="删除此记录"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. 分页栏 (Pagination Footer) */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-xs">
          <span className="text-gray-500 dark:text-slate-400">
            第 {currentPage} / {totalPages} 页 · 共 {filteredItems.length} 条记录
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              ← 上一页
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              下一页 →
            </button>
          </div>
        </div>
      )}

      {/* 6. 查看详情弹窗 (Detail Modal) */}
      <Modal
        open={Boolean(selectedDetailItem)}
        title="活动详情"
        onClose={() => setSelectedDetailItem(null)}
      >
        {selectedDetailItem && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100 dark:border-slate-800">
              {renderActivityIcon(selectedDetailItem.icon, "w-7 h-7")}
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                  {selectedDetailItem.title}
                </h4>
                <p className="text-[11px] text-gray-400 dark:text-slate-400">
                  {formatExactTime(selectedDetailItem.ts)} (
                  {formatRelativeTime(selectedDetailItem.ts)})
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="font-bold text-gray-700 dark:text-slate-300">
                来源模块：
              </span>
              <div>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-semibold ${selectedDetailItem.sourceBadgeClass}`}
                >
                  {selectedDetailItem.sourceLabel}
                </span>
              </div>
            </div>

            {selectedDetailItem.detail && (
              <div className="space-y-1.5">
                <span className="font-bold text-gray-700 dark:text-slate-300">
                  详细描述与执行日志：
                </span>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900/80 border border-gray-100 dark:border-slate-800 text-gray-700 dark:text-slate-200 leading-relaxed break-words font-mono text-[11px] max-h-60 overflow-y-auto">
                  {selectedDetailItem.detail}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedDetailItem(null)}
                className="px-4 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-white font-bold transition-colors cursor-pointer"
              >
                关闭
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
