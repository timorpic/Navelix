"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SiteLink } from "@/types";
import { useConfirm } from "@/hooks/use-confirm";
import {
  buildSourceTabs,
  countActivityBySource,
  filterActivityItems,
  isActivityFilterActive,
  linkUsageToActivities,
  mergeActivityItems,
  notificationToActivity,
  paginateActivityItems,
  parseLinkUsage,
  removeLinkUsageEntry,
  type ActivityItem,
  type ActivitySource,
  type LinkUsageMap,
  type NotificationLike,
  type TimeRangePreset,
} from "@/lib/recent-activities";

/**
 * 「消息通知与活动动态」卡片的状态与数据操作。
 *
 * 从 `recent-activities-card.tsx`（原 1002 行）抽出 —— 该文件把 12 个 state、
 * 数据读取、批量删除与四块界面混在一起。本 hook 承载全部状态与副作用，
 * 纯计算交给 `lib/recent-activities.ts`，视图组件只负责渲染。
 *
 * `nowTimestamp` 在每次读取数据时刷新，供时间范围筛选使用。
 */

const LINK_USAGE_KEY = "navelix.link.usage";

export interface UseRecentActivitiesResult {
  items: ActivityItem[];
  loading: boolean;
  /** 刷新数据（通知接口 + 本地链接访问记录） */
  loadActivities: () => Promise<void>;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filterSource: ActivitySource;
  setFilterSource: (v: ActivitySource) => void;
  timeRange: TimeRangePreset;
  setTimeRange: (v: TimeRangePreset) => void;
  customStartDate: string;
  setCustomStartDate: (v: string) => void;
  customEndDate: string;
  setCustomEndDate: (v: string) => void;
  showAdvancedFilter: boolean;
  setShowAdvancedFilter: (v: boolean) => void;
  /** 高级筛选的展开切换 */
  toggleAdvancedFilter: () => void;
  pageSize: number;
  setPageSize: (v: number) => void;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  isAllSelected: boolean;
  toggleSelectAll: () => void;
  toggleSelectOne: (id: string) => void;
  deletingId: string | null;
  batchDeleting: boolean;
  /** 清空当前勾选 */
  clearSelection: () => void;
  selectedDetailItem: ActivityItem | null;
  setSelectedDetailItem: (item: ActivityItem | null) => void;
  /** 关闭详情弹窗 */
  closeDetail: () => void;
  filteredItems: ActivityItem[];
  paginatedItems: ActivityItem[];
  totalPages: number;
  isFilterActive: boolean;
  sourceTabs: ReturnType<typeof buildSourceTabs>;
  resetFilters: () => void;
  /** 页码变更（控件回调），避免把 setState 暴露给视图 */
  goToPage: (page: number) => void;
  setPageSizeAndResetPage: (size: number) => void;
  setSearchQueryAndResetPage: (v: string) => void;
  setFilterSourceAndResetPage: (v: ActivitySource) => void;
  setTimeRangeAndResetPage: (v: TimeRangePreset) => void;
  setCustomStartDateAndResetPage: (v: string) => void;
  setCustomEndDateAndResetPage: (v: string) => void;
  deleteItem: (item: ActivityItem) => Promise<void>;
  batchDelete: () => Promise<void>;
  clearAll: () => Promise<void>;
  /** 展开到 <ConfirmDialog> 上的属性 */
  confirmDialogProps: ReturnType<typeof useConfirm>["dialogProps"];
}

