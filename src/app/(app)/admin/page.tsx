"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandIcon from "@/components/brand-icon";
import LogoMark from "@/components/logo-mark";
import AddCategoryModal from "@/components/add-category-modal";
import AddLinkModal from "@/components/add-link-modal";
import AvatarPicker from "@/components/avatar-picker";
import ConfirmDialog from "@/components/confirm-dialog";
import Modal from "@/components/modal";
import { useNavelixData } from "@/hooks/use-navelix-data";
import { useNavelixConfig } from "@/hooks/use-navelix-config";
import {
  useLinkStatus,
  type LinkStatus,
} from "@/hooks/use-link-status";
import { parseBookmarksHTML } from "@/lib/bookmarks";
import { parseSunPanelJSON } from "@/lib/sun-panel";
import { fileToDataUrl } from "@/lib/image-utils";
import {
  formatRelativeTime,
  pushNotification,
  type NotificationItem,
} from "@/lib/notifications";
import { resolveAvatar } from "@/lib/avatars";
import type { Category, SiteLink } from "@/types";
import AdminUsersPanel from "./admin-users";
import TodoAdminPanel from "@/components/todo-admin-panel";
import ProjectAdminPanel from "@/components/project-admin-panel";


type AdminTab =
  | "links"
  | "categories"
  | "quickAccess"
  | "projects"
  | "todos"
  | "personalization"
  | "users"
  | "data"
  | "analytics"
  | "system";

interface AdminNavItem {
  id: AdminTab;
  icon: string;
  label: string;
  badge?: number | string;
}

interface ManagedUser {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
  avatar: string;
  createdAt: number;
}

interface UpdateCheckResult {
  local: {
    sourceSha: string | null;
    buildDate: string | null;
    version: string | null;
    isDockerBuild: boolean;
  };
  remote: { digest: string | null; lastUpdated: string | null; versionTag: string | null } | null;
  updateAvailable: boolean | null;
  error: string | null;
}

const statusDot: Record<LinkStatus, string> = {
  online: "bg-emerald-500",
  offline: "bg-rose-500",
  checking: "animate-pulse bg-amber-400",
  unknown: "bg-gray-300",
};

const statusText: Record<LinkStatus, string> = {
  online: "在线",
  offline: "离线",
  checking: "检查中",
  unknown: "未知",
};

