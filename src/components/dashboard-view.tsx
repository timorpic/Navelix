"use client";

import React, { useMemo } from "react";
import type { Category, SiteLink, SystemConfig } from "@/types";

interface DashboardViewProps {
  categories: Category[];
  links: SiteLink[];
  config: SystemConfig;
}

export default function DashboardView({ categories, links, config }: DashboardViewProps) {
  // Usage analytics derived from local link-click tracking
  const analytics = useMemo(() => {
    let usageMap: Record<string, { count: number; lastUsed: number }> = {};
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("navelix.link.usage");
        usageMap = raw ? JSON.parse(raw) : {};
      } catch {
        // ignore
      }
    }

    const totalClicks = Object.values(usageMap).reduce((sum, u) => sum + u.count, 0);

    const rankedLinks = links
      .map((l) => ({
        link: l,
        clicks: usageMap[l.id]?.count || 0,
        lastUsed: usageMap[l.id]?.lastUsed || 0,
      }))
      .sort((a, b) => b.clicks - a.clicks);

    const quickAccessCount = links.filter((l) => l.isQuickAccess).length;

    return {
      totalClicks,
      rankedLinks,
      quickAccessCount,
    };
  }, [links]);

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>📈</span>
            <span>工作空间数据看板</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            监控个人数字资产、书签分类分布与点击访问统计
          </p>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800/90 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">总书签数</span>
            <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-[#00C776] text-sm">🔗</span>
          </div>
          <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">
            {links.length}
          </p>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
            快捷访问：{analytics.quickAccessCount} 项
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800/90 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">分类总数</span>
            <span className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-500 text-sm">📂</span>
          </div>
          <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">
            {categories.length}
          </p>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
            平均每分类 {categories.length ? Math.round(links.length / categories.length) : 0} 链接
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800/90 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">累计点击访问</span>
            <span className="p-2 rounded-xl bg-[#00C776]/10 text-[#00C776] text-sm">⚡</span>
          </div>
          <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">
            {analytics.totalClicks}
          </p>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
            交互点击次数统计
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800/90 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">链路探针</span>
            <span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-500 text-sm">🛡️</span>
          </div>
          <p className="text-2xl font-black text-[#00C776] mt-2">
            {config.linkStatusEnabled ? "已开启" : "未开启"}
          </p>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
            检测间隔：{config.linkStatusInterval || 60}s
          </p>
        </div>
      </div>

      {/* Main Grid: Category Distribution & Top Clicked Links */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Breakdown (6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-800/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-2xs">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>📊</span>
            <span>分类占比分布</span>
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
                  <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
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
        <div className="lg:col-span-6 bg-white dark:bg-slate-800/90 p-5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-2xs">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>🔥</span>
            <span>最常访问书签排行</span>
          </h3>

          <div className="flex flex-col gap-2">
            {analytics.rankedLinks.slice(0, 6).map((item, idx) => (
              <div
                key={item.link.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800"
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