export function useRecentActivities(links: SiteLink[]): UseRecentActivitiesResult {
  const confirmDialog = useConfirm();
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
          notifs = (notifData.notifications || []).map((n: NotificationLike) =>
            notificationToActivity(n),
          );
        }
      } catch {
        // ignore
      }

      // 4.2 链接访问与点击记录（localStorage: navelix.link.usage）
      let linkActivities: ActivityItem[] = [];
      try {
        const raw = localStorage.getItem(LINK_USAGE_KEY);
        linkActivities = linkUsageToActivities(parseLinkUsage(raw), links);
      } catch {
        // ignore
      }

      // 4.3 汇总合并与排序（按时间倒序）
      setItems(mergeActivityItems(notifs, linkActivities));
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
  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setFilterSource("all");
    setTimeRange("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setCurrentPage(1);
  }, []);

  const isFilterActive = useMemo(
    () =>
      isActivityFilterActive({
        searchQuery,
        filterSource,
        timeRange,
        customStartDate,
        customEndDate,
      }),
    [searchQuery, filterSource, timeRange, customStartDate, customEndDate],
  );

  // 多条件组合联合筛选 (Combined Multi-dimensional Filtering)
  const filteredItems = useMemo(
    () =>
      filterActivityItems(items, {
        searchQuery,
        filterSource,
        timeRange,
        customStartDate,
        customEndDate,
        nowTimestamp,
      }),
    [
      items,
      filterSource,
      searchQuery,
      timeRange,
      customStartDate,
      customEndDate,
      nowTimestamp,
    ],
  );

  // 各来源实时统计数量
  const counts = useMemo(() => countActivityBySource(items), [items]);

  // 分页数据截取
  const { totalPages, pageItems: paginatedItems } = useMemo(
    () => paginateActivityItems(filteredItems, currentPage, pageSize),
    [filteredItems, currentPage, pageSize],
  );

  // 多选逻辑
  const isAllSelected =
    paginatedItems.length > 0 &&
    paginatedItems.every((item) => selectedIds.has(item.id));

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected =
        paginatedItems.length > 0 &&
        paginatedItems.every((item) => prev.has(item.id));
      if (allSelected) {
        for (const item of paginatedItems) {
          next.delete(item.id);
        }
      } else {
        for (const item of paginatedItems) {
          next.add(item.id);
        }
      }
      return next;
    });
  }, [paginatedItems]);

  const toggleSelectOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAdvancedFilter = useCallback(() => {
    setShowAdvancedFilter((v) => !v);
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const closeDetail = useCallback(() => setSelectedDetailItem(null), []);

  // 筛选条件变更时回到第 1 页（与原组件内联写法等价）
  const setSearchQueryAndResetPage = useCallback((v: string) => {
    setSearchQuery(v);
    setCurrentPage(1);
  }, []);
  const setFilterSourceAndResetPage = useCallback((v: ActivitySource) => {
    setFilterSource(v);
    setCurrentPage(1);
  }, []);
  const setTimeRangeAndResetPage = useCallback((v: TimeRangePreset) => {
    setTimeRange(v);
    setCurrentPage(1);
  }, []);
  const setCustomStartDateAndResetPage = useCallback((v: string) => {
    setCustomStartDate(v);
    setTimeRange("custom");
    setCurrentPage(1);
  }, []);
  const setCustomEndDateAndResetPage = useCallback((v: string) => {
    setCustomEndDate(v);
    setTimeRange("custom");
    setCurrentPage(1);
  }, []);
  const setPageSizeAndResetPage = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);
  const goToPage = useCallback(
    (page: number) => setCurrentPage(page),
    [],
  );

  // 单条删除
  const deleteItem = useCallback(
    async (item: ActivityItem) => {
      const okToDelete = await confirmDialog.confirm({
        title: "删除记录",
        message: `确定要删除记录 “${item.title}” 吗？`,
        confirmLabel: "删除",
      });
      if (!okToDelete) return;
      setDeletingId(item.id);
      try {
        if (item.source === "link") {
          try {
            const raw = localStorage.getItem(LINK_USAGE_KEY);
            if (raw) {
              const usage: LinkUsageMap = parseLinkUsage(raw);
              localStorage.setItem(
                LINK_USAGE_KEY,
                JSON.stringify(removeLinkUsageEntry(usage, item.rawId)),
              );
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
    },
    [confirmDialog, loadActivities],
  );

  // 批量删除所选项
  const batchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const okToBatch = await confirmDialog.confirm({
      title: "批量删除",
      message: `确定要批量删除选中的 ${selectedIds.size} 条记录吗？`,
      confirmLabel: "删除",
    });
    if (!okToBatch) return;
    setBatchDeleting(true);
    try {
      const selectedItems = items.filter((i) => selectedIds.has(i.id));
      for (const item of selectedItems) {
        if (item.source === "link") {
          try {
            const raw = localStorage.getItem(LINK_USAGE_KEY);
            if (raw) {
              const usage: LinkUsageMap = parseLinkUsage(raw);
              localStorage.setItem(
                LINK_USAGE_KEY,
                JSON.stringify(removeLinkUsageEntry(usage, item.rawId)),
              );
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
  }, [confirmDialog, items, selectedIds, loadActivities]);

  // 清空全部记录
  const clearAll = useCallback(async () => {
    const okToClear = await confirmDialog.confirm({
      title: "清空记录",
      message: "⚠️ 确定要清空全部活动记录吗？此操作无法撤销。",
      confirmLabel: "清空",
    });
    if (!okToClear) return;
    try {
      await fetch("/api/notifications", { method: "DELETE" });
      localStorage.removeItem(LINK_USAGE_KEY);
      setSelectedIds(new Set());
      await loadActivities();
    } catch {
      // ignore
    }
  }, [confirmDialog, loadActivities]);

  // 来源标签列表
  const sourceTabs = useMemo(() => buildSourceTabs(counts), [counts]);

  return {
    items,
    loading,
    loadActivities,
    searchQuery,
    setSearchQuery,
    filterSource,
    setFilterSource,
    timeRange,
    setTimeRange,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    showAdvancedFilter,
    setShowAdvancedFilter,
    toggleAdvancedFilter,
    pageSize,
    setPageSize,
    currentPage,
    setCurrentPage,
    selectedIds,
    setSelectedIds,
    isAllSelected,
    toggleSelectAll,
    toggleSelectOne,
    deletingId,
    batchDeleting,
    clearSelection,
    selectedDetailItem,
    setSelectedDetailItem,
    closeDetail,
    filteredItems,
    paginatedItems,
    totalPages,
    isFilterActive,
    sourceTabs,
    resetFilters,
    goToPage,
    setPageSizeAndResetPage,
    setSearchQueryAndResetPage,
    setFilterSourceAndResetPage,
    setTimeRangeAndResetPage,
    setCustomStartDateAndResetPage,
    setCustomEndDateAndResetPage,
    deleteItem,
    batchDelete,
    clearAll,
    confirmDialogProps: confirmDialog.dialogProps,
  };
}
