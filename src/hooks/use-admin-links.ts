"use client";

import { useCallback, useMemo, useState } from "react";
import { useNavelixConfig, useNavelixData } from "@/context/navelix-context";
import { useLinkStatus } from "@/hooks/use-link-status";
import { useToast } from "@/hooks/use-toast";
import { trackClientEvent } from "@/lib/client/analytics";
import {
  LINK_USAGE_STORAGE_KEY,
  buildClearLinksMessage,
  computeLinkUsageStats,
  countLinksInCategory,
  filterLinks,
  paginateLinks,
  parseLinkUsage,
  totalLinkPages,
} from "@/lib/admin-links";
import type { Category, SiteLink } from "@/types";

/**
 * 「链接管理」Tab 的状态与副作用。
 *
 * 从 `admin-links-tab.tsx`（原 764 行）抽出 —— 该文件把「链接列表」「分组管理」
 * 「快捷访问管理」「访问统计」四个互不相关的子视图、14 个 useState 与 3 个确认
 * 弹窗挤在一个组件里。本 hook 承载链接域的全部 state、过滤/分页/统计派生值与
 * 增删改处理器；纯计算（过滤、分页、统计聚合、文案组装）下沉到
 * `@/lib/admin-links`，四个子视图组件只负责渲染。
 */

/** `AddLinkModal` 提交的链接数据（与原内联 handler 的入参一致）。 */
export interface LinkSaveData {
  title: string;
  url: string;
  description: string;
  category: string;
  icon: string;
  notes?: string;
}

export interface UseAdminLinksResult {
  // ── 数据源 ──
  categories: Category[];
  links: SiteLink[];
  // ── 搜索 / 筛选 / 分页 ──
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: (v: number) => void;
  filteredLinks: SiteLink[];
  paginatedLinks: SiteLink[];
  totalPages: number;
  // ── 连通性探测 ──
  statuses: ReturnType<typeof useLinkStatus>["statuses"];
  refreshStatuses: () => void;
  // ── 访问统计 ──
  usageStats: ReturnType<typeof computeLinkUsageStats>;
  // ── 弹窗开关 ──
  showAddLink: boolean;
  editingLink: SiteLink | null;
  openAddLink: () => void;
  openEditLink: (link: SiteLink) => void;
  closeAddLink: () => void;
  showAddCategory: boolean;
  editingCategory: Category | null;
  openAddCategory: () => void;
  openEditCategory: (category: Category) => void;
  closeAddCategory: () => void;
  showClearAllConfirm: boolean;
  openClearAllConfirm: () => void;
  closeClearAllConfirm: () => void;
  linkToDelete: SiteLink | null;
  setLinkToDelete: (link: SiteLink | null) => void;
  categoryToDelete: Category | null;
  setCategoryToDelete: (category: Category | null) => void;
  /** 待删除分组下的链接数（删除确认文案用） */
  linksInCategory: number;
  // ── 处理器 ──
  handleLinkSave: (data: LinkSaveData) => void;
  handleCategorySave: (name: string, icon: string, isTeamShared?: boolean) => void;
  handleDeleteLink: () => void;
  handleDeleteCategory: () => void;
  handleClearAllLinks: () => void;
  toggleQuickAccess: (id: string) => void;
  // ── 提示 ──
  notice: string;
  notify: (title: string, msg: string) => void;
}