export default function AdminPage() {
  const router = useRouter();
  const {
    categories,
    links,
    hydrated,
    addCategory,
    updateCategory,
    deleteCategory,
    addLink,
    updateLink,
    deleteLink,
    deleteAllLinks,
    toggleQuickAccess,
    importData,
    resetData,
    mergeBookmarks,
  } = useNavelixData();

  const { config, updateConfig, resetConfig, isDark } = useNavelixConfig();

  // Active Admin Tab
  const [activeTab, setActiveTab] = useState<AdminTab>("links");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  // Header Interactive Controls State
  const [showAdminNotifications, setShowAdminNotifications] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState<
    NotificationItem[]
  >([]);
  const [showAdminUserMenu, setShowAdminUserMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const adminUnread = adminNotifications.some((n) => !n.read);

  const handleOpenAdminNotifications = async () => {
    const nextState = !showAdminNotifications;
    setShowAdminNotifications(nextState);
    setShowAdminUserMenu(false);
    if (nextState) {
      try {
        const res = await fetch("/api/notifications");
        const data = await res.json();
        if (Array.isArray(data.notifications)) {
          setAdminNotifications(data.notifications);
        }
      } catch {
        // ignore
      }
      fetch("/api/notifications/read", { method: "POST" }).catch(() => {});
      setAdminNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals state
  const [showAddLink, setShowAddLink] = useState(false);
  const [editingLink, setEditingLink] = useState<SiteLink | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showDeleteAllLinksConfirm, setShowDeleteAllLinksConfirm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [linkToDelete, setLinkToDelete] = useState<SiteLink | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [showReset, setShowReset] = useState(false);
  const [notice, setNotice] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const bookmarkFileRef = useRef<HTMLInputElement>(null);
  const sunPanelFileRef = useRef<HTMLInputElement>(null);
  const adminNotifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (adminNotifRef.current && !adminNotifRef.current.contains(event.target as Node)) {
        setShowAdminNotifications(false);
      }
    }
    if (showAdminNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAdminNotifications]);

  // User Management state
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);

  // User Form State
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newAvatar, setNewAvatar] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [userFormError, setUserFormError] = useState("");

  const [currentUser, setCurrentUser] = useState<{
    username: string;
    displayName: string;
    role: "admin" | "user";
    avatar?: string;
  } | null>(null);
  const [avatarDraft, setAvatarDraft] = useState("");
  const [avatarDraftSource, setAvatarDraftSource] = useState("");
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(
    null,
  );
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const autoCheckedUpdateRef = useRef(false);

  const { statuses, refresh: refreshStatuses } = useLinkStatus(
    config.linkStatusEnabled ? links : [],
    (config.linkStatusInterval || 60) * 1000,
  );

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        const user = data.user ?? null;
        setCurrentUser(user);
        // 仅管理员拉取用户列表，避免非管理员触发 403
        if (user?.role === "admin") {
          fetch("/api/admin/users")
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (d && Array.isArray(d.users)) {
                setUsers(d.users);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => setCurrentUser(null));
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.notifications)) {
          setAdminNotifications(data.notifications);
        }
      })
      .catch(() => {});
  }, []);

  // 打开个性化设置时同步当前头像草稿（渲染期同步，避免 effect 重置用户正在编辑的草稿）
  if (
    activeTab === "personalization" &&
    currentUser &&
    avatarDraftSource !== (currentUser.avatar || "")
  ) {
    setAvatarDraft(currentUser.avatar || "");
    setAvatarDraftSource(currentUser.avatar || "");
  }

  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "AI Tools";

  const adminNavItems: AdminNavItem[] = [
    { id: "links", icon: "🔗", label: "链接管理", badge: links.length },
    { id: "categories", icon: "🗂️", label: "分组管理", badge: categories.length },
    {
      id: "quickAccess",
      icon: "⚡",
      label: "快捷访问",
      badge: links.filter((l) => l.isQuickAccess).length,
    },
    { id: "todos", icon: "✅", label: "待办事项" },
    { id: "projects", icon: "📁", label: "项目管理" },
    { id: "personalization", icon: "🎨", label: "个性化设置" },
    ...(currentUser?.role === "admin"
      ? [
          {
            id: "users" as AdminTab,
            icon: "👤",
            label: "账号管理",
            badge: users.length || 1,
          },
        ]
      : []),
    { id: "data", icon: "📦", label: "配置导入导出" },
    { id: "analytics", icon: "📊", label: "访问统计" },
    { id: "system", icon: "⚙️", label: "系统设置" },
  ];

  const renderNavButton = (item: AdminNavItem) => {
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => setActiveTab(item.id)}
        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap ${
          isActive
            ? "bg-[#00C776] text-white shadow-sm shadow-[#00C776]/20"
            : "text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm">{item.icon}</span>
          <span className="truncate">{item.label}</span>
        </div>
        {typeof item.badge !== "undefined" && (
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
              isActive
                ? "bg-white/20 text-white"
                : item.id === "links" || item.id === "quickAccess"
                  ? "bg-teal-50 dark:bg-teal-950/60 text-[#00C776]"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400"
            }`}
          >
            {item.badge}
          </span>
        )}
      </button>
    );
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
          l.description.toLowerCase().includes(q),
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

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 2800);
  };

  // 操作成功：页面提示 + 写入前台通知记录
  const notify = (title: string, msg: string) => {
    flash(msg);
    pushNotification(title, msg);
  };

  const handleAvatarSave = async () => {
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: avatarDraft }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setCurrentUser(data.user);
        notify("系统设置", "头像更新成功");
      } else {
        flash(data.error || "头像保存失败");
      }
    } catch {
      flash("头像保存失败");
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file, 128);
      updateConfig({ logoImage: dataUrl });
    } catch {
      flash("图片读取失败");
    }
    e.target.value = "";
  };

  const handleClearNotifications = async () => {
    try {
      const res = await fetch("/api/notifications", { method: "DELETE" });
      if (res.ok) {
        setAdminNotifications([]);
        flash("操作记录已清空");
      } else {
        flash("清空失败");
      }
    } catch {
      flash("清空失败");
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const res = await fetch("/api/update-check");
      const data = await res.json();
      setUpdateResult(data);
    } catch {
      setUpdateResult({
        local: { sourceSha: null, buildDate: null, version: null, isDockerBuild: false },
        remote: null,
        updateAvailable: null,
        error: "检查失败，请稍后重试",
      });
    } finally {
      setCheckingUpdate(false);
    }
  };

  // 进入系统设置页时自动检查一次更新
  useEffect(() => {
    if (activeTab !== "system" || autoCheckedUpdateRef.current) return;
    autoCheckedUpdateRef.current = true;
    let cancelled = false;
    fetch("/api/update-check")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setUpdateResult(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FA] dark:bg-[#151218] text-sm text-gray-400">
        加载中…
      </div>
    );
  }

  const handleLinkSave = (data: {
    title: string;
    url: string;
    description: string;
    category: string;
    icon: string;
  }) => {
    if (editingLink) {
      updateLink(editingLink.id, data);
      notify("链接管理", "链接修改成功");
    } else {
      addLink(data);
      notify("链接管理", "链接添加成功");
    }
    setEditingLink(null);
  };

  const handleCategorySave = (name: string, icon: string) => {
    if (editingCategory) {
      updateCategory(editingCategory.id, { name, icon });
      notify("分组管理", "分组修改成功");
    } else {
      addCategory(name, icon);
      notify("分组管理", "分组添加成功");
    }
    setEditingCategory(null);
  };

  const handleUserFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError("");

    if (editingUser) {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingUser.id,
          username: newUsername,
          role: newRole,
          displayName: newDisplayName,
          avatar: newAvatar,
          password: newPassword || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUserFormError(data.error || "修改账号失败");
        return;
      }

      notify("账号管理", "账号更新成功");
      setEditingUser(null);
      setShowAddUser(false);
      fetchUsers();
      fetch("/api/auth/me")
        .then((r) => r.json())
        .then((data) => setCurrentUser(data.user ?? null))
        .catch(() => {});
    } else {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          displayName: newDisplayName,
          avatar: newAvatar,
          role: newRole,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUserFormError(data.error || "创建用户失败");
        return;
      }

      notify("账号管理", "新账号创建成功");
      setShowAddUser(false);
      setNewUsername("");
      setNewPassword("");
      setNewDisplayName("");
      setNewAvatar("");
      setNewRole("user");
      fetchUsers();
    }
  };

  const handleDeleteUserConfirm = async () => {
    if (!userToDelete) return;
    const res = await fetch(`/api/admin/users?id=${userToDelete.id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      notify("账号管理", `用户 @${userToDelete.username} 已成功删除`);
      setUserToDelete(null);
      fetchUsers();
    } else {
      const data = await res.json().catch(() => ({}));
      flash(`删除失败: ${data.error || "无法删除用户"}`);
      setUserToDelete(null);
    }
  };

  const handleExport = () => {
    // Never write the AI API key into an exported config file.
    const safeConfig = { ...config };
    delete safeConfig.aiApiKey;
    delete safeConfig.weatherApiKey;
    const data = JSON.stringify(
      { categories, links, config: safeConfig, exportTime: new Date().toISOString() },
      null,
      2,
    );
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `navelix-full-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("数据管理", "全量配置文件导出成功");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const cats: Category[] = Array.isArray(parsed.categories)
          ? parsed.categories.filter(
              (c: { id?: unknown; name?: unknown }) =>
                c && typeof c.id === "string" && typeof c.name === "string",
            )
          : [];
        const lnks: SiteLink[] = Array.isArray(parsed.links)
          ? parsed.links.filter(
              (l: { id?: unknown; title?: unknown; url?: unknown }) =>
                l &&
                typeof l.id === "string" &&
                typeof l.title === "string" &&
                typeof l.url === "string",
            )
          : [];
        if (parsed.config) {
          // Do not restore a previously exported API key.
          const safeCfg = { ...parsed.config };
          delete safeCfg.aiApiKey;
          delete safeCfg.weatherApiKey;
          updateConfig(safeCfg);
        }
        importData(cats, lnks);
        notify(
          "数据管理",
          `全量配置导入成功：包含 ${lnks.length} 个链接与 ${cats.length} 个分组`,
        );
      } catch {
        flash("导入失败：无效的 JSON 配置文件");
      }
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const handleBookmarksImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { categories: cats, links: lnks } = parseBookmarksHTML(
          String(reader.result),
        );
        mergeBookmarks(cats, lnks);
        notify("数据管理", `书签导入成功：合并添加 ${lnks.length} 个链接`);
      } catch {
        flash("导入失败：无效的书签文件");
      }
      if (bookmarkFileRef.current) bookmarkFileRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const handleSunPanelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { categories: cats, links: lnks } = parseSunPanelJSON(
          String(reader.result),
        );
        mergeBookmarks(cats, lnks);
        notify(
          "数据管理",
          `☀️ Sun-Panel 配置导入成功：解析并合并导入 ${lnks.length} 个链接与 ${cats.length} 个分组`,
        );
      } catch (err) {
        flash(
          `Sun-Panel 导入失败：${err instanceof Error ? err.message : "无效的 Sun-Panel 配置文件"}`,
        );
      }
      if (sunPanelFileRef.current) sunPanelFileRef.current.value = "";
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F8FA] dark:bg-[#151218] text-gray-900 dark:text-slate-100 font-sans antialiased transition-colors duration-200 lg:flex-row">
      {/* 1. Left Admin Sidebar Matching Reference Image */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col justify-between h-screen sticky top-0 border-r border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 select-none z-30 transition-colors">
        <div className="flex flex-col gap-6">
          {/* Brand Logo Header */}
          <div className="flex items-center gap-3 px-1">
            <LogoMark size="md" />
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold tracking-tight text-gray-900 dark:text-white truncate">
                _{config.logoText.toLowerCase() || "navelix"} Navelix
              </span>
              <span className="text-[10px] font-medium text-gray-400 dark:text-slate-400">
                后台管理控制台
              </span>
            </div>
          </div>

          {/* Admin Navigation Menu Items with Badge Counters */}
          <nav className="flex flex-col gap-1.5">
            {adminNavItems.map((item) => renderNavButton(item))}
          </nav>
        </div>

        {/* Bottom Profile Card */}
        <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
          <div
            onClick={() => setShowProfileModal(true)}
            className="flex items-center justify-between p-2.5 bg-gray-50/80 dark:bg-slate-800/80 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 transition-colors cursor-pointer group select-none"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00C776] to-[#009a5a] flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden shadow-2xs">
                {/* eslint-disable-next-line @next/next/no-img-element -- 头像可能是任意图片地址或 data URL */}
                <img
                  src={resolveAvatar(currentUser?.avatar, currentUser?.username)}
                  alt={currentUser?.displayName || "Admin"}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                  {currentUser?.displayName || currentUser?.username || "Admin"}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-slate-400 truncate">
                  {currentUser?.role === "admin" ? "超级管理员" : "普通用户"}
                </span>
              </div>
            </div>
            <svg className="w-3.5 h-3.5 text-gray-400 dark:text-slate-400 group-hover:text-gray-700 dark:group-hover:text-white transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </aside>

      {/* 2. Main Right Admin Workspace Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar Matching Reference Image */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-20 backdrop-blur-md transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <button className="text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5 truncate">
                欢迎回来，{currentUser?.displayName || currentUser?.username || "Admin"} 👋
              </h1>
              <p className="hidden sm:block text-xs text-gray-400 dark:text-slate-400">
                今天是美好的一天，继续高效管理你的导航链接吧！
              </p>
            </div>
          </div>

          <div className="relative flex items-center gap-4">
            {/* 1. Theme Toggle Button */}
            <button
              onClick={() => {
                const order: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
                const idx = order.indexOf(config.theme);
                updateConfig({ theme: order[(idx + 1) % order.length] });
              }}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-gray-100 dark:border-slate-700 transition-all cursor-pointer shadow-2xs"
              title={config.theme === "system" ? "跟随系统" : config.theme === "dark" ? "切换至浅色模式" : "切换至深色模式"}
            >
              {config.theme === "system" ? (
                <svg className="w-4 h-4 text-[#00C776]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                </svg>
              ) : config.theme === "dark" ? (
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* 2. Notification Bell Button with Drawer */}
            <button
              onClick={handleOpenAdminNotifications}
              className={`relative p-2 rounded-xl transition-colors cursor-pointer ${
                showAdminNotifications
                  ? "bg-[#00C776]/10 text-[#00C776]"
                  : "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
              }`}
              title="消息通知"
            >
              🔔
              {adminUnread && (
                <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
              )}
              {adminUnread && (
                <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-rose-500" />
              )}
            </button>

            {/* Admin Notifications Popover */}
            {showAdminNotifications && (
              <div
                ref={adminNotifRef}
                className="absolute top-12 right-24 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-3.5 z-50 animate-fadeIn text-left"
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-slate-700">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                      后台消息通知
                    </span>
                    {adminUnread && (
                      <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600 text-[10px] font-bold">
                        {adminNotifications.filter((n) => !n.read).length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {adminUnread && (
                      <button
                        onClick={() => {
                          fetch("/api/notifications/read", {
                            method: "POST",
                          }).catch(() => {});
                          setAdminNotifications((prev) =>
                            prev.map((n) => ({ ...n, read: true })),
                          );
                          setShowAdminNotifications(false);
                        }}
                        className="text-[10px] text-[#00C776] hover:underline cursor-pointer"
                      >
                        全部已读
                      </button>
                    )}
                    <button
                      onClick={() => setShowAdminNotifications(false)}
                      className="w-5 h-5 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-xs"
                      title="关闭消息"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                  {adminNotifications.length === 0 ? (
                    <div className="py-6 text-center text-[11px] text-gray-400 dark:text-slate-400">
                      暂无操作记录
                    </div>
                  ) : (
                    adminNotifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-2 rounded-xl text-xs ${
                          !n.read
                            ? "bg-teal-50/60 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900"
                            : "bg-gray-50/60 dark:bg-slate-700/40"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="font-bold text-gray-900 dark:text-white truncate">
                            {n.title}
                          </p>
                          <span className="text-[9px] text-gray-400 shrink-0 ml-2">
                            {formatRelativeTime(n.createdAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-600 dark:text-slate-300 break-all">
                          {n.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 3. Admin User Profile Badge with Dropdown */}
            <div
              onClick={() => {
                setShowAdminUserMenu(!showAdminUserMenu);
                setShowAdminNotifications(false);
              }}
              className="flex items-center gap-2 px-2.5 py-1 bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-gray-100 dark:border-slate-700 rounded-xl cursor-pointer select-none transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#3B82F6] to-[#00C776] text-white text-[10px] font-bold flex items-center justify-center overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- 头像可能是任意图片地址或 data URL */}
                <img
                  src={resolveAvatar(currentUser?.avatar, currentUser?.username)}
                  alt={currentUser?.displayName || "User"}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-xs font-bold text-gray-800 dark:text-white truncate max-w-[100px]">
                {currentUser?.displayName || currentUser?.username || "Admin"}
              </span>
              <span className="text-[10px] text-gray-400">v</span>
            </div>

            {/* Admin User Profile Dropdown Menu */}
            {showAdminUserMenu && (
              <div className="absolute top-12 right-0 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-1.5 z-50 animate-fadeIn flex flex-col gap-1 text-xs font-semibold text-gray-700 dark:text-slate-200">
                <Link
                  href="/"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <span>🏠</span>
                  <span>返回前台主页</span>
                </Link>
                <button
                  onClick={() => {
                    setShowAdminUserMenu(false);
                    setShowProfileModal(true);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 text-left transition-colors cursor-pointer"
                >
                  <span>👤</span>
                  <span>个人账号中心</span>
                </button>
                <div className="my-1 border-t border-gray-100 dark:border-slate-700" />
                <button
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    router.push("/login");
                    router.refresh();
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left transition-colors cursor-pointer"
                >
                  <span>🚪</span>
                  <span>退出当前登录</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Mobile Admin Tab Bar */}
        <div className="lg:hidden sticky top-16 z-10 flex gap-1.5 overflow-x-auto border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
          {adminNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === item.id
                  ? "bg-[#00C776] text-white"
                  : "bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {typeof item.badge !== "undefined" && (
                <span className="text-[10px] opacity-70">{item.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Workspace Body */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {notice && (
            <div className="mb-4 rounded-xl border border-[#00C776]/30 bg-[#00C776]/10 px-4 py-2.5 text-xs font-semibold text-[#009a5a] shadow-2xs">
              {notice}
            </div>
          )}

          {/* 4 Top Metric Summary Cards Matching Reference Screenshot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Card 1: 链接总数 */}
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100/90 dark:border-slate-700 shadow-2xs flex items-start justify-between transition-colors">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-400 dark:text-slate-400 mb-1">链接总数</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-gray-900 dark:text-white">{links.length}</span>
                </div>
                <span className="text-[11px] text-gray-400 dark:text-slate-400 mt-2">实时统计</span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-[#00C776] text-lg font-bold">
                🔗
              </div>
            </div>

            {/* Card 2: 分组总数 */}
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100/90 dark:border-slate-700 shadow-2xs flex items-start justify-between transition-colors">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-400 dark:text-slate-400 mb-1">分组总数</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-gray-900 dark:text-white">{categories.length}</span>
                </div>
                <span className="text-[11px] text-gray-400 dark:text-slate-400 mt-2">实时统计</span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-500 text-lg font-bold">
                🗂️
              </div>
            </div>

            {/* Card 3: 注册用户数 */}
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100/90 dark:border-slate-700 shadow-2xs flex items-start justify-between transition-colors">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-400 dark:text-slate-400 mb-1">注册用户数</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
                    {currentUser?.role === "admin" ? users.length : "—"}
                  </span>
                </div>
                <span className="text-[11px] text-gray-400 dark:text-slate-400 mt-2">
                  {currentUser?.role === "admin" ? "系统内全部账号" : "仅管理员可见"}
                </span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-500 text-lg font-bold">
                👤
              </div>
            </div>

            {/* Card 4: 内容区域宽度 */}
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100/90 dark:border-slate-700 shadow-2xs flex items-start justify-between transition-colors">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-400 dark:text-slate-400 mb-1">内容区域宽度</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-gray-900 dark:text-white">{config.maxWidth}</span>
                </div>
                <span className="text-[11px] text-gray-400 dark:text-slate-400 mt-2">当前设置</span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-500 text-lg font-bold">
                💻
              </div>
            </div>
          </div>

          {/* TAB 1: 🔗 链接管理 (Main Data Table Card matching reference image) */}
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
                                  statusDot[statuses[link.id] ?? "unknown"]
                                }`}
                              />
                              <span className="text-gray-600 dark:text-slate-300 font-medium">
                                {statusText[statuses[link.id] ?? "unknown"]}
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


          {/* TAB 3.5: ✅ 待办事项管理 */}
          {activeTab === "todos" && <TodoAdminPanel />}

          {/* TAB 3.6: 📁 项目管理 */}
          {activeTab === "projects" && <ProjectAdminPanel />}

          {/* TAB 3: 🎨 个性化设置 */}
          {activeTab === "personalization" && (
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100/90 dark:border-slate-700 shadow-2xs space-y-6 transition-colors">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">个性化参数设置</h2>
                <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                  自定义头像、LOGO 文本、搜索栏显示/隐藏、内容宽度、页脚与社交链接
                </p>
              </div>

              {/* Avatar Config */}
              <div className="pt-5 border-t border-gray-100 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">🖼️</span>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      头像设置
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-slate-400">
                      选择系统内置头像或上传本地图片，保存后全局生效
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/60 p-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    {/* eslint-disable-next-line @next/next/no-img-element -- 头像可能是任意图片地址或 data URL */}
                    <img
                      src={resolveAvatar(avatarDraft, currentUser?.username)}
                      alt="当前头像"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-gray-900 dark:text-white">
                      {currentUser?.displayName || currentUser?.username || "用户"}
                    </p>
                    <p className="mt-0.5 text-[10px] text-gray-400 dark:text-slate-400">
                      系统内置头像 / 上传图片，保存后全局生效
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAvatarModal(true)}
                    className="shrink-0 h-9 px-4 rounded-lg bg-[#00C776] hover:bg-[#009a5a] text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    🖼️ 修改头像
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
                  <label
                    htmlFor="admin-logo"
                    className="block text-xs font-bold text-gray-800 dark:text-slate-200"
                  >
                    LOGO 显示文本内容
                  </label>
                  <input
                    id="admin-logo"
                    name="logoText"
                    type="text"
                    value={config.logoText}
                    onChange={(e) => updateConfig({ logoText: e.target.value })}
                    placeholder="例如 Navelix"
                    className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
                  <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
                    LOGO 图标（可选）
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-tr from-[#009a5a] via-[#00C776] to-[#33d68a] text-lg font-extrabold text-white shadow-sm">
                      {config.logoImage ? (
                        /* eslint-disable-next-line @next/next/no-img-element -- 上传的 LOGO 图片 */
                        <img
                          src={config.logoImage}
                          alt="LOGO"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        config.logoText.slice(0, 1).toUpperCase() || "N"
                      )}
                    </div>
                    <input
                      type="file"
                      name="logo-upload"
                      accept="image/*"
                      aria-label="上传 LOGO 图片"
                      onChange={handleLogoUpload}
                      className="min-w-0 flex-1 text-xs text-gray-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#00C776]/10 file:text-[#009a5a] file:text-xs file:font-semibold file:cursor-pointer cursor-pointer"
                    />
                    {config.logoImage && (
                      <button
                        type="button"
                        onClick={() => updateConfig({ logoImage: "" })}
                        className="shrink-0 text-[11px] text-red-400 hover:text-red-600 cursor-pointer"
                      >
                        清除
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-slate-400">
                    支持 PNG / JPG / SVG，上传后替代默认字母 Logo，留空使用默认样式
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
                  <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
                    搜索栏组件显示状态
                  </label>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-gray-600 dark:text-slate-300">
                      {config.showSearchBar ? "当前状态：已显示搜索栏" : "当前状态：已隐藏搜索栏"}
                    </span>
                    <button
                      onClick={() => updateConfig({ showSearchBar: !config.showSearchBar })}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        config.showSearchBar ? "bg-[#00C776] text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                      }`}
                    >
                      {config.showSearchBar ? "隐藏" : "显示"}
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
                  <label
                    htmlFor="admin-max-width"
                    className="block text-xs font-bold text-gray-800 dark:text-slate-200"
                  >
                    内容区域最大宽度 (默认 1200px)
                  </label>
                  <select
                    id="admin-max-width"
                    name="maxWidth"
                    value={config.maxWidth}
                    onChange={(e) =>
                      updateConfig({
                        maxWidth: e.target.value as "1000px" | "1200px" | "1400px" | "full",
                      })
                    }
                    className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  >
                    <option value="1200px">1200px (标准 1200px)</option>
                    <option value="1000px">1000px (紧凑布局)</option>
                    <option value="1400px">1400px (宽屏显示)</option>
                    <option value="full">100% 全屏</option>
                  </select>
                </div>

                <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
                  <label
                    htmlFor="admin-footer"
                    className="block text-xs font-bold text-gray-800 dark:text-slate-200"
                  >
                    自定义页脚版权文案
                  </label>
                  <input
                    id="admin-footer"
                    name="customFooter"
                    type="text"
                    value={config.customFooter}
                    onChange={(e) => updateConfig({ customFooter: e.target.value })}
                    placeholder="© 2026 Navelix. 保留所有权利。"
                    className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* AI Assistant API Config Section */}
              <div className="pt-5 border-t border-gray-100 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">🤖</span>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      AI 智能助手 API 配置 (BaseURL & API Key)
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-slate-400">
                      配置标准 OpenAI 兼容大模型 API，支持 DeepSeek、ChatGPT、OneAPI、Ollama、Qwen 等。
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
                    <label
                      htmlFor="admin-ai-base-url"
                      className="block text-xs font-bold text-gray-800 dark:text-slate-200"
                    >
                      AI BaseURL 地址
                    </label>
                    <input
                      id="admin-ai-base-url"
                      name="aiBaseUrl"
                      type="text"
                      value={config.aiBaseUrl || ""}
                      onChange={(e) => updateConfig({ aiBaseUrl: e.target.value })}
                      placeholder="https://api.openai.com/v1"
                      className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                    />
                    <p className="text-[10px] text-gray-400 dark:text-slate-400">
                      支持第三方中转或自建 API 代理服务
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
                    <label
                      htmlFor="admin-ai-api-key"
                      className="block text-xs font-bold text-gray-800 dark:text-slate-200"
                    >
                      API Key 密钥
                    </label>
                    <input
                      id="admin-ai-api-key"
                      name="aiApiKey"
                      type="password"
                      value={config.aiApiKey ?? ""}
                      onChange={(e) => updateConfig({ aiApiKey: e.target.value })}
                      placeholder={config.aiKeyConfigured ? "已配置 - 留空则保持不变" : "sk-...（未配置）"}
                      className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                    />
                    <p className="text-[10px] text-gray-400 dark:text-slate-400">
                      密钥安全保存在当前账号的独立配置中
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
                    <label
                      htmlFor="admin-ai-model"
                      className="block text-xs font-bold text-gray-800 dark:text-slate-200"
                    >
                      模型名称 (Model)
                    </label>
                    <input
                      id="admin-ai-model"
                      name="aiModel"
                      type="text"
                      value={config.aiModel || ""}
                      onChange={(e) => updateConfig({ aiModel: e.target.value })}
                      placeholder="gpt-4o-mini 或 deepseek-chat"
                      className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                    />
                    <p className="text-[10px] text-gray-400 dark:text-slate-400">
                      例如: gpt-4o-mini, deepseek-chat, qwen-max
                    </p>
                  </div>
                </div>
              </div>

              {/* Social Links Config */}
              <div className="pt-5 border-t border-gray-100 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">🔗</span>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      社交链接
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-slate-400">
                      配置首页右下角的 GitHub / X / LinkedIn / 邮箱入口，留空则隐藏该图标
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
                    <label
                      htmlFor="admin-social-github"
                      className="block text-xs font-bold text-gray-800 dark:text-slate-200"
                    >
                      GitHub 链接
                    </label>
                    <input
                      id="admin-social-github"
                      name="socialGithub"
                      type="text"
                      value={config.socialGithub || ""}
                      onChange={(e) =>
                        updateConfig({ socialGithub: e.target.value })
                      }
                      placeholder="https://github.com/你的账号"
                      className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                    />
                  </div>

                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
                    <label
                      htmlFor="admin-social-x"
                      className="block text-xs font-bold text-gray-800 dark:text-slate-200"
                    >
                      X (Twitter) 链接
                    </label>
                    <input
                      id="admin-social-x"
                      name="socialX"
                      type="text"
                      value={config.socialX || ""}
                      onChange={(e) => updateConfig({ socialX: e.target.value })}
                      placeholder="https://x.com/你的账号"
                      className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                    />
                  </div>

                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
                    <label
                      htmlFor="admin-social-linkedin"
                      className="block text-xs font-bold text-gray-800 dark:text-slate-200"
                    >
                      LinkedIn 链接
                    </label>
                    <input
                      id="admin-social-linkedin"
                      name="socialLinkedin"
                      type="text"
                      value={config.socialLinkedin || ""}
                      onChange={(e) =>
                        updateConfig({ socialLinkedin: e.target.value })
                      }
                      placeholder="https://linkedin.com/in/你的账号"
                      className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                    />
                  </div>

                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
                    <label
                      htmlFor="admin-social-email"
                      className="block text-xs font-bold text-gray-800 dark:text-slate-200"
                    >
                      邮箱地址
                    </label>
                    <input
                      id="admin-social-email"
                      name="socialEmail"
                      type="text"
                      value={config.socialEmail || ""}
                      onChange={(e) =>
                        updateConfig({ socialEmail: e.target.value })
                      }
                      placeholder="you@example.com"
                      className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Weather Config */}
              <div className="pt-5 border-t border-gray-100 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">🌤️</span>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      天气服务
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-slate-400">
                      配置天气 API，开启后侧边栏可查看实时天气（默认心知天气 / Seniverse）
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 启用开关 */}
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
                    <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
                      启用天气
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          updateConfig({ weatherEnabled: !config.weatherEnabled })
                        }
                        className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                          config.weatherEnabled
                            ? "bg-[#00C776]"
                            : "bg-gray-300 dark:bg-slate-600"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                            config.weatherEnabled ? "translate-x-5" : ""
                          }`}
                        />
                      </button>
                      <span className="text-[11px] text-gray-500 dark:text-slate-400">
                        {config.weatherEnabled ? "已启用" : "已关闭"}
                      </span>
                    </div>
                  </div>


                  {/* API Key */}
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
                    <label
                      htmlFor="admin-weather-api-key"
                      className="block text-xs font-bold text-gray-800 dark:text-slate-200"
                    >
                      API Key / 密钥
                    </label>
                    <input
                      id="admin-weather-api-key"
                      name="weatherApiKey"
                      type="password"
                      value={config.weatherApiKey ?? ""}
                      onChange={(e) =>
                        updateConfig({ weatherApiKey: e.target.value })
                      }
                      placeholder={config.weatherKeyConfigured ? "已配置 - 留空则保持不变" : "心知天气 API Key（未配置）"}
                      className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                    />
                    <p className="text-[10px] text-gray-400 dark:text-slate-400">
                      密钥安全保存在当前账号的独立配置中
                    </p>
                  </div>

                  {/* 位置坐标 */}
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
                    <label
                      htmlFor="admin-weather-location"
                      className="block text-xs font-bold text-gray-800 dark:text-slate-200"
                    >
                      位置坐标 / LocationID
                    </label>
                    <input
                      id="admin-weather-location"
                      name="weatherLocation"
                      type="text"
                      value={config.weatherLocation || ""}
                      onChange={(e) =>
                        updateConfig({ weatherLocation: e.target.value })
                      }
                      placeholder="城市拼音 或 经纬度"
                      className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                    />
                    <p className="text-[10px] text-gray-400 dark:text-slate-400">
                      心知天气支持城市拼音、中文名、经纬度或 LocationID
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: 👤 账号管理 */}
                    {activeTab === "users" && currentUser?.role === "admin" && <AdminUsersPanel />}
          {/* TAB 5: 📦 配置导入导出 */}
          {activeTab === "data" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Sun-Panel JSON 兼容导入 */}
              <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-teal-100 dark:border-teal-900/60 shadow-2xs space-y-3 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-lg">☀️</span>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    导入 Sun-Panel 配置文件
                  </h3>
                </div>
                <p className="text-xs text-gray-400 dark:text-slate-400">
                  无缝兼容 Sun-Panel 导出的 JSON 配置文件，自动解析分类分组与导航网址并合并至当前账号。
                </p>
                <input
                  ref={sunPanelFileRef}
                  type="file"
                  name="sun-panel-file"
                  accept=".json,application/json"
                  aria-label="选择 Sun-Panel JSON 文件"
                  className="hidden"
                  onChange={handleSunPanelImport}
                />
                <button
                  onClick={() => sunPanelFileRef.current?.click()}
                  className="px-4 py-2 bg-[#00C776] hover:bg-[#009a5a] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>☀️</span>
                  <span>选择 Sun-Panel JSON 文件</span>
                </button>
              </div>

              {/* Card 2: Chrome / 浏览器 HTML 书签导入 */}
              <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-3 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🌐</span>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    导入 Chrome / 浏览器 HTML 书签
                  </h3>
                </div>
                <p className="text-xs text-gray-400 dark:text-slate-400">
                  解析 Chrome、Edge 或 Safari 导出的 HTML 书签文件，自动分类合并至系统。
                </p>
                <input
                  ref={bookmarkFileRef}
                  type="file"
                  name="bookmark-file"
                  accept=".html,text/html"
                  aria-label="选择 HTML 书签文件"
                  className="hidden"
                  onChange={handleBookmarksImport}
                />
                <button
                  onClick={() => bookmarkFileRef.current?.click()}
                  className="px-4 py-2 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-600 dark:text-sky-400 text-xs font-semibold rounded-xl border border-sky-200 dark:border-sky-900 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>🌐</span>
                  <span>选择 HTML 书签文件</span>
                </button>
              </div>

              {/* Card 3: 导出全量 Navelix JSON */}
              <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-3 transition-colors">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">导出全量配置 JSON</h3>
                <p className="text-xs text-gray-400 dark:text-slate-400">
                  导出包含全量书签、分组与个性化外观在内的 Navelix JSON 配置文件。
                </p>
                <button
                  onClick={handleExport}
                  className="px-4 py-2 bg-gray-900 dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  导出 Navelix 配置 JSON
                </button>
              </div>

              {/* Card 4: 导入全量 Navelix JSON */}
              <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-3 transition-colors">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">导入全量 Navelix JSON</h3>
                <p className="text-xs text-gray-400 dark:text-slate-400">
                  选择 Navelix 导出的 JSON 文件一键还原书签与外观配置。
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  name="navelix-config-file"
                  accept=".json,application/json"
                  aria-label="选择 Navelix JSON 文件"
                  className="hidden"
                  onChange={handleImport}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  选择 Navelix JSON 文件
                </button>
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

          {/* TAB 7: ⚙️ 系统设置 */}
          {activeTab === "system" && (
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">系统全局参数设置</h2>
                <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                  站点标题、搜索引擎、链接状态检测与数据维护
                </p>
              </div>
              <div className="max-w-md space-y-3">
                <div>
                  <label
                    htmlFor="admin-site-title"
                    className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1"
                  >
                    站点标题（浏览器标签页）
                  </label>
                  <input
                    id="admin-site-title"
                    name="siteTitle"
                    type="text"
                    value={config.siteTitle || ""}
                    onChange={(e) => updateConfig({ siteTitle: e.target.value })}
                    placeholder="Navelix · Personal Digital Hub"
                    className="w-full h-9 border border-gray-200 dark:border-slate-700 rounded-lg px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="admin-search-engine"
                    className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1"
                  >
                    默认搜索引擎
                  </label>
                  <select
                    id="admin-search-engine"
                    name="searchEngine"
                    value={config.searchEngine}
                    onChange={(e) =>
                      updateConfig({
                        searchEngine: e.target.value as "google" | "baidu" | "bing" | "perplexity",
                      })
                    }
                    className="w-full h-9 border border-gray-200 dark:border-slate-700 rounded-lg px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  >
                    <option value="google">Google</option>
                    <option value="baidu">Baidu</option>
                    <option value="bing">Bing</option>
                    <option value="perplexity">Perplexity AI</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
                  <div>
                    <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
                      链接状态检测
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
                      定时检查书签在线/离线状态
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      updateConfig({
                        linkStatusEnabled: !config.linkStatusEnabled,
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      config.linkStatusEnabled
                        ? "bg-[#00C776] text-white"
                        : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                    }`}
                  >
                    {config.linkStatusEnabled ? "已开启" : "已关闭"}
                  </button>
                </div>

                <div>
                  <label
                    htmlFor="admin-link-status-interval"
                    className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1"
                  >
                    检测间隔
                  </label>
                  <select
                    id="admin-link-status-interval"
                    name="linkStatusInterval"
                    value={config.linkStatusInterval || 60}
                    onChange={(e) =>
                      updateConfig({
                        linkStatusInterval: Number(e.target.value),
                      })
                    }
                    className="w-full h-9 border border-gray-200 dark:border-slate-700 rounded-lg px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  >
                    <option value={30}>每 30 秒</option>
                    <option value={60}>每 60 秒（推荐）</option>
                    <option value={120}>每 2 分钟</option>
                    <option value={300}>每 5 分钟</option>
                  </select>
                </div>

                <div className="pt-1">
                  <button
                    onClick={handleClearNotifications}
                    className="px-4 py-2 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    清空操作记录
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setShowReset(true)}
                    className="px-4 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    重置为初始默认状态
                  </button>
                </div>
              </div>

              {/* 版本与更新 */}
              <div className="pt-5 border-t border-gray-100 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🔄</span>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      版本与更新
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-slate-400">
                      对比 Docker Hub 的 latest 镜像，应用内自检更新
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleCheckUpdate}
                    disabled={checkingUpdate}
                    className="h-9 px-4 rounded-lg bg-[#14B8A6] hover:bg-[#0D9488] text-white text-xs font-semibold transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {checkingUpdate ? "检查中…" : "检查更新"}
                  </button>
                  {updateResult?.local?.isDockerBuild && (
                    <span className="text-[11px] text-gray-400 dark:text-slate-400">
                      当前版本：
                      {updateResult.local.version
                        ? updateResult.local.version
                        : updateResult.local.sourceSha
                        ? updateResult.local.sourceSha.slice(0, 7)
                        : "unknown"}
                      {updateResult.local.buildDate
                        ? ` · ${new Date(updateResult.local.buildDate).toLocaleString("zh-CN")}`
                        : ""}
                    </span>
                  )}
                </div>

                {updateResult && (
                  <div className="mt-3">
                    {updateResult.error && (
                      <p className="text-xs text-red-500">{updateResult.error}</p>
                    )}
                    {!updateResult.error &&
                      updateResult.updateAvailable === false && (
                        <p className="text-xs text-emerald-600">
                          ✅ 已是最新版本
                          {updateResult.remote?.versionTag
                            ? `（最新 ${updateResult.remote.versionTag}）`
                            : updateResult.remote?.lastUpdated
                            ? `（${new Date(updateResult.remote.lastUpdated).toLocaleString("zh-CN")} 构建）`
                            : ""}
                        </p>
                      )}
                    {!updateResult.error &&
                      updateResult.updateAvailable === true && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-3">
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                            🚀 检测到新版本
                            {updateResult.remote?.versionTag
                              ? `（${updateResult.remote.versionTag}）`
                              : updateResult.remote?.lastUpdated
                              ? `（${new Date(updateResult.remote.lastUpdated).toLocaleString("zh-CN")}）`
                              : ""}
                          </p>
                          <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-500/80">
                            请拉取最新镜像并重启容器。
                          </p>
                        </div>
                      )}
                    {!updateResult.error &&
                      updateResult.updateAvailable === null &&
                      !updateResult.local.isDockerBuild && (
                        <p className="text-xs text-gray-400">
                          当前不是 Docker 构建（开发环境），无法对比版本。
                        </p>
                      )}
                    {!updateResult.error &&
                      updateResult.updateAvailable === null &&
                      updateResult.local.isDockerBuild && (
                        <p className="text-xs text-gray-400">
                          当前镜像为旧版本，缺少构建元数据，无法自动对比；请先升级到带自检能力的镜像后重试。
                        </p>
                      )}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

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

      {/* Avatar Picker Modal */}
      <Modal
        open={showAvatarModal}
        title="修改头像"
        onClose={() => setShowAvatarModal(false)}
      >
        <AvatarPicker
          value={avatarDraft}
          username={currentUser?.username}
          onChange={setAvatarDraft}
        />
        <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 dark:border-slate-700 pt-4">
          <button
            onClick={() => setShowAvatarModal(false)}
            className="h-9 rounded-lg px-4 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={() => {
              handleAvatarSave();
              setShowAvatarModal(false);
            }}
            className="h-9 rounded-lg bg-[#00C776] px-5 text-xs font-semibold text-white hover:bg-[#009a5a] cursor-pointer"
          >
            保存头像
          </button>
        </div>
      </Modal>

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

      {/* Add/Edit User Modal */}
      <Modal
        open={showAddUser}
        title={editingUser ? `修改账号信息 (@${editingUser.username})` : "添加新用户账号"}
        onClose={() => {
          setShowAddUser(false);
          setEditingUser(null);
        }}
      >
        <form onSubmit={handleUserFormSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="user-username"
              className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400"
            >
              账号 (Username) *
            </label>
            <input
              id="user-username"
              name="username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="例如 alex"
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
              autoFocus={!editingUser}
            />
          </div>
          <div>
            <label
              htmlFor="user-display-name"
              className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400"
            >
              昵称 / 显示名称
            </label>
            <input
              id="user-display-name"
              name="displayName"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="例如 亚历克斯"
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">
              头像
            </label>
            <AvatarPicker
              value={newAvatar}
              username={editingUser?.username || newUsername}
              onChange={setNewAvatar}
            />
          </div>
          <div>
            <label
              htmlFor="user-password"
              className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400"
            >
              密码 {editingUser ? "(不填代表保留原密码)" : "*"}
            </label>
            <input
              id="user-password"
              name="password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={editingUser ? "留空保持原密码" : "至少 6 位字符"}
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label
              htmlFor="user-role"
              className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400"
            >
              权限角色 *
            </label>
            <select
              id="user-role"
              name="role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as "admin" | "user")}
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs text-gray-900 dark:text-white bg-white dark:bg-slate-900"
            >
              <option value="user">普通用户 (User)</option>
              <option value="admin">管理员 (Admin)</option>
            </select>
          </div>
          {userFormError && (
            <p className="text-xs text-rose-500">{userFormError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowAddUser(false);
                setEditingUser(null);
              }}
              className="h-9 px-4 rounded-lg text-xs text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="h-9 px-5 rounded-lg bg-[#00C776] text-white text-xs font-semibold hover:bg-[#009a5a] cursor-pointer"
            >
              {editingUser ? "保存修改" : "创建用户"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!linkToDelete}
        title="删除链接"
        message={`确定要删除链接 "${linkToDelete?.title}" 吗？`}
        onConfirm={() => {
          if (linkToDelete) {
            deleteLink(linkToDelete.id);
            notify("链接管理", "链接已删除");
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

      <ConfirmDialog
        open={!!userToDelete}
        title="删除用户账号"
        message={`确定要彻底删除账号 "@${userToDelete?.username}" 吗？`}
        onConfirm={handleDeleteUserConfirm}
        onClose={() => setUserToDelete(null)}
      />


      <ConfirmDialog
        open={showReset}
        title="重置默认配置"
        message="确定要将所有分组、链接与系统个性化设置重置为初始状态吗？"
        confirmLabel="确定重置"
        onConfirm={() => {
          resetData();
          resetConfig();
          notify("系统设置", "全量配置已成功重置");
        }}
        onClose={() => setShowReset(false)}
      />

      {/* Admin Profile Center Modal */}
      <Modal
        open={showProfileModal}
        title="个人账号中心"
        onClose={() => setShowProfileModal(false)}
      >
        <div className="flex flex-col items-center p-3 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#3B82F6] via-[#00C776] to-[#8B5CF6] flex items-center justify-center text-white text-2xl font-bold shadow-md overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- 头像可能是任意图片地址或 data URL */}
            <img
              src={resolveAvatar(currentUser?.avatar, currentUser?.username)}
              alt={currentUser?.displayName || "User"}
              className="w-full h-full object-cover"
            />
          </div>

          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {currentUser?.displayName || currentUser?.username || "Admin"}
            </h3>
            <p className="text-xs text-gray-400">
              账号: <span className="font-mono text-gray-700 dark:text-slate-300">@{currentUser?.username || "admin"}</span>
            </p>
            <div className="mt-1.5 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-900">
              {currentUser?.role === "admin" ? "👑 超级系统管理员" : "👤 普通注册用户"}
            </div>
          </div>

          <div className="w-full text-left space-y-2.5 p-3 rounded-xl bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-700 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">当前账号</span>
              <span className="font-bold text-gray-800 dark:text-white">@{currentUser?.username || "admin"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">权限角色</span>
              <span className="font-bold text-teal-600 dark:text-teal-400">
                {currentUser?.role === "admin" ? "超级管理员 (Admin)" : "普通用户 (User)"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">登录状态</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">Active (已认证)</span>
            </div>
          </div>

          <div className="w-full pt-3 border-t border-gray-100 dark:border-slate-700 flex flex-col gap-2">
            <Link
              href="/"
              onClick={() => setShowProfileModal(false)}
              className="w-full h-9 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              🏠 返回前台主页
            </Link>

            <button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                router.push("/login");
                router.refresh();
              }}
              className="w-full h-9 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              🚪 退出登录
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
