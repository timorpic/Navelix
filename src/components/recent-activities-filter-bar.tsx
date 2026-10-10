"use client";

import { TIME_RANGE_PRESETS } from "@/lib/recent-activities";
import type {
  ActivitySource,
  ActivitySourceTab,
  TimeRangePreset,
} from "@/lib/recent-activities";

/**
 * 检索控制台（关键字 + 来源下拉 + 时间范围 + 自定义区间 + 来源胶囊 + 重置）
 * 与批量操作工具条。
 *
 * 从 `recent-activities-card.tsx`（原 1002 行）抽出 —— 这两块是纯受控的控件区，
 * 原先占用了组件 return 里最长的一段 JSX。筛选状态仍由 `useRecentActivities()`
 * 持有，本组件只负责渲染与事件转发，文案与 class 原样保留。
 */
export default function RecentActivitiesFilterBar({
  searchQuery,
  onSearchQueryChange,
  filterSource,
  onFilterSourceChange,
  timeRange,
  onTimeRangeChange,
  customStartDate,
  onCustomStartDateChange,
  customEndDate,
  onCustomEndDateChange,
  showAdvancedFilter,
  pageSize,
  onPageSizeChange,
  sourceTabs,
  isFilterActive,
  filteredCount,
  totalCount,
  onResetFilters,
  selectedCount,
  batchDeleting,
  onBatchDelete,
  onClearSelection,
}: {
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  /** ✕ 清空关键字 —— 与原实现一致，不重置页码 */
  filterSource: ActivitySource;
  onFilterSourceChange: (v: ActivitySource) => void;
  timeRange: TimeRangePreset;
  onTimeRangeChange: (v: TimeRangePreset) => void;
  customStartDate: string;
  onCustomStartDateChange: (v: string) => void;
  customEndDate: string;
  onCustomEndDateChange: (v: string) => void;
  showAdvancedFilter: boolean;
  pageSize: number;
  onPageSizeChange: (v: number) => void;
  sourceTabs: ActivitySourceTab[];
  isFilterActive: boolean;
  filteredCount: number;
  totalCount: number;
  onResetFilters: () => void;
  selectedCount: number;
  batchDeleting: boolean;
  onBatchDelete: () => void;
  onClearSelection: () => void;
}) {
  return (
    <>
      {/* 2. 检索控制台 (Advanced Multi-dimensional Filter Bar) */}
      <div className="bg-gray-50/70 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-gray-200/60 dark:border-slate-800/80 mb-4 space-y-3">
        {/* 第一行：搜索关键字 + 来源下拉 + 时间范围预设 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
          {/* 1. 关键字搜索 */}
          <div className="md:col-span-5 relative">
            <input
              type="text"
              name="activitySearch"
              value={searchQuery}
              onChange={(e) => {
                onSearchQueryChange(e.target.value);
              }}
              placeholder="🔍 搜索标题、详细日志、内容、来源..."
              className="w-full h-9 pl-3 pr-8 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00C776]/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchQueryChange("")}
                className="absolute right-2.5 top-2.5 text-xs text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* 2. 来源下拉选择 */}
          <div className="md:col-span-3">
            <select
              name="activityFilterSource"
              value={filterSource}
              onChange={(e) => {
                onFilterSourceChange(e.target.value as ActivitySource);
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
              {TIME_RANGE_PRESETS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    onTimeRangeChange(t.id);
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
                name="activityStartDate"
                value={customStartDate}
                onChange={(e) => {
                  onCustomStartDateChange(e.target.value);
                }}
                className="h-8 px-2.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 text-xs"
              />
              <span className="text-gray-400">至</span>
              <input
                type="date"
                name="activityEndDate"
                value={customEndDate}
                onChange={(e) => {
                  onCustomEndDateChange(e.target.value);
                }}
                className="h-8 px-2.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 text-xs"
              />
            </div>

            {/* 单页容量选择 */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500 dark:text-slate-400">每页条数：</span>
              <select
                name="activityPageSize"
                value={pageSize}
                onChange={(e) => {
                  onPageSizeChange(Number(e.target.value));
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
                onFilterSourceChange(tab.id);
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
              <strong className="text-[#00C776]">{filteredCount}</strong>{" "}
              条记录（共 {totalCount} 条）
            </span>
            <button
              type="button"
              onClick={onResetFilters}
              className="text-[#00C776] hover:underline font-bold cursor-pointer"
            >
              ↺ 重置所有筛选
            </button>
          </div>
        )}
      </div>

      {/* 3. 批量操作工具条 (Batch Action Bar) */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs mb-3.5 animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="text-[#00C776] font-bold">
              ✓ 已选择 {selectedCount} 条记录
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={batchDeleting}
              onClick={onBatchDelete}
              className="px-3 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              {batchDeleting ? "删除中…" : "🗑️ 批量删除"}
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              className="px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-semibold cursor-pointer"
            >
              取消选择
            </button>
          </div>
        </div>
      )}
    </>
  );
}
