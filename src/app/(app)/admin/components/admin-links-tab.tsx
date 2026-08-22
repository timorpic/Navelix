"use client";

import { useMemo, useState } from "react";
import BrandIcon from "@/components/brand-icon";
import AddCategoryModal from "@/components/add-category-modal";
import AddLinkModal from "@/components/add-link-modal";
import ConfirmDialog from "@/components/confirm-dialog";
import Modal from "@/components/modal";
import { useNavelixData } from "@/hooks/use-navelix-data";
import { useNavelixConfig } from "@/hooks/use-navelix-config";
import {
  useLinkStatus,
  getStatusType,
  type LinkStatus,
} from "@/hooks/use-link-status";
import { pushNotification } from "@/lib/notifications";
import { trackClientEvent } from "@/lib/client-analytics";
import type { Category, SiteLink } from "@/types";

type AdminTab =
  | "links"
  | "categories"
  | "quickAccess"
  | "analytics";

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

interface AdminLinksTabProps {
  activeTab: AdminTab;
}

export default function AdminLinksTab({ activeTab }: AdminLinksTabProps) {
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
  const [showDeleteAllLinksConfirm, setShowDeleteAllLinksConfirm] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<SiteLink | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [notice, setNotice] = useState("");

  // Helpers
  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "AI Tools";

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 2800);
  };

  const notify = (title: string, msg: string) => {
    flash(msg);
    pushNotification(title, msg);
  };

  // Filtered links
  const filteredLinks = useMemo(() => {
    let result = links;
    if (filterCategory !== "all") {
      result = result.filter((l) => l.category === filterCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.url.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          (l.notes || "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [links, filterCategory, searchQuery]);

  // Paginated links
  const paginatedLinks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLinks.slice(start, start + pageSize);
  }, [filteredLinks, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredLinks.length / pageSize) || 1;

  const linksInCategory = categoryToDelete
    ? links.filter((l) => l.category === categoryToDelete.id).length
    : 0;

  // Real usage statistics derived from localStorage link-click tracking.
  const usageStats = useMemo(() => {
    let usageMap: Record<string, { count: number; lastUsed: number }> = {};
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("navelix.link.usage");
        usageMap = raw ? JSON.parse(raw) : {};
      } catch {
        // ignore
      }
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayClicks = Object.values(usageMap)
      .filter((u) => u.lastUsed >= todayStart.getTime())
      .reduce((sum, u) => sum + u.count, 0);

    const categoryClicks = new Map<string, number>();
    links.forEach((l) => {
      const usage = usageMap[l.id];
      if (usage) {
        categoryClicks.set(
          l.category,
          (categoryClicks.get(l.category) || 0) + usage.count,
        );
      }
    });
    const topCategoryId =
      [...categoryClicks.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const ranked = links
      .map((l) => ({ link: l, usage: usageMap[l.id]?.count || 0 }))
      .sort((a, b) => b.usage - a.usage);
    const topLink = ranked[0]?.usage ? ranked[0].link : null;

    return { todayClicks, topCategoryId, topLink };
  }, [links]);

  // Handlers
  const handleLinkSave = (data: {
    title: string;
    url: string;
    description: string;
    category: string;
    icon: string;
    notes?: string;
  }) => {
    if (editingLink) {
      updateLink(editingLink.id, data);
      notify("链接管理", "链接修改成功");
      // 可选遥测：编辑链接（规范 wiki/Analytics §4.1）
      trackClientEvent("nav.link_edit", { linkId: editingLink.id, categoryId: data.category });
    } else {
      addLink(data);
      notify("链接管理", "链接添加成功");
      // 可选遥测：新增链接（规范 wiki/Analytics §4.1）
      trackClientEvent("nav.link_add", { categoryId: data.category });
    }
    setEditingLink(null);
  };

  const handleCategorySave = (name: string, icon: string, isTeamShared?: boolean) => {
    if (editingCategory) {
      updateCategory(editingCategory.id, { name, icon, isTeamShared });
      notify("分组管理", "分组修改成功");
    } else {
      addCategory(name, icon, isTeamShared);
      notify("分组管理", "分组添加成功");
    }
    setEditingCategory(null);
  };

  return (
    <>
      {/* Notice Flash */}
      {notice && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 dark:bg-slate-700 text-white text-xs px-4 py-2 rounded-xl shadow-lg">
          {notice}
        </div>
      )}

      {/* TAB 1: 🔗 链接管理 */}
      {activeTab === "links" && (
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
                  aria-label="搜索链接标题或网址"
                  placeholder="搜索链接标题或网址..."
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00C776]/30 focus:border-[#00C776]"
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
                aria-label="按分组筛选"
                className="h-9 px-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-700 dark:text-slate-200 font-medium focus:outline-none focus:border-[#00C776]"
              >
                <option value="all">所有分组</option>
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
                <span>检查连通性</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {links.length > 0 && (
                <button
                  onClick={() => setShowDeleteAllLinksConfirm(true)}
                  className="h-9 px-3.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/80 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>🗑️</span>
                  <span>一键清空所有链接 ({links.length})</span>
                </button>
              )}

              {/* Add New Link Action Button */}
              <button
                onClick={() => {
                  setEditingLink(null);
                  setShowAddLink(true);
                }}
                className="h-9 px-4 bg-[#00C776] hover:bg-[#009a5a] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <span className="text-sm">+</span>
                <span>添加新链接</span>
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-400 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="pb-3 pr-4">网站</th>
                  <th className="pb-3 pr-4">网址</th>
                  <th className="pb-3 pr-4">所属分组</th>
                  <th className="pb-3 pr-4">网络状态</th>
                  <th className="pb-3 text-right">操作</th>
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
                          className="text-gray-500 dark:text-slate-400 hover:text-[#00C776] dark:hover:text-[#00C776] truncate block transition-colors font-mono"
                        >
                          {link.url}
                        </a>
                      </td>

                      {/* Category Badge Column */}
                      <td className="py-3.5 pr-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900">
                          {categoryName(link.category)}
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
                            onClick={() => {
                              setEditingLink(link);
                              setShowAddLink(true);
                            }}
                            className="text-gray-500 dark:text-slate-400 hover:text-[#00C776] dark:hover:text-[#00C776] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span>✏️</span> 修改
                          </button>
                          <button
                            onClick={() => setLinkToDelete(link)}
                            className="text-gray-400 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span>🗑️</span> 删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {paginatedLinks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400 dark:text-slate-400">
                      暂无匹配链接
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Bottom Pagination Footer */}
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
            <span>共 {filteredLinks.length} 条数据</span>

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
                        ? "bg-teal-50 dark:bg-teal-950/60 border border-[#00C776] text-[#00C776]"
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
                aria-label="每页显示条数"
                className="h-7 px-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-xs text-gray-600 dark:text-slate-300"
              >
                <option value={10}>10 条/页</option>
                <option value={20}>20 条/页</option>
                <option value={50}>50 条/页</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 🗂️ 分组管理 */}
      {activeTab === "categories" && (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100/90 dark:border-slate-700 shadow-2xs transition-colors">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                分组管理 ({categories.length})
              </h2>
              <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                添加、修改与删除导航侧边栏的分组列表
              </p>
            </div>
            <button
              onClick={() => {
                setEditingCategory(null);
                setShowAddCategory(true);
              }}
              className="h-9 px-4 bg-[#00C776] hover:bg-[#009a5a] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="text-sm">+</span>
              <span>添加新分组</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-400 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="pb-3 pr-4">图标</th>
                  <th className="pb-3 pr-4">分组名称</th>
                  <th className="pb-3 pr-4">分组 ID</th>
                  <th className="pb-3 pr-4">包含链接数</th>
                  <th className="pb-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {categories.map((c) => {
                  const count = links.filter((l) => l.category === c.id).length;
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="py-3.5 pr-4 text-base">{c.icon}</td>
                      <td className="py-3.5 pr-4 font-bold text-gray-900 dark:text-white">{c.name}</td>
                      <td className="py-3.5 pr-4 font-mono text-gray-400 dark:text-slate-400">{c.id}</td>
                      <td className="py-3.5 pr-4">
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900">
                          {count} 个链接
                        </span>
                      </td>
                      <td className="py-3.5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch("/api/share/token", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ type: "category", id: c.id }),
                                });
                                if (!res.ok) throw new Error("获取失败");
                                const data = await res.json();
                                await navigator.clipboard.writeText(`${window.location.origin}${data.sharePath}`);
                                notify("免登录分享", `已复制「${c.name}」只读分享链接至剪贴板`);
                              } catch {
                                notify("免登录分享", "生成分享链接失败");
                              }
                            }}
                            title="复制免登录只读分享链接"
                            className="text-gray-500 dark:text-slate-400 hover:text-[#00C776] font-medium transition-colors cursor-pointer"
                          >
                            🔗 分享
                          </button>
                          <button
                            onClick={() => {
                              setEditingCategory(c);
                              setShowAddCategory(true);
                            }}
                            className="text-gray-500 dark:text-slate-400 hover:text-[#00C776] font-medium transition-colors cursor-pointer"
                          >
                            ✏️ 修改
                          </button>
                          <button
                            onClick={() => setCategoryToDelete(c)}
                            className="text-gray-400 dark:text-slate-400 hover:text-rose-500 font-medium transition-colors cursor-pointer"
                          >
                            🗑️ 删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: ⚡ 快捷访问管理 */}
      {activeTab === "quickAccess" && (
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
                      {categoryName(l.category)}
                    </td>
                    <td className="py-3.5 pr-4 font-mono text-xs text-gray-400 dark:text-slate-400 max-w-[200px] truncate">
                      {l.url}
                    </td>
                    <td className="py-3.5 text-right">
                      <button
                        onClick={() => {
                          toggleQuickAccess(l.id);
                          notify(
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
      )}

      {/* TAB 6: 📊 访问统计 */}
      {activeTab === "analytics" && (
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
                  ? categoryName(usageStats.topCategoryId)
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
      )}

      {/* Modals */}
      <AddLinkModal
        key={showAddLink ? (editingLink?.id ?? "new-link") : "closed-link"}
        open={showAddLink}
        categories={categories}
        defaultCategory={filterCategory !== "all" ? filterCategory : undefined}
        link={editingLink}
        onClose={() => {
          setShowAddLink(false);
          setEditingLink(null);
        }}
        onAdd={handleLinkSave}
      />

      <AddCategoryModal
        key={
          showAddCategory
            ? (editingCategory?.id ?? "new-category")
            : "closed-category"
        }
        open={showAddCategory}
        category={editingCategory}
        onClose={() => {
          setShowAddCategory(false);
          setEditingCategory(null);
        }}
        onAdd={handleCategorySave}
      />

      {/* Confirm Delete All Links Modal */}
      <Modal
        open={showDeleteAllLinksConfirm}
        title="⚠️ 确认要清空所有网址链接吗？"
        onClose={() => setShowDeleteAllLinksConfirm(false)}
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
            此操作将彻底删除您账号下现有的 <strong className="text-rose-600 font-bold">{links.length} 个</strong> 网址书签与快捷访问关联，<strong className="text-rose-600 font-bold">操作不可撤销！</strong>
          </p>
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-slate-800">
            <button
              onClick={() => setShowDeleteAllLinksConfirm(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 cursor-pointer transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => {
                const count = links.length;
                deleteAllLinks();
                setShowDeleteAllLinksConfirm(false);
                notify("链接管理", `已成功清空所有网址书签链接 (${count} 个)`);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer transition-colors"
            >
              确认彻底清空 ({links.length} 个)
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!linkToDelete}
        title="删除链接"
        message={`确定要删除链接 "${linkToDelete?.title}" 吗？`}
        onConfirm={() => {
          if (linkToDelete) {
            deleteLink(linkToDelete.id);
            notify("链接管理", "链接已删除");
            // 可选遥测：删除链接（规范 wiki/Analytics §4.1）
            trackClientEvent("nav.link_delete", { linkId: linkToDelete.id });
          }
        }}
        onClose={() => setLinkToDelete(null)}
      />

      <ConfirmDialog
        open={!!categoryToDelete}
        title="删除分组"
        message={`确定要删除分组 "${categoryToDelete?.name}" 吗？${
          linksInCategory > 0
            ? `该分组下的 ${linksInCategory} 个链接也将一并被移除。`
            : ""
        }`}
        onConfirm={() => {
          if (categoryToDelete) {
            deleteCategory(categoryToDelete.id);
            notify("分组管理", "分组已删除");
          }
        }}
        onClose={() => setCategoryToDelete(null)}
      />
    </>
  );
}