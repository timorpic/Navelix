"use client";

import BrandIcon from "@/components/brand-icon";
import { categoryName } from "@/lib/admin-links";
import type { Category, SiteLink } from "@/types";

/**
 * 「链接管理」Tab 的卡片 3：⚡ 快捷访问管理（置顶开关表格）。
 *
 * 从 `admin-links-tab.tsx`（原 764 行）抽出 —— 与链接列表共用同一份搜索词与
 * 分组筛选（状态在 `useAdminLinks()` 里，故此处只接收过滤后的结果），但表格
 * 结构与操作完全不同，独立成组件后不必再随链接表格一起重渲染。
 */
export default function AdminQuickAccessCard({
  links,
  filteredLinks,
  categories,
  searchQuery,
  setSearchQuery,
  filterCategory,
  setFilterCategory,
  onToggleQuickAccess,
  onNotify,
}: {
  /** 全量链接，仅用于统计已置顶数量 */
  links: SiteLink[];
  /** 已按搜索词与分组筛选的链接 */
  filteredLinks: SiteLink[];
  categories: Category[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  onToggleQuickAccess: (id: string) => void;
  /** 展示提示并写入通知中心（来自 useToast） */
  onNotify: (title: string, msg: string) => void;
}) {
  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100/90 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-gray-100 dark:border-slate-700">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            快捷访问管理
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            实时绑定「🔗 链接管理」中的全量书签（已置顶 {links.filter((l) => l.isQuickAccess).length} 个网址至前台主页）
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2">
          <input
            name="quick-access-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="搜索网址或名称"
            placeholder="搜索网址或名称..."
            className="h-8 px-3 text-xs rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400"
          />
          <select
            name="quick-access-filter"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            aria-label="按分类筛选"
            className="h-8 px-2.5 text-xs rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white"
          >
            <option value="all">全部分类</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-400 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="pb-3 pr-4">网站名称</th>
              <th className="pb-3 pr-4">所属分类</th>
              <th className="pb-3 pr-4">URL 网址</th>
              <th className="pb-3 text-right">快捷访问状态</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
            {filteredLinks.map((l) => (
              <tr
                key={l.id}
                className="hover:bg-gray-50/60 dark:hover:bg-slate-700/50 transition-colors"
              >
                <td className="py-3.5 pr-4 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <BrandIcon name={l.icon} className="w-4 h-4 shrink-0" />
                  <span>{l.title}</span>
                </td>
                <td className="py-3.5 pr-4 text-gray-600 dark:text-slate-300">
                  {categoryName(categories, l.category)}
                </td>
                <td className="py-3.5 pr-4 font-mono text-xs text-gray-400 dark:text-slate-400 max-w-[200px] truncate">
                  {l.url}
                </td>
                <td className="py-3.5 text-right">
                  <button
                    onClick={() => {
                      onToggleQuickAccess(l.id);
                      onNotify(
                        "快捷访问",
                        l.isQuickAccess
                          ? `已取消置顶 "${l.title}"`
                          : `已成功将 "${l.title}" 置顶到快捷访问`,
                      );
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      l.isQuickAccess
                        ? "bg-teal-50 dark:bg-teal-950/60 text-[#00C776] border border-teal-200 dark:border-teal-800 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                        : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-300 hover:bg-[#00C776] hover:text-white"
                    }`}
                  >
                    {l.isQuickAccess ? "📌 已置顶 (点击取消)" : "+ 置顶到快捷访问"}
                  </button>
                </td>
              </tr>
            ))}
            {filteredLinks.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="py-8 text-center text-xs text-gray-400 dark:text-slate-400"
                >
                  未匹配到符合条件的书签记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
