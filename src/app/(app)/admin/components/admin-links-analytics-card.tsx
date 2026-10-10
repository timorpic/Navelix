"use client";

import { categoryName, type LinkUsageStats } from "@/lib/admin-links";
import type { Category } from "@/types";

/**
 * 「链接管理」Tab 的卡片 4：📊 访问统计（今日点击 / 最热分组 / 最热链接）。
 *
 * 从 `admin-links-tab.tsx`（原 764 行）抽出 —— 统计口径全部在
 * `@/lib/admin-links` 的 `computeLinkUsageStats()` 里（已单测覆盖），
 * 本组件只把 `useAdminLinks()` 算好的结果渲染成三块数字卡片。
 */
export default function AdminLinksAnalyticsCard({
  usageStats,
  categories,
}: {
  usageStats: LinkUsageStats;
  categories: Category[];
}) {
  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-white">访问数据与热门统计</h2>
        <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
          基于本机浏览器记录的真实点击数据（localStorage）
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-gray-50 dark:bg-slate-900/60 rounded-xl text-center">
          <span className="text-xs text-gray-400 dark:text-slate-400">今日总点击量</span>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">
            {usageStats.todayClicks > 0
              ? `${usageStats.todayClicks.toLocaleString()} 次`
              : "暂无数据"}
          </p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-slate-900/60 rounded-xl text-center">
          <span className="text-xs text-gray-400 dark:text-slate-400">最受关注分类</span>
          <p className="text-2xl font-extrabold text-teal-600 dark:text-teal-400 mt-1">
            {usageStats.topCategoryId
              ? categoryName(categories, usageStats.topCategoryId)
              : "暂无数据"}
          </p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-slate-900/60 rounded-xl text-center">
          <span className="text-xs text-gray-400 dark:text-slate-400">热度最高链接</span>
          <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">
            {usageStats.topLink?.title || "暂无数据"}
          </p>
        </div>
      </div>
    </div>
  );
}