export function useAdminLinks(): UseAdminLinksResult {
  const {
    categories,
    links,
    addCategory,
    updateCategory,
    deleteCategory,
    addLink,
    updateLink,
    deleteLink,
    deleteAllLinks,
    toggleQuickAccess,
  } = useNavelixData();

  const { config } = useNavelixConfig();

  const { statuses, refresh: refreshStatuses } = useLinkStatus(
    config.linkStatusEnabled ? links : [],
    (config.linkStatusInterval || 60) * 1000,
  );

  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal state
  const [showAddLink, setShowAddLink] = useState(false);
  const [editingLink, setEditingLink] = useState<SiteLink | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<SiteLink | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const { notice, notify } = useToast();

  // 过滤与分页（纯函数见 @/lib/admin-links）
  const filteredLinks = useMemo(
    () => filterLinks(links, { category: filterCategory, query: searchQuery }),
    [links, filterCategory, searchQuery],
  );

  const paginatedLinks = useMemo(
    () => paginateLinks(filteredLinks, currentPage, pageSize),
    [filteredLinks, currentPage, pageSize],
  );

  const totalPages = totalLinkPages(filteredLinks.length, pageSize);

  const linksInCategory = categoryToDelete
    ? countLinksInCategory(links, categoryToDelete.id)
    : 0;

  // Real usage statistics derived from localStorage link-click tracking.
  const usageStats = useMemo(() => {
    let raw: string | null = null;
    if (typeof window !== "undefined") {
      try {
        raw = localStorage.getItem(LINK_USAGE_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    return computeLinkUsageStats(links, parseLinkUsage(raw), new Date());
  }, [links]);

  // Handlers
  const handleLinkSave = useCallback(
    (data: LinkSaveData) => {
      if (editingLink) {
        updateLink(editingLink.id, data);
        notify("链接管理", "链接修改成功");
        // 可选遥测：编辑链接
        trackClientEvent("nav.link_edit", {
          linkId: editingLink.id,
          categoryId: data.category,
        });
      } else {
        addLink(data);
        notify("链接管理", "链接添加成功");
        // 可选遥测：新增链接
        trackClientEvent("nav.link_add", { categoryId: data.category });
      }
      setEditingLink(null);
    },
    [editingLink, updateLink, addLink, notify],
  );

  const handleCategorySave = useCallback(
    (name: string, icon: string, isTeamShared?: boolean) => {
      if (editingCategory) {
        updateCategory(editingCategory.id, { name, icon, isTeamShared });
        notify("分组管理", "分组修改成功");
      } else {
        addCategory(name, icon, isTeamShared);
        notify("分组管理", "分组添加成功");
      }
      setEditingCategory(null);
    },
    [editingCategory, updateCategory, addCategory, notify],
  );

  const handleDeleteLink = useCallback(() => {
    if (linkToDelete) {
      deleteLink(linkToDelete.id);
      notify("链接管理", "链接已删除");
      // 可选遥测：删除链接
      trackClientEvent("nav.link_delete", { linkId: linkToDelete.id });
    }
  }, [linkToDelete, deleteLink, notify]);

  const handleDeleteCategory = useCallback(() => {
    if (categoryToDelete) {
      deleteCategory(categoryToDelete.id);
      notify("分组管理", "分组已删除");
    }
  }, [categoryToDelete, deleteCategory, notify]);

  const handleClearAllLinks = useCallback(() => {
    const count = links.length;
    deleteAllLinks();
    setShowClearAllConfirm(false);
    notify("链接管理", buildClearLinksMessage(count));
  }, [links.length, deleteAllLinks, notify]);

  const openAddLink = useCallback(() => {
    setEditingLink(null);
    setShowAddLink(true);
  }, []);

  const openEditLink = useCallback((link: SiteLink) => {
    setEditingLink(link);
    setShowAddLink(true);
  }, []);

  const closeAddLink = useCallback(() => {
    setShowAddLink(false);
    setEditingLink(null);
  }, []);

  const openAddCategory = useCallback(() => {
    setEditingCategory(null);
    setShowAddCategory(true);
  }, []);

  const openEditCategory = useCallback((category: Category) => {
    setEditingCategory(category);
    setShowAddCategory(true);
  }, []);

  const closeAddCategory = useCallback(() => {
    setShowAddCategory(false);
    setEditingCategory(null);
  }, []);

  const openClearAllConfirm = useCallback(() => setShowClearAllConfirm(true), []);
  const closeClearAllConfirm = useCallback(() => setShowClearAllConfirm(false), []);

  return {
    categories,
    links,
    searchQuery,
    setSearchQuery,
    filterCategory,
    setFilterCategory,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    filteredLinks,
    paginatedLinks,
    totalPages,
    statuses,
    refreshStatuses,
    usageStats,
    showAddLink,
    editingLink,
    openAddLink,
    openEditLink,
    closeAddLink,
    showAddCategory,
    editingCategory,
    openAddCategory,
    openEditCategory,
    closeAddCategory,
    showClearAllConfirm,
    openClearAllConfirm,
    closeClearAllConfirm,
    linkToDelete,
    setLinkToDelete,
    categoryToDelete,
    setCategoryToDelete,
    linksInCategory,
    handleLinkSave,
    handleCategorySave,
    handleDeleteLink,
    handleDeleteCategory,
    handleClearAllLinks,
    toggleQuickAccess,
    notice,
    notify,
  };
}
