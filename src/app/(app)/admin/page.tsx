"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/confirm-dialog";
import { useNavelixData } from "@/hooks/use-navelix-data";
import { useNavelixConfig } from "@/hooks/use-navelix-config";
import {
  formatRelativeTime,
  pushNotification,
  type NotificationItem,
} from "@/lib/notifications";
import { resolveAvatar } from "@/lib/avatars";
import AdminUsersPanel from "./admin-users";
import ScheduleAdminPanel from "@/components/schedule-admin-panel";
import ProjectAdminPanel from "@/components/project-admin-panel";
import ModelMonitorPanel from "@/components/model-monitor-panel";
import AdminSidebar from "./components/admin-sidebar";
import AdminLinksTab from "./components/admin-links-tab";
import AdminSystemTab from "./components/admin-system-tab";
import AdminPersonalizationTab from "./components/admin-personalization-tab";
import AdminProfileTab from "./components/admin-profile-tab";

type AdminTab =
  | "links" | "categories" | "quickAccess" | "projects" | "schedules"
  | "users" | "analytics" | "models" | "system" | "personalization" | "profile";

interface AdminNavItem {
  id: AdminTab;
  icon: React.ReactNode;
  label: string;
  badge?: number | string;
}

export default function AdminPage() {
  const router = useRouter();
  const { categories, links, hydrated, resetData } = useNavelixData();
  const { config, updateConfig, resetConfig } = useNavelixConfig();

  const [activeTab, setActiveTab] = useState<AdminTab>("links");
  const [users, setUsers] = useState<Array<{ id: string; username: string; displayName: string; role: "admin" | "user"; avatar: string; createdAt: number }>>([]);

  // 支持 URL 深链：/admin?tab=system 等（如首次登录安全设置引导）
  useEffect(() => {
    try {
      const param = new URL(window.location.href).searchParams.get("tab");
      if (param && (["links", "categories", "quickAccess", "projects", "schedules", "users", "analytics", "models", "system", "personalization", "profile"] as AdminTab[]).includes(param as AdminTab)) {
        queueMicrotask(() => setActiveTab(param as AdminTab));
      }
    } catch { /* ignore */ }
  }, []);
  const [currentUser, setCurrentUser] = useState<{
    username: string; displayName: string; role: "admin" | "user";
    avatar?: string; email?: string; bio?: string;
  } | null>(null);

  const [showAdminNotifications, setShowAdminNotifications] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState<NotificationItem[]>([]);
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);
  const [showAdminUserMenu, setShowAdminUserMenu] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [notice, setNotice] = useState("");
  const adminNotifRef = useRef<HTMLDivElement>(null);

  const adminUnread = adminUnreadCount > 0;

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 2800);
  };
  const notify = (title: string, msg: string) => {
    flash(msg);
    pushNotification(title, msg);
  };

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
        if (Number.isInteger(data.unreadCount)) {
          setAdminUnreadCount(data.unreadCount);
        }
      } catch {}
      fetch("/api/notifications/read", { method: "POST" }).catch(() => {});
      setAdminNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setAdminUnreadCount(0);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (adminNotifRef.current && !adminNotifRef.current.contains(event.target as Node)) {
        setShowAdminNotifications(false);
      }
    }
    if (showAdminNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAdminNotifications]);

  // Initial fetch: current user, users list, notifications
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        const user = data.user ?? null;
        setCurrentUser(user);
        if (user?.role === "admin") {
          fetch("/api/admin/users")
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (d && Array.isArray(d.users)) setUsers(d.users); })
            .catch(() => {});
        }
      })
      .catch(() => setCurrentUser(null));
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.notifications)) setAdminNotifications(data.notifications);
        if (data && Number.isInteger(data.unreadCount)) setAdminUnreadCount(data.unreadCount);
      })
      .catch(() => {});
  }, []);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FA] dark:bg-[#151218] text-sm text-gray-400">
        加载中…
      </div>
    );
  }

  const adminNavItems: AdminNavItem[] = [
    { id: "links", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 10a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>, label: "链接管理", badge: links.length },
    { id: "categories", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg>, label: "分组管理", badge: categories.length },
    { id: "quickAccess", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>, label: "快捷访问", badge: links.filter((l) => l.isQuickAccess).length },
    { id: "projects", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h6v8h-6z" /><path d="M14 4h6v4h-6z" /><path d="M14 12h6v8h-6z" /><path d="M4 16h6v4h-6z" /></svg>, label: "项目管理" },
    { id: "schedules", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>, label: "日程管理" },
    ...(currentUser?.role === "admin"
      ? [{ id: "users" as AdminTab, icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>, label: "账号管理", badge: users.length || 1 }]
      : []),
    { id: "analytics", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M18 9l-5 5l-2-2l-4 4" /></svg>, label: "访问统计" },
    { id: "models", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8" y2="16" /><line x1="16" y1="16" x2="16" y2="16" /></svg>, label: "模型监控" },
    { id: "system", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>, label: "系统与数据管理" },
    { id: "personalization", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.92 0 1.7-.75 1.7-1.67 0-.42-.16-.81-.43-1.11-.27-.3-.43-.69-.43-1.11 0-.92.75-1.67 1.67-1.67H17c2.76 0 5-2.24 5-5 0-5.52-4.48-9.5-10-9.5z" /></svg>, label: "界面与功能偏好" },
    { id: "profile", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>, label: "个人账号与安全" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F8FA] dark:bg-[#151218] text-gray-900 dark:text-slate-100 font-sans antialiased transition-colors duration-200 lg:flex-row">
      <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} adminNavItems={adminNavItems} currentUser={currentUser} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-20 backdrop-blur-md transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <button className="text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
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
                <svg className="w-4 h-4 text-[#00C776]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></svg>
              ) : config.theme === "dark" ? (
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>

            <button
              onClick={handleOpenAdminNotifications}
              className={`relative p-2 rounded-xl transition-colors cursor-pointer ${
                showAdminNotifications ? "bg-[#00C776]/10 text-[#00C776]" : "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
              }`} title="消息通知"
            >
              🔔
              {adminUnread && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />}
              {adminUnread && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-rose-500" />}
            </button>

            {showAdminNotifications && (
              <div ref={adminNotifRef} className="absolute top-12 right-24 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-3.5 z-50 animate-fadeIn text-left">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-slate-700">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">后台消息通知</span>
                    {adminUnread && <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600 text-[10px] font-bold">{adminUnreadCount > 99 ? "99+" : adminUnreadCount}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {adminUnread && (
                      <button onClick={() => { fetch("/api/notifications/read", { method: "POST" }).catch(() => {}); setAdminNotifications((prev) => prev.map((n) => ({ ...n, read: true }))); setShowAdminNotifications(false); }} className="text-[10px] text-[#00C776] hover:underline cursor-pointer">全部已读</button>
                    )}
                    <button onClick={() => setShowAdminNotifications(false)} className="w-5 h-5 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-xs" title="关闭消息">✕</button>
                  </div>
                </div>
                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                  {adminNotifications.length === 0 ? (
                    <div className="py-6 text-center text-[11px] text-gray-400 dark:text-slate-400">暂无操作记录</div>
                  ) : (
                    adminNotifications.map((n) => (
                      <div key={n.id} className={`p-2 rounded-xl text-xs ${!n.read ? "bg-teal-50/60 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900" : "bg-gray-50/60 dark:bg-slate-700/40"}`}>
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="font-bold text-gray-900 dark:text-white truncate">{n.title}</p>
                          <span className="text-[9px] text-gray-400 shrink-0 ml-2">{formatRelativeTime(n.createdAt)}</span>
                        </div>
                        <p className="text-[11px] text-gray-600 dark:text-slate-300 break-all">{n.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div onClick={() => { setShowAdminUserMenu(!showAdminUserMenu); setShowAdminNotifications(false); }} className="flex items-center gap-2 px-2.5 py-1 bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-gray-100 dark:border-slate-700 rounded-xl cursor-pointer select-none transition-colors">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#3B82F6] to-[#00C776] text-white text-[10px] font-bold flex items-center justify-center overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- 头像可能是任意图片地址或 data URL */}
                <img src={resolveAvatar(currentUser?.avatar, currentUser?.username)} alt={currentUser?.displayName || "User"} className="w-full h-full object-cover" />
              </div>
              <span className="text-xs font-bold text-gray-800 dark:text-white truncate max-w-[100px]">{currentUser?.displayName || currentUser?.username || "Admin"}</span>
              <span className="text-[10px] text-gray-400">v</span>
            </div>

            {showAdminUserMenu && (
              <div className="absolute top-12 right-0 w-44 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-1.5 z-50 animate-fadeIn flex flex-col gap-1 text-xs font-semibold text-gray-700 dark:text-slate-200">
                <button onClick={() => { setShowAdminUserMenu(false); setActiveTab("profile"); }} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 text-left transition-colors cursor-pointer"><span>👤</span><span>个人中心</span></button>
                <div className="my-1 border-t border-gray-100 dark:border-slate-700" />
                <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }} className="flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left transition-colors cursor-pointer"><span>🚪</span><span>退出当前登录</span></button>
              </div>
            )}
          </div>
        </header>

        <div className="lg:hidden sticky top-16 z-10 flex gap-1.5 overflow-x-auto border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
          {adminNavItems.map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${activeTab === item.id ? "bg-[#00C776] text-white" : "bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300"}`}>
              <span>{item.icon}</span><span>{item.label}</span>
              {typeof item.badge !== "undefined" && <span className="text-[10px] opacity-70">{item.badge}</span>}
            </button>
          ))}
        </div>

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {notice && (
            <div className="mb-4 rounded-xl border border-[#00C776]/30 bg-[#00C776]/10 px-4 py-2.5 text-xs font-semibold text-[#009a5a] shadow-2xs">{notice}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100/90 dark:border-slate-700 shadow-2xs flex items-start justify-between transition-colors">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-400 dark:text-slate-400 mb-1">链接总数</span>
                <div className="flex items-baseline gap-1"><span className="text-2xl font-extrabold text-gray-900 dark:text-white">{links.length}</span></div>
                <span className="text-[11px] text-gray-400 dark:text-slate-400 mt-2">实时统计</span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-[#00C776] text-lg font-bold">🔗</div>
            </div>
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100/90 dark:border-slate-700 shadow-2xs flex items-start justify-between transition-colors">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-400 dark:text-slate-400 mb-1">分组总数</span>
                <div className="flex items-baseline gap-1"><span className="text-2xl font-extrabold text-gray-900 dark:text-white">{categories.length}</span></div>
                <span className="text-[11px] text-gray-400 dark:text-slate-400 mt-2">实时统计</span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-500 text-lg font-bold">🗂️</div>
            </div>
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100/90 dark:border-slate-700 shadow-2xs flex items-start justify-between transition-colors">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-400 dark:text-slate-400 mb-1">注册用户数</span>
                <div className="flex items-baseline gap-1"><span className="text-2xl font-extrabold text-gray-900 dark:text-white">{currentUser?.role === "admin" ? users.length : "—"}</span></div>
                <span className="text-[11px] text-gray-400 dark:text-slate-400 mt-2">{currentUser?.role === "admin" ? "系统内全部账号" : "仅管理员可见"}</span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-500 text-lg font-bold">👤</div>
            </div>
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100/90 dark:border-slate-700 shadow-2xs flex items-start justify-between transition-colors">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-400 dark:text-slate-400 mb-1">内容区域宽度</span>
                <div className="flex items-baseline gap-1"><span className="text-2xl font-extrabold text-gray-900 dark:text-white">{config.maxWidth}</span></div>
                <span className="text-[11px] text-gray-400 dark:text-slate-400 mt-2">当前设置</span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-500 text-lg font-bold">💻</div>
            </div>
          </div>

          {/* TAB 1/2/3: 链接/分组/快捷访问 */}
          {(activeTab === "links" || activeTab === "categories" || activeTab === "quickAccess") && (
            <AdminLinksTab activeTab={activeTab} />
          )}
          {/* TAB 3.6: 📁 项目管理 */}
          {activeTab === "projects" && <ProjectAdminPanel />}
          {/* TAB 3.7: 📅 日程管理 */}
          {activeTab === "schedules" && <ScheduleAdminPanel />}
          {/* TAB 4: 👤 账号管理 */}
          {activeTab === "users" && currentUser?.role === "admin" && <AdminUsersPanel />}
          {/* TAB 6: 📊 访问统计 */}
          {activeTab === "analytics" && <AdminLinksTab activeTab={activeTab} />}
          {/* TAB 6.5: 🤖 模型监控 */}
          {activeTab === "models" && <ModelMonitorPanel />}
          {/* TAB 7: ⚙️ 系统与数据管理 */}
          {activeTab === "system" && <AdminSystemTab />}
          {/* TAB 8: 🎨 界面与功能偏好 */}
          {activeTab === "personalization" && <AdminPersonalizationTab />}
          {/* TAB 9: 👤 个人账号与安全 */}
          {activeTab === "profile" && <AdminProfileTab />}
        </main>
      </div>

      {/* Modals */}
      <ConfirmDialog
        open={showReset}
        title="重置默认配置"
        message="确定要将所有分组、链接与系统个性化设置重置为初始状态吗？"
        confirmLabel="确定重置"
        onConfirm={() => { resetData(); resetConfig(); notify("系统设置", "全量配置已成功重置"); }}
        onClose={() => setShowReset(false)}
      />
    </div>
  );
}