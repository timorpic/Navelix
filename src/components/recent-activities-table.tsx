"use client";

import { formatRelativeTime } from "@/lib/date-utils";
import { formatExactTime } from "@/lib/recent-activities";
import type { ActivityItem } from "@/lib/recent-activities";
import ActivityIcon from "./activity-icon";

/**
 * 活动记录表格（含全选、单条选择、访问/详情/删除操作）与分页栏。
 *
 * 从 `recent-activities-card.tsx`（原 1002 行）抽出 —— 表格与分页原先直接写在
 * 组件 return 里，且依赖 8 个状态与 5 个 handler。这里只接收已算好的分页数据
 * 与回调，序号、时间格式化等计算保持不变。
 */
export default function RecentActivitiesTable({
  loading,
  paginatedItems,
  selectedIds,
  isAllSelected,
  currentPage,
  pageSize,
  filteredCount,
  totalPages,
  isFilterActive,
  deletingId,
  onToggleSelectAll,
  onToggleSelectOne,
  onShowDetail,
  onDeleteItem,
  onResetFilters,
  onPageChange,
}: {
  loading: boolean;
  paginatedItems: ActivityItem[];
  selectedIds: Set<string>;
  isAllSelected: boolean;
  currentPage: number;
  pageSize: number;
  filteredCount: number;
  totalPages: number;
  isFilterActive: boolean;
  deletingId: string | null;
  onToggleSelectAll: () => void;
  onToggleSelectOne: (id: string) => void;
  onShowDetail: (item: ActivityItem) => void;
  onDeleteItem: (item: ActivityItem) => void;
  onResetFilters: () => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <>
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
              onClick={onResetFilters}
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
                    onChange={onToggleSelectAll}
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
                        onChange={() => onToggleSelectOne(item.id)}
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
                          {formatRelativeTime(item.ts, { fallbackAfterDays: 7 })}
                        </span>
                      </div>
                    </td>

                    {/* 内容 */}
                    <td className="py-3 px-3">
                      <div className="flex items-start gap-2.5">
                        <ActivityIcon icon={item.icon} className="w-4 h-4 mt-0.5" />
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
                            onClick={() => onShowDetail(item)}
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
                          onClick={() => onDeleteItem(item)}
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
            第 {currentPage} / {totalPages} 页 · 共 {filteredCount} 条记录
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              ← 上一页
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              下一页 →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
