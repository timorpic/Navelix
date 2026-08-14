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
import ScheduleAdminPanel from "@/components/schedule-admin-panel";
import ProjectAdminPanel from "@/components/project-admin-panel";
import AdminSidebar from "./components/admin-sidebar";


type AdminTab =
  | "links"
  | "categories"
  | "quickAccess"
  | "projects"
  | "schedules"
  | "users"
  | "analytics"
  | "system"
  | "personalization"
  | "profile";

interface AdminNavItem {
  id: AdminTab;
  icon: React.ReactNode;
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

  const { config, updateConfig, resetConfig } = useNavelixConfig();

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
    email?: string;
    bio?: string;
  } | null>(null);

  const [profileDisplayNameInput, setProfileDisplayNameInput] = useState("");
  const [profileEmailInput, setProfileEmailInput] = useState("");
  const [profileBioInput, setProfileBioInput] = useState("");
  const [profilePasswordNotice, setProfilePasswordNotice] = useState("");

  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [modalOldPassword, setModalOldPassword] = useState("");
  const [modalNewPassword, setModalNewPassword] = useState("");
  const [modalConfirmPassword, setModalConfirmPassword] = useState("");
  const [modalPasswordNotice, setModalPasswordNotice] = useState("");

  const [activeSessions, setActiveSessions] = useState<Array<{
    tokenHash: string;
    userAgent: string;
    ipAddress: string;
    lastActiveAt: number;
    createdAt: number;
    isCurrent: boolean;
  }>>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const [apiTokens, setApiTokens] = useState<Array<{
    id: string;
    name: string;
    tokenPrefix: string;
    createdAt: number;
    lastUsedAt: number | null;
  }>>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [newTokenNameInput, setNewTokenNameInput] = useState("");
  const [createdSecretToken, setCreatedSecretToken] = useState("");

  const fetchSessions = async () => {
    try {
      setLoadingSessions(true);
      const res = await fetch("/api/auth/sessions");
      if (res.ok) {
        const data = await res.json();
        setActiveSessions(data.sessions || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleRevokeSession = async (tokenHash: string) => {
    try {
      const res = await fetch("/api/auth/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenHash }),
      });
      if (res.ok) {
        notify("会话管理", "已安全下线选定的设备");
        fetchSessions();
      }
    } catch {
      // ignore
    }
  };

  const handleRevokeOtherSessions = async () => {
    try {
      const res = await fetch("/api/auth/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke_others" }),
      });
      if (res.ok) {
        notify("会话管理", "已注销其他所有设备的登录会话");
        fetchSessions();
      }
    } catch {
      // ignore
    }
  };

  const fetchApiTokens = async () => {
    try {
      setLoadingTokens(true);
      const res = await fetch("/api/auth/api-tokens");
      if (res.ok) {
        const data = await res.json();
        setApiTokens(data.tokens || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingTokens(false);
    }
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenNameInput.trim()) return;
    try {
      const res = await fetch("/api/auth/api-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTokenNameInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setCreatedSecretToken(data.token);
        setNewTokenNameInput("");
        notify("API 密钥", "密钥生成成功");
        fetchApiTokens();
      }
    } catch {
      // ignore
    }
  };

  const handleRevokeToken = async (id: string) => {
    try {
      const res = await fetch("/api/auth/api-tokens", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        notify("API 密钥", "密钥已解绑撤销");
        fetchApiTokens();
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if ((showProfileModal || activeTab === "profile") && currentUser) {
      queueMicrotask(() => {
        setProfileDisplayNameInput(currentUser.displayName || currentUser.username || "");
        setProfileEmailInput(currentUser.email || "");
        setProfileBioInput(currentUser.bio || "");
        setProfilePasswordNotice("");
        fetchSessions();
        fetchApiTokens();
      });
    }
  }, [showProfileModal, activeTab, currentUser]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfilePasswordNotice("");
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: profileDisplayNameInput,
          email: profileEmailInput,
          bio: profileBioInput,
        }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setCurrentUser(data.user);
        setProfilePasswordNotice(`🎉 ${data.message || "个人资料更新成功"}`);
        notify("个人账号", "个人资料与签名已保存");
      } else {
        setProfilePasswordNotice(`❌ ${data.error || "修改失败"}`);
      }
    } catch {
      setProfilePasswordNotice("❌ 更新个人资料失败");
    }
  };

  const handleModalPasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalPasswordNotice("");
    if (!modalOldPassword) {
      setModalPasswordNotice("❌ 请输入当前原密码");
      return;
    }
    if (!modalNewPassword || modalNewPassword.length < 6) {
      setModalPasswordNotice("❌ 新密码长度至少需 6 位");
      return;
    }
    if (modalNewPassword !== modalConfirmPassword) {
      setModalPasswordNotice("❌ 两次输入的二次确认新密码不一致，请重新检查");
      return;
    }
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldPassword: modalOldPassword,
          newPassword: modalNewPassword,
        }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setCurrentUser(data.user);
        setModalPasswordNotice("🎉 密码修改成功！");
        notify("个人账号", "登录密码已成功重置");
        setTimeout(() => {
          setShowChangePasswordModal(false);
          setModalOldPassword("");
          setModalNewPassword("");
          setModalConfirmPassword("");
          setModalPasswordNotice("");
        }, 1000);
      } else {
        setModalPasswordNotice(`❌ ${data.error || "密码修改失败"}`);
      }
    } catch {
      setModalPasswordNotice("❌ 网络或服务器错误，修改失败");
    }
  };
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
    {
      id: "links",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 14a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 10a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      ),
      label: "链接管理",
      badge: links.length,
    },
    {
      id: "categories",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      ),
      label: "分组管理",
      badge: categories.length,
    },
    {
      id: "quickAccess",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
      label: "快捷访问",
      badge: links.filter((l) => l.isQuickAccess).length,
    },
    {
      id: "projects",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h6v8h-6z" />
          <path d="M14 4h6v4h-6z" />
          <path d="M14 12h6v8h-6z" />
          <path d="M4 16h6v4h-6z" />
        </svg>
      ),
      label: "项目管理",
    },
    {
      id: "schedules",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
      label: "日程管理",
    },
    ...(currentUser?.role === "admin"
      ? [
          {
            id: "users" as AdminTab,
            icon: (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            ),
            label: "账号管理",
            badge: users.length || 1,
          },
        ]
      : []),
    {
      id: "analytics",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="M18 9l-5 5l-2-2l-4 4" />
        </svg>
      ),
      label: "访问统计",
    },
    {
      id: "system",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
      label: "全局与数据",
    },
    {
      id: "personalization",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
          <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
          <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
          <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.92 0 1.7-.75 1.7-1.67 0-.42-.16-.81-.43-1.11-.27-.3-.43-.69-.43-1.11 0-.92.75-1.67 1.67-1.67H17c2.76 0 5-2.24 5-5 0-5.52-4.48-9.5-10-9.5z" />
        </svg>
      ),
      label: "个性化外观",
    },
    {
      id: "profile",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      label: "个人中心",
    },
  ];

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

  const handleExport = async () => {
    try {
      // 1. Fetch latest DB data for user (categories, links, projects, todos, config)
      const res = await fetch("/api/user/data");
      const dbData = res.ok ? await res.json() : {};

      const safeConfig = { ...(dbData.config || config) };
      delete safeConfig.aiApiKey;
      delete safeConfig.weatherApiKey;

      // 2. Collect local storage state (Focus Tracker stats, Quick Notes, Link Usage)
      let focusTracker = null;
      let quickNotes = null;
      let linkUsage = null;

      try {
        focusTracker = JSON.parse(localStorage.getItem("navelix.focus.tracker.v1") || "null");
      } catch { /* ignore */ }
      try {
        quickNotes = JSON.parse(localStorage.getItem("navelix.quick.notes") || "null");
      } catch { /* ignore */ }
      try {
        linkUsage = JSON.parse(localStorage.getItem("navelix.link.usage") || "null");
      } catch { /* ignore */ }

      const exportPayload = {
        version: "2.0",
        exportTime: new Date().toISOString(),
        categories: dbData.categories || categories,
        links: dbData.links || links,
        projects: dbData.projects || [],
        todos: dbData.todos || [],
        config: safeConfig,
        localStorageData: {
          focusTracker,
          quickNotes,
          linkUsage,
        },
      };

      const dataStr = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = Math.floor(new Date().getTime());
      a.download = `navelix-full-backup-${timestamp}.json`;
      a.click();
      URL.revokeObjectURL(url);

      const projectCount = (dbData.projects || []).length;
      const todoCount = (dbData.todos || []).length;
      notify(
        "数据管理",
        `全量数据导出成功：包含 ${(dbData.links || links).length} 链接、${(dbData.categories || categories).length} 分组、${projectCount} 项目、${todoCount} 日程`,
      );
    } catch {
      flash("导出全量配置失败");
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
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
        const projs = Array.isArray(parsed.projects) ? parsed.projects : [];
        const tds = Array.isArray(parsed.todos) ? parsed.todos : [];

        // Save categories, links, projects, todos, and config to DB
        const safeCfg = parsed.config ? { ...parsed.config } : undefined;
        if (safeCfg) {
          delete safeCfg.aiApiKey;
          delete safeCfg.weatherApiKey;
        }

        const saveRes = await fetch("/api/user/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categories: cats,
            links: lnks,
            projects: projs,
            todos: tds,
            config: safeCfg,
          }),
        });

        if (!saveRes.ok) {
          throw new Error("保存数据到服务器失败");
        }

        // Restore LocalStorage items if present
        if (parsed.localStorageData) {
          const ls = parsed.localStorageData;
          if (ls.focusTracker) {
            localStorage.setItem("navelix.focus.tracker.v1", JSON.stringify(ls.focusTracker));
          }
          if (ls.quickNotes) {
            localStorage.setItem("navelix.quick.notes", JSON.stringify(ls.quickNotes));
          }
          if (ls.linkUsage) {
            localStorage.setItem("navelix.link.usage", JSON.stringify(ls.linkUsage));
          }
        }

        if (safeCfg) {
          updateConfig(safeCfg);
        }
        importData(cats, lnks);

        notify(
          "数据管理",
          `全网全量配置导入成功：恢复 ${lnks.length} 链接、${cats.length} 分组、${projs.length} 项目、${tds.length} 日程`,
        );

        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } catch {
        flash("导入失败：无效或损坏的 JSON 配置文件");
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
      {/* 1. Left Admin Sidebar */}
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        adminNavItems={adminNavItems}
        currentUser={currentUser}
      />

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
              <div className="absolute top-12 right-0 w-44 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-1.5 z-50 animate-fadeIn flex flex-col gap-1 text-xs font-semibold text-gray-700 dark:text-slate-200">
                <button
                  onClick={() => {
                    setShowAdminUserMenu(false);
                    setActiveTab("profile");
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 text-left transition-colors cursor-pointer"
                >
                  <span>👤</span>
                  <span>个人中心</span>
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


          {/* TAB 3.6: 📁 项目管理 */}
          {activeTab === "projects" && <ProjectAdminPanel />}

          {/* TAB 3.7: 📅 日程管理 */}
          {activeTab === "schedules" && <ScheduleAdminPanel />}

          {/* TAB 4: 👤 账号管理 */}
          {activeTab === "users" && currentUser?.role === "admin" && <AdminUsersPanel />}

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

          {/* TAB 7: ⚙️ 全局与数据管理 */}
          {activeTab === "system" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* 左栏：系统全局参数设置 3 大独立区块 (6 cols) */}
              <div className="lg:col-span-6 space-y-6">
                {/* 块 1：站点标题、LOGO 显示文本内容与图标 */}
              <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span>🏷️</span>
                    <span>站点与品牌 LOGO</span>
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                    设置浏览器标签页标题及侧边栏与头部展示的品牌 LOGO 文本/图标
                  </p>
                </div>
                <div className="space-y-3.5">
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
                      htmlFor="admin-logo"
                      className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1"
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
                      className="w-full h-9 border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-medium"
                    />
                    <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
                      自定义侧边栏与头部等位置显示的品牌名称文本
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="admin-logo-upload"
                      className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1"
                    >
                      LOGO 图标（可选）
                    </label>
                    <div className="flex items-center gap-3">
                      <LogoMark size="md" />
                      <input
                        id="admin-logo-upload"
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
                    <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
                      支持 PNG / JPG / SVG，上传后替代默认字母 Logo，留空使用默认样式
                    </p>
                  </div>
                </div>
              </div>

              {/* 卡片 2：🔍 默认搜索引擎与搜索栏 */}
              <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span>🔍</span>
                    <span>默认搜索引擎与搜索栏</span>
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                    配置前台主页默认搜索引擎以及搜索栏组件的显示/隐藏状态
                  </p>
                </div>
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
                    <div>
                      <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
                        搜索栏组件显示状态
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
                        {config.showSearchBar ? "当前状态：已显示搜索栏" : "当前状态：已隐藏搜索栏"}
                      </p>
                    </div>
                    <button
                      id="admin-searchbar-toggle"
                      type="button"
                      onClick={() => updateConfig({ showSearchBar: !config.showSearchBar })}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        config.showSearchBar ? "bg-[#00C776] text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                      }`}
                    >
                      {config.showSearchBar ? "隐藏" : "显示"}
                    </button>
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
                      className="w-full h-9 border border-gray-200 dark:border-slate-700 rounded-lg px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-medium"
                    >
                      <option value="google">Google</option>
                      <option value="baidu">Baidu 百度</option>
                      <option value="bing">Bing 必应</option>
                      <option value="perplexity">Perplexity AI</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 卡片 3：🔗 链接状态检测与控制 */}
              <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span>🔗</span>
                    <span>链接状态检测</span>
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                    开启后系统在后台定时巡检所有网址书签的可访问性与在线状态
                  </p>
                </div>

                <div className="space-y-3.5">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
                    <div>
                      <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
                        定时检测开关
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
                        自动巡检书签响应状态
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        updateConfig({
                          linkStatusEnabled: !config.linkStatusEnabled,
                        })
                      }
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
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
                      检测时间间隔
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

                  <div className="pt-2 border-t border-gray-100 dark:border-slate-700/60 flex items-center gap-2">
                    <button
                      onClick={handleClearNotifications}
                      className="px-3 py-1.5 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      清空操作记录
                    </button>
                    <button
                      onClick={() => setShowReset(true)}
                      className="px-3 py-1.5 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      重置默认状态
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 右栏：📦 配置与数据导入导出 & 🔄 版本更新 (6 cols) */}
            <div className="lg:col-span-6 space-y-6">
                {/* 📦 配置与数据导入导出 */}
                <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span>📦</span>
                    <span>配置与数据导入导出</span>
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                    支持一键导出 Navelix 全量配置，或从 Sun-Panel / Chrome HTML 书签导入数据
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Card 1: Sun-Panel JSON 兼容导入 */}
                  <div className="bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl p-4 border border-teal-100 dark:border-teal-900/60 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">☀️</span>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                        导入 Sun-Panel 配置文件
                      </h4>
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-slate-400 leading-relaxed">
                      无缝兼容 Sun-Panel 导出的 JSON 配置文件，自动解析分类与网址并合并。
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
                      className="w-full py-1.5 bg-[#00C776] hover:bg-[#009a5a] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>☀️</span>
                      <span>选择 JSON 文件</span>
                    </button>
                  </div>

                  {/* Card 2: Chrome / 浏览器 HTML 书签导入 */}
                  <div className="bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🌐</span>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                        导入 Chrome / HTML 书签
                      </h4>
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-slate-400 leading-relaxed">
                      解析 Chrome、Edge 或 Safari 导出的 HTML 书签文件并智能归类。
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
                      className="w-full py-1.5 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-600 dark:text-sky-400 text-xs font-semibold rounded-xl border border-sky-200 dark:border-sky-900 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>🌐</span>
                      <span>选择 HTML 文件</span>
                    </button>
                  </div>

                  {/* Card 3: 导出全量 Navelix JSON */}
                  <div className="bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 space-y-2.5">
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white">导出全量配置 JSON</h4>
                    <p className="text-[11px] text-gray-400 dark:text-slate-400 leading-relaxed">
                      导出包含全量书签、分组与个性化外观在内的 Navelix JSON 文件。
                    </p>
                    <button
                      onClick={handleExport}
                      className="w-full py-1.5 bg-gray-900 dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      导出 Navelix JSON
                    </button>
                  </div>

                  {/* Card 4: 导入全量 Navelix JSON */}
                  <div className="bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 space-y-2.5">
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white">导入全量 Navelix JSON</h4>
                    <p className="text-[11px] text-gray-400 dark:text-slate-400 leading-relaxed">
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
                      className="w-full py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      选择 Navelix JSON
                    </button>
                  </div>
                </div>
              </div>

              {/* 🔄 版本与更新 */}
              <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs transition-colors">
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
          </div>
        )}

          {/* TAB 8: 🎨 个性化与外观配置 */}
          {activeTab === "personalization" && (
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100/90 dark:border-slate-700 shadow-2xs space-y-6 transition-colors">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">个性化参数设置</h2>
                <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                  AI智能助手、天气预报组件与社交媒体联系方式配置
                </p>
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
                  </div>
                </div>
              </div>

              {/* Weather API Config Section */}
              <div className="pt-5 border-t border-gray-100 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">🌤️</span>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      天气组件 API 配置 (心知天气)
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-slate-400">
                      配置心知天气 API Key 与城市位置（如 beijing 或 shanghai），启用后侧边栏将同步展示天气与气温。
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
                    <label
                      htmlFor="admin-weather-toggle"
                      className="block text-xs font-bold text-gray-800 dark:text-slate-200"
                    >
                      天气组件开关
                    </label>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-gray-600 dark:text-slate-300">
                        {config.weatherEnabled ? "当前状态：已启用" : "当前状态：已禁用"}
                      </span>
                      <button
                        id="admin-weather-toggle"
                        type="button"
                        onClick={() => updateConfig({ weatherEnabled: !config.weatherEnabled })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          config.weatherEnabled
                            ? "bg-[#00C776] text-white"
                            : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                        }`}
                      >
                        {config.weatherEnabled ? "已启用" : "已禁用"}
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
                    <label
                      htmlFor="admin-weather-api-key"
                      className="block text-xs font-bold text-gray-800 dark:text-slate-200"
                    >
                      心知天气 API Key
                    </label>
                    <input
                      id="admin-weather-api-key"
                      name="weatherApiKey"
                      type="password"
                      value={config.weatherApiKey ?? ""}
                      onChange={(e) => updateConfig({ weatherApiKey: e.target.value })}
                      placeholder={config.weatherKeyConfigured ? "已配置 - 留空则保持不变" : "心知天气 Key"}
                      className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                    />
                  </div>

                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
                    <label
                      htmlFor="admin-weather-location"
                      className="block text-xs font-bold text-gray-800 dark:text-slate-200"
                    >
                      城市 / 位置 (Location)
                    </label>
                    <input
                      id="admin-weather-location"
                      name="weatherLocation"
                      type="text"
                      value={config.weatherLocation || ""}
                      onChange={(e) => updateConfig({ weatherLocation: e.target.value })}
                      placeholder="例如 beijing 或 shanghai"
                      className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                    />
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
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: 👤 个人中心与账号安全控制 */}
          {activeTab === "profile" && (
            <div className="max-w-5xl space-y-6">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>👤</span>
                  <span>个人账号与安全中心</span>
                </h2>
                <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                  管理您的个人基本资料、座右铭签名、社交网络主页、活跃设备会话与 API Access Token
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* 左栏：基础资料 & 社交链接 */}
                <div className="space-y-6">
                  {/* 卡片 1：👤 基础资料 & 名片 */}
                  <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-5 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700/80">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className="relative group cursor-pointer shrink-0"
                          onClick={() => {
                            setAvatarDraft(currentUser?.avatar || "");
                            setShowAvatarModal(true);
                          }}
                          title="点击修改头像"
                        >
                          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#3B82F6] via-[#00C776] to-[#8B5CF6] flex items-center justify-center text-white text-xl font-bold shadow-md overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={resolveAvatar(currentUser?.avatar, currentUser?.username)}
                              alt={currentUser?.displayName || "User"}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition-opacity">
                            修改
                          </div>
                        </div>

                        <div className="space-y-1 min-w-0">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                            {currentUser?.displayName || currentUser?.username || "Admin"}
                          </h3>
                          <p className="text-xs text-gray-400 font-mono">
                            账号: @{currentUser?.username || "admin"}
                          </p>
                          <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-900">
                            {currentUser?.role === "admin" ? "👑 超级系统管理员" : "👤 普通注册用户"}
                          </div>
                        </div>
                      </div>

                      {/* 快捷按钮 */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setAvatarDraft(currentUser?.avatar || "");
                            setShowAvatarModal(true);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                        >
                          <span>🖼️</span>
                          <span>头像</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setModalOldPassword("");
                            setModalNewPassword("");
                            setModalConfirmPassword("");
                            setModalPasswordNotice("");
                            setShowChangePasswordModal(true);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                        >
                          <span>🔐</span>
                          <span>密码</span>
                        </button>
                      </div>
                    </div>

                    {/* 修改基本资料表单 */}
                    <form onSubmit={handleProfileSave} className="space-y-4">
                      <div className="space-y-1">
                        <label htmlFor="admin-profile-display-name" className="block text-xs font-bold text-gray-700 dark:text-slate-200">
                          显示名称 (昵称)
                        </label>
                        <input
                          id="admin-profile-display-name"
                          name="displayName"
                          type="text"
                          value={profileDisplayNameInput}
                          onChange={(e) => setProfileDisplayNameInput(e.target.value)}
                          placeholder="例如 亚历克斯"
                          className="w-full h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="admin-profile-email" className="block text-xs font-bold text-gray-700 dark:text-slate-200">
                          个人邮箱地址
                        </label>
                        <input
                          id="admin-profile-email"
                          name="email"
                          type="email"
                          value={profileEmailInput}
                          onChange={(e) => setProfileEmailInput(e.target.value)}
                          placeholder="admin@navelix.io"
                          className="w-full h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="admin-profile-bio" className="block text-xs font-bold text-gray-700 dark:text-slate-200">
                          个人座右铭 / 签名
                        </label>
                        <input
                          id="admin-profile-bio"
                          name="bio"
                          type="text"
                          value={profileBioInput}
                          onChange={(e) => setProfileBioInput(e.target.value)}
                          placeholder="例如：极客致远 · 构建与探索"
                          className="w-full h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                        />
                        <p className="text-[10px] text-gray-400 dark:text-slate-400">
                          个性签名将同步展示在侧边栏底部名片卡片上
                        </p>
                      </div>

                      {profilePasswordNotice && (
                        <p className="text-xs font-semibold pt-1" style={{ color: profilePasswordNotice.startsWith("🎉") ? "#00C776" : "#F43F5E" }}>
                          {profilePasswordNotice}
                        </p>
                      )}

                      <div className="pt-2 flex items-center justify-end">
                        <button
                          type="submit"
                          className="h-9 px-5 bg-[#00C776] hover:bg-[#009a5a] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
                        >
                          💾 保存个人资料
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* 卡片 2：🌐 个人社交媒体与外部主页 */}
                  <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <span>🌐</span>
                        <span>个人社交与外部主页链接</span>
                      </h3>
                      <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                        配置您的 GitHub / X / LinkedIn 主页链接，实时呈现在前台底部
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="admin-social-github-profile" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                          GitHub 主页
                        </label>
                        <input
                          id="admin-social-github-profile"
                          type="text"
                          value={config.socialGithub || ""}
                          onChange={(e) => updateConfig({ socialGithub: e.target.value })}
                          placeholder="https://github.com/username"
                          className="w-full h-8.5 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                        />
                      </div>

                      <div>
                        <label htmlFor="admin-social-x-profile" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                          X (Twitter)
                        </label>
                        <input
                          id="admin-social-x-profile"
                          type="text"
                          value={config.socialX || ""}
                          onChange={(e) => updateConfig({ socialX: e.target.value })}
                          placeholder="https://x.com/username"
                          className="w-full h-8.5 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                        />
                      </div>

                      <div>
                        <label htmlFor="admin-social-linkedin-profile" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                          LinkedIn 领英
                        </label>
                        <input
                          id="admin-social-linkedin-profile"
                          type="text"
                          value={config.socialLinkedin || ""}
                          onChange={(e) => updateConfig({ socialLinkedin: e.target.value })}
                          placeholder="https://linkedin.com/in/username"
                          className="w-full h-8.5 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                        />
                      </div>

                      <div>
                        <label htmlFor="admin-social-email-profile" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                          公开联系邮箱
                        </label>
                        <input
                          id="admin-social-email-profile"
                          type="text"
                          value={config.socialEmail || ""}
                          onChange={(e) => updateConfig({ socialEmail: e.target.value })}
                          placeholder="mailto:hello@domain.com"
                          className="w-full h-8.5 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 右栏：登录安全与活跃会话 & API Token 管理 */}
                <div className="space-y-6">
                  {/* 卡片 3：🛡️ 登录安全与在线设备管理 */}
                  <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <span>🛡️</span>
                          <span>登录安全与在线设备</span>
                        </h3>
                        <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                          实时监控所有登录本账号的设备会话与 IP
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleRevokeOtherSessions}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900 transition-colors cursor-pointer shrink-0"
                      >
                        踢出其他设备
                      </button>
                    </div>

                    <div className="space-y-2.5 max-h-64 overflow-y-auto">
                      {loadingSessions ? (
                        <p className="text-xs text-gray-400 py-4 text-center">加载设备会话中…</p>
                      ) : activeSessions.length === 0 ? (
                        <p className="text-xs text-gray-400 py-4 text-center">暂无活动会话</p>
                      ) : (
                        activeSessions.map((s) => (
                          <div
                            key={s.tokenHash}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                              s.isCurrent
                                ? "bg-teal-50/50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900/80"
                                : "bg-gray-50/50 dark:bg-slate-900/40 border-gray-100 dark:border-slate-700/60"
                            }`}
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-800 dark:text-slate-200 truncate">
                                  {s.userAgent.includes("Chrome")
                                    ? "🌐 Chrome 浏览器"
                                    : s.userAgent.includes("Safari")
                                    ? "🧭 Safari 浏览器"
                                    : s.userAgent.includes("Firefox")
                                    ? "🦊 Firefox 浏览器"
                                    : "💻 桌面端终端设备"}
                                </span>
                                {s.isCurrent && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#00C776] text-white">
                                    当前设备
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-400 dark:text-slate-400 font-mono truncate">
                                IP: {s.ipAddress} · 活跃于 {new Date(s.lastActiveAt).toLocaleString("zh-CN")}
                              </p>
                            </div>

                            {!s.isCurrent && (
                              <button
                                type="button"
                                onClick={() => handleRevokeSession(s.tokenHash)}
                                className="text-[11px] text-red-500 hover:text-red-700 font-semibold cursor-pointer shrink-0"
                              >
                                强退
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 卡片 4：🔑 个人 API Token 密钥管理 */}
                  <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <span>🔑</span>
                        <span>个人 API Access Token</span>
                      </h3>
                      <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                        用于第三方快捷指令、自动化脚本或 Webhook 鉴权调用
                      </p>
                    </div>

                    {/* 生成新 Token 表单 */}
                    <form onSubmit={handleCreateToken} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newTokenNameInput}
                        onChange={(e) => setNewTokenNameInput(e.target.value)}
                        placeholder="密钥标识 (例如：iOS 快捷指令密钥)"
                        className="flex-1 h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                      />
                      <button
                        type="submit"
                        className="h-9 px-4 bg-[#00C776] hover:bg-[#009a5a] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
                      >
                        生成新密钥
                      </button>
                    </form>

                    {/* 新创密钥提示框 */}
                    {createdSecretToken && (
                      <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs space-y-1.5">
                        <p className="font-bold text-emerald-800 dark:text-emerald-300">
                          🎉 新 API 密钥已生成（仅可复制一次）：
                        </p>
                        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 font-mono text-[11px] text-emerald-700 dark:text-emerald-400 break-all select-all">
                          <span>{createdSecretToken}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(createdSecretToken);
                              notify("API 密钥", "密钥已复制到剪贴板");
                            }}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shrink-0 cursor-pointer"
                          >
                            复制
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Token 列表 */}
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {loadingTokens ? (
                        <p className="text-xs text-gray-400 py-4 text-center">加载 API 密钥中…</p>
                      ) : apiTokens.length === 0 ? (
                        <p className="text-xs text-gray-400 py-4 text-center">暂未创建 API Token 密钥</p>
                      ) : (
                        apiTokens.map((t) => (
                          <div
                            key={t.id}
                            className="p-3 rounded-xl bg-gray-50/50 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <p className="font-bold text-gray-800 dark:text-slate-200 truncate">
                                {t.name}
                              </p>
                              <p className="text-[10px] text-gray-400 dark:text-slate-400 font-mono truncate">
                                {t.tokenPrefix} · 创建于 {new Date(t.createdAt).toLocaleDateString("zh-CN")}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRevokeToken(t.id)}
                              className="text-[11px] text-rose-500 hover:text-rose-700 font-semibold cursor-pointer shrink-0"
                            >
                              撤销
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
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

      {/* Dedicated Change Password Modal */}
      <Modal
        open={showChangePasswordModal}
        title="🔐 修改登录密码"
        onClose={() => setShowChangePasswordModal(false)}
      >
        <form onSubmit={handleModalPasswordSave} className="space-y-4">
          <div>
            <label htmlFor="modal-old-pwd" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
              当前原密码 *
            </label>
            <input
              id="modal-old-pwd"
              name="oldPassword"
              type="password"
              autoComplete="current-password"
              value={modalOldPassword}
              onChange={(e) => setModalOldPassword(e.target.value)}
              placeholder="请输入当前使用的登录密码"
              required
              className="w-full h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#00C776]/40 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="modal-new-pwd" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
              设置新密码 (至少 6 位) *
            </label>
            <input
              id="modal-new-pwd"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              value={modalNewPassword}
              onChange={(e) => setModalNewPassword(e.target.value)}
              placeholder="请输入新密码 (至少 6 位)"
              required
              className="w-full h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#00C776]/40 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="modal-confirm-pwd" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
              确认新密码 *
            </label>
            <input
              id="modal-confirm-pwd"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={modalConfirmPassword}
              onChange={(e) => setModalConfirmPassword(e.target.value)}
              placeholder="请再次输入新密码"
              required
              className="w-full h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#00C776]/40 focus:outline-none"
            />
          </div>

          {modalPasswordNotice && (
            <p className="text-xs font-semibold pt-1" style={{ color: modalPasswordNotice.startsWith("🎉") ? "#00C776" : "#F43F5E" }}>
              {modalPasswordNotice}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 dark:border-slate-700 pt-4">
            <button
              type="button"
              onClick={() => setShowChangePasswordModal(false)}
              className="h-9 rounded-lg px-4 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="h-9 rounded-lg bg-[#00C776] hover:bg-[#009a5a] px-5 text-xs font-bold text-white transition-colors cursor-pointer shadow-xs"
            >
              确认修改密码
            </button>
          </div>
        </form>
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
              type="text"
              autoComplete="username"
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
              type="text"
              autoComplete="name"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="例如 亚历克斯"
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">
              头像
            </span>
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
              autoComplete="new-password"
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

          {/* Self Profile Form & Action Buttons */}
          <div className="w-full text-left space-y-3 p-3.5 rounded-xl bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-700 text-xs">
            <form onSubmit={handleProfileSave} className="space-y-2.5">
              <label htmlFor="self-display-name" className="block text-[11px] font-bold text-gray-700 dark:text-slate-200 mb-1">
                修改显示名称 (昵称)
              </label>
              <div className="flex gap-2">
                <input
                  id="self-display-name"
                  name="displayName"
                  type="text"
                  autoComplete="name"
                  value={profileDisplayNameInput}
                  onChange={(e) => setProfileDisplayNameInput(e.target.value)}
                  placeholder="设置你的显示昵称..."
                  className="flex-1 h-9 rounded-lg border border-gray-200 dark:border-slate-600 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#00C776]/40 focus:outline-none"
                />
                <button
                  type="submit"
                  className="h-9 px-3 bg-[#00C776] hover:bg-[#009a5a] text-white font-bold rounded-lg text-xs transition-colors cursor-pointer shrink-0"
                >
                  保存
                </button>
              </div>
            </form>

            {profilePasswordNotice && (
              <p className="text-[11px] font-semibold transition-all" style={{ color: profilePasswordNotice.startsWith("🎉") ? "#00C776" : "#F43F5E" }}>
                {profilePasswordNotice}
              </p>
            )}

            <div className="pt-2 border-t border-gray-200/70 dark:border-slate-600/60 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowProfileModal(false);
                  setAvatarDraft(currentUser?.avatar || "");
                  setShowAvatarModal(true);
                }}
                className="flex-1 h-8 rounded-lg bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-600 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <span>🖼️</span>
                <span>修改头像</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowProfileModal(false);
                  setModalOldPassword("");
                  setModalNewPassword("");
                  setModalPasswordNotice("");
                  setShowChangePasswordModal(true);
                }}
                className="flex-1 h-8 rounded-lg bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-600 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <span>🔐</span>
                <span>修改密码</span>
              </button>
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
