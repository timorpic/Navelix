"use client";

/**
 * 「消息通知与活动动态」卡片头部：标题与条数徽标 + 组合检索/刷新/清空三个全局操作。
 *
 * 从 `recent-activities-card.tsx`（原 1002 行）抽出 —— 头部原是一整段内联 JSX，
 * 其中「组合检索」按钮需要 `showAdvancedFilter` 与 `isFilterActive` 两个状态
 * 参与样式计算，单独成组件后主组件的 return 只剩各区块的拼接。
 */
export default function RecentActivitiesHeader({
  totalCount,
  showAdvancedFilter,
  isFilterActive,
  onToggleAdvancedFilter,
  onRefresh,
  onClearAll,
}: {
  totalCount: number;
  showAdvancedFilter: boolean;
  isFilterActive: boolean;
  onToggleAdvancedFilter: () => void;
  onRefresh: () => void;
  onClearAll: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-slate-700/60">
      <div className="flex items-center gap-2.5">
        <span className="text-base">🔔</span>
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>消息通知与活动动态</span>
            <span className="px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-[#00C776] text-[10px] font-bold">
              共 {totalCount} 条
            </span>
          </h3>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* 高级筛选展开切换 */}
        <button
          type="button"
          onClick={onToggleAdvancedFilter}
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
          onClick={onRefresh}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          title="刷新数据"
        >
          <span>🔄</span>
          <span>刷新</span>
        </button>

        {/* 清空所有 */}
        {totalCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
          >
            清空
          </button>
        )}
      </div>
    </div>
  );
}
