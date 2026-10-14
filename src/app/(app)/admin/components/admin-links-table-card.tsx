"use client";

import { useTranslations } from "next-intl";
import BrandIcon from "@/components/brand-icon";
import { getStatusType, type LinkProbeInfo, type LinkStatus } from "@/hooks/use-link-status";
import { categoryName } from "@/lib/admin-links";
import type { Category, SiteLink } from "@/types";

/**
 * 「链接管理」Tab 的卡片 1：🔗 链接列表（搜索 / 分组筛选 / 连通性检查 / 分页表格）。
 *
 * 从 `admin-links-tab.tsx`（原 764 行）抽出 —— 该文件把链接列表、分组管理、
 * 快捷访问管理与访问统计四块互不相关的视图塞在一起。搜索词、筛选分组、页码与
 * 每页条数等状态全部来自 `useAdminLinks()`，本组件只负责渲染与事件转发。
 */

const statusDot: Record<LinkStatus, string> = {
  online: "bg-emerald-500",
  slow: "bg-amber-400",
  offline: "bg-rose-500",
  checking: "animate-pulse bg-amber-400",
  unknown: "bg-gray-300",
};

const statusText: Record<LinkStatus, string> = {
  online: "在线",
  slow: "缓慢",
  offline: "离线",
  checking: "检查中",
  unknown: "未知",
};

export default function AdminLinksTableCard({
  links,
  filteredLinks,
  paginatedLinks,
  totalPages,
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  searchQuery,
  setSearchQuery,
  filterCategory,
  setFilterCategory,
  categories,
  statuses,
  refreshStatuses,
  onAddLink,
  onEditLink,
  onDeleteLink,
  onClearAll,
}: {
  /** 全量链接，仅用于「一键清空」按钮的显示与计数 */
  links: SiteLink[];
  filteredLinks: SiteLink[];
  paginatedLinks: SiteLink[];
  totalPages: number;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: (v: number) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  categories: Category[];
  statuses: Record<string, LinkProbeInfo>;
  refreshStatuses: () => void;
  onAddLink: () => void;
  onEditLink: (link: SiteLink) => void;
  onDeleteLink: (link: SiteLink) => void;
  onClearAll: () => void;
}) {
  const tx = useTranslations();
  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100/90 dark:border-slate-700 shadow-2xs transition-colors">
      {/* Table Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-3 flex-1 max-w-xl">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400 text-xs">
              🔍
            </div>
            <input
              name="link-search"
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              aria-label={tx("search_link_title_or_url_34c4e0ae")}
              placeholder={tx("search_link_title_or_url_9998d382")}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
          </div>

          {/* Group Filter Dropdown */}
          <select
            name="category-filter"
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value);
              setCurrentPage(1);
            }}
            aria-label={tx("filter_by_category_fbd61854")}
            className="h-9 px-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-700 dark:text-slate-200 font-medium focus:outline-none focus:border-brand"
          >
            <option value="all">{tx("all_categories_f68e866a")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Connectivity Check Button */}
          <button
            onClick={refreshStatuses}
            className="h-9 px-3 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>↻</span>
            <span>{tx("check_connectivity_9bf3a507")}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {links.length > 0 && (
            <button
              onClick={onClearAll}
              className="h-9 px-3.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/80 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>🗑️</span>
              <span>{tx("clear_all_links_bd88d7dd")}{links.length})</span>
            </button>
          )}

          {/* Add New Link Action Button */}
          <button
            onClick={onAddLink}
            className="h-9 px-4 bg-brand hover:bg-brand-strong text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <span className="text-sm">+</span>
            <span>{tx("add_link_00f2a7fe")}</span>
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-400 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="pb-3 pr-4">{tx("website_fb8d739d")}</th>
              <th className="pb-3 pr-4">{tx("url_a8ecb4b6")}</th>
              <th className="pb-3 pr-4">{tx("category_6c49c1f9")}</th>
              <th className="pb-3 pr-4">{tx("network_status_872428a7")}</th>
              <th className="pb-3 text-right">{tx("actions_ed31fbb4")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
            {paginatedLinks.map((link) => {
              return (
                <tr key={link.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-700/50 transition-colors">
                  {/* Site Column */}
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-slate-900 flex items-center justify-center shrink-0">
                        <BrandIcon name={link.icon || link.title} className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-gray-900 dark:text-slate-100 truncate">
                          {link.title}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-400 truncate">
                          {link.description || "AI assistant"}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* URL Column */}
                  <td className="py-3.5 pr-4 max-w-[240px]">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 dark:text-slate-400 hover:text-brand dark:hover:text-brand truncate block transition-colors font-mono"
                    >
                      {link.url}
                    </a>
                  </td>

                  {/* Category Badge Column */}
                  <td className="py-3.5 pr-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900">
                      {categoryName(categories, link.category)}
                    </span>
                  </td>

                  {/* Status Dot Column */}
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          statusDot[getStatusType(statuses[link.id])]
                        }`}
                      />
                      <span className="text-gray-600 dark:text-slate-300 font-medium">
                        {statusText[getStatusType(statuses[link.id])]}
                      </span>
                    </div>
                  </td>

                  {/* Action Column */}
                  <td className="py-3.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => onEditLink(link)}
                        className="text-gray-500 dark:text-slate-400 hover:text-brand dark:hover:text-brand font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>✏️</span> {tx("edit_37090f45")}</button>
                      <button
                        onClick={() => onDeleteLink(link)}
                        className="text-gray-400 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>🗑️</span> {tx("delete_2f9daa82")}</button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {paginatedLinks.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-400 dark:text-slate-400">
                  {tx("no_matching_links_1067b881")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Table Bottom Pagination Footer */}
      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
        <span>{tx("total_76e547a8")}{filteredLinks.length} {tx("records_2a090e4c")}</span>

        <div className="flex items-center gap-4">
          {/* Page Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
            >
              &lt;
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold cursor-pointer ${
                  currentPage === p
                    ? "bg-teal-50 dark:bg-teal-950/60 border border-brand text-brand"
                    : "border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
            >
              &gt;
            </button>
          </div>

          {/* Page Size Select */}
          <select
            name="page-size"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            aria-label={tx("rows_per_page_d577b91f")}
            className="h-7 px-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-xs text-gray-600 dark:text-slate-300"
          >
            <option value={10}>{tx("10_per_page_68487531")}</option>
            <option value={20}>{tx("20_per_page_c0c4a643")}</option>
            <option value={50}>{tx("50_per_page_390ec07e")}</option>
          </select>
        </div>
      </div>
    </div>
  );
}
