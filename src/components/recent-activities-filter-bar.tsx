"use client";

import { useText } from "@/hooks/use-text";
import { useTranslations } from "next-intl";
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
  const text = useText();
  const tx = useTranslations();
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
              placeholder={tx("search_titles_logs_content_sources_79b4d4c7")}
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
                  {tab.icon} {text(tab.label)} ({tab.count})
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
                  {text(t.label)}
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
                {tx("custom_date_range_2a3380dc")}</span>
              <input
                type="date"
                name="activityStartDate"
                value={customStartDate}
                onChange={(e) => {
                  onCustomStartDateChange(e.target.value);
                }}
                className="h-8 px-2.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 text-xs"
              />
              <span className="text-gray-400">{tx("to_65edbf9f")}</span>
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
              <span className="text-gray-500 dark:text-slate-400">{tx("rows_per_page_c9bc3eee")}</span>
              <select
                name="activityPageSize"
                value={pageSize}
                onChange={(e) => {
                  onPageSizeChange(Number(e.target.value));
                }}
                className="h-8 px-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-gray-800 dark:text-slate-100"
              >
                <option value={10}>{tx("10_per_page_881393b4")}</option>
                <option value={20}>{tx("20_per_page_2757981f")}</option>
                <option value={50}>{tx("50_per_page_6a4c41f4")}</option>
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
              <span>{text(tab.label)}</span>
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
              {tx("filtered_79df4cd7")}{" "}
              <strong className="text-[#00C776]">{filteredCount}</strong>{" "}
              {tx("records_out_of_17c8dbd4")}{totalCount} {tx("records_34265e57")}</span>
            <button
              type="button"
              onClick={onResetFilters}
              className="text-[#00C776] hover:underline font-bold cursor-pointer"
            >
              {tx("reset_all_filters_d29601c7")}</button>
          </div>
        )}
      </div>

      {/* 3. 批量操作工具条 (Batch Action Bar) */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs mb-3.5 animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="text-[#00C776] font-bold">
              {tx("selected_d2f52775")}{selectedCount} {tx("records_6016bf63")}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={batchDeleting}
              onClick={onBatchDelete}
              className="px-3 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              {batchDeleting ? tx("deleting_5e8e7af5") : tx("delete_selected_786960ad")}
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              className="px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-semibold cursor-pointer"
            >
              {tx("clear_selection_74966e20")}</button>
          </div>
        </div>
      )}
    </>
  );
}
