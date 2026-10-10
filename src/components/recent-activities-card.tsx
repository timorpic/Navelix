"use client";

import type { SiteLink } from "@/types";
import ConfirmDialog from "./confirm-dialog";
import RecentActivitiesHeader from "./recent-activities-header";
import RecentActivitiesFilterBar from "./recent-activities-filter-bar";
import RecentActivitiesTable from "./recent-activities-table";
import ActivityDetailModal from "./activity-detail-modal";
import { useRecentActivities } from "@/hooks/use-recent-activities";

export type { ActivitySource, TimeRangePreset } from "@/lib/recent-activities";

/**
 * 「消息通知与活动动态」卡片（组合层）。
 *
 * 原为 1002 行的巨石组件：12 个 state、数据读取与删除逻辑、四块界面与两个
 * 纯函数混在一起。现按项目既有拆分方式收敛：
 * - `lib/recent-activities.ts`：来源识别、条目装配、筛选/计数/分页/时间格式化（纯函数，可单测）
 * - `hooks/use-recent-activities.ts`：状态、数据读取与批量删除
 * - `recent-activities-header` / `-filter-bar` / `-table` / `activity-detail-modal`：各区块渲染
 * 本组件只做拼装，文案、class 与交互与原实现一致。
 */
export default function RecentActivitiesCard({ links }: { links: SiteLink[] }) {
  const activities = useRecentActivities(links);

  return (
    <>
      <ConfirmDialog {...activities.confirmDialogProps} />
    <div className="flex flex-col bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-colors">
      {/* 1. 头部标题栏与全局操作 */}
      <RecentActivitiesHeader
        totalCount={activities.items.length}
        showAdvancedFilter={activities.showAdvancedFilter}
        isFilterActive={activities.isFilterActive}
        onToggleAdvancedFilter={activities.toggleAdvancedFilter}
        onRefresh={activities.loadActivities}
        onClearAll={activities.clearAll}
      />

      <RecentActivitiesFilterBar
        searchQuery={activities.searchQuery}
        onSearchQueryChange={activities.setSearchQueryAndResetPage}
        filterSource={activities.filterSource}
        onFilterSourceChange={activities.setFilterSourceAndResetPage}
        timeRange={activities.timeRange}
        onTimeRangeChange={activities.setTimeRangeAndResetPage}
        customStartDate={activities.customStartDate}
        onCustomStartDateChange={activities.setCustomStartDateAndResetPage}
        customEndDate={activities.customEndDate}
        onCustomEndDateChange={activities.setCustomEndDateAndResetPage}
        showAdvancedFilter={activities.showAdvancedFilter}
        pageSize={activities.pageSize}
        onPageSizeChange={activities.setPageSizeAndResetPage}
        sourceTabs={activities.sourceTabs}
        isFilterActive={activities.isFilterActive}
        filteredCount={activities.filteredItems.length}
        totalCount={activities.items.length}
        onResetFilters={activities.resetFilters}
        selectedCount={activities.selectedIds.size}
        batchDeleting={activities.batchDeleting}
        onBatchDelete={activities.batchDelete}
        onClearSelection={activities.clearSelection}
      />

      <RecentActivitiesTable
        loading={activities.loading}
        paginatedItems={activities.paginatedItems}
        selectedIds={activities.selectedIds}
        isAllSelected={activities.isAllSelected}
        currentPage={activities.currentPage}
        pageSize={activities.pageSize}
        filteredCount={activities.filteredItems.length}
        totalPages={activities.totalPages}
        isFilterActive={activities.isFilterActive}
        deletingId={activities.deletingId}
        onToggleSelectAll={activities.toggleSelectAll}
        onToggleSelectOne={activities.toggleSelectOne}
        onShowDetail={activities.setSelectedDetailItem}
        onDeleteItem={activities.deleteItem}
        onResetFilters={activities.resetFilters}
        onPageChange={activities.goToPage}
      />

      {/* 6. 查看详情弹窗 (Detail Modal) */}
      <ActivityDetailModal
        item={activities.selectedDetailItem}
        onClose={activities.closeDetail}
      />
    </div>
    </>
  );
}
