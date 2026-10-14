"use client";
import { useLocale } from "next-intl";

import { useText } from "@/hooks/use-text";
import { useTranslations } from "next-intl";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/confirm-dialog";
import { useNavelixConfig, useNavelixData } from "@/context/navelix-context";
import { formatRelativeTime, type NotificationItem } from "@/lib/client/notifications";
import Toast from "@/components/toast";
import { useToast } from "@/hooks/use-toast";
import { resolveAvatar } from "@/lib/avatars";
import AdminUsersPanel from "./admin-users";
import ScheduleAdminPanel from "@/components/schedule-admin-panel";
import ProjectAdminPanel from "@/components/project-admin-panel";
import AdminSidebar from "./components/admin-sidebar";
import AdminLinksTab from "./components/admin-links-tab";
import AdminSettingsTab from "./components/admin-settings-tab";
import { SYSTEM_SETTINGS_NAV, getSystemSettingsNav, getUserSettingsNav, USER_SETTINGS_NAV, isSystemSettingsTab, resolveSettingsTab } from "@/lib/admin-settings-nav";
import AdminProTab from "./components/admin-pro-tab";
import AdminAuditLogsPanel from "./components/admin-audit-logs-panel";

type AdminTab = import("./components/admin-sidebar").AdminTab;

interface AdminNavItem {
  id: AdminTab;
  icon: React.ReactNode;
  label: string;
  badge?: number | string;
}

export default function AdminPage() {
  const locale = useLocale();
  const text = useText();
  const tx = useTranslations();
  const router = useRouter();
  const { categories, links, hydrated, resetData } = useNavelixData();
  const { config, updateConfig, resetConfig } = useNavelixConfig();

  const [activeTab, setActiveTab] = useState<AdminTab>("links");
  const [users, setUsers] = useState<Array<{ id: string; username: string; displayName: string; role: "admin" | "user"; avatar: string; createdAt: number }>>([]);

  // URL selection, reload and browser history use the same tab identifiers.
  useEffect(() => {
    const readTab = () => {
      const url = new URL(window.location.href);
      const param = url.searchParams.get("tab");
      const resolved = param ? resolveSettingsTab(param) ?? param : null;
      if (resolved && resolved !== param) {
        url.searchParams.set("tab", resolved);
        window.history.replaceState(null, "", url);
      }
      const valid: string[] = ["links", "categories", "quickAccess", "projects", "schedules", "users", "auditLogs", "pro", ...SYSTEM_SETTINGS_NAV.map(item => item.id), ...USER_SETTINGS_NAV.map(item => item.id)];
      setActiveTab(resolved && valid.includes(resolved) ? resolved as AdminTab : "links");
    };
    queueMicrotask(readTab);
    window.addEventListener("popstate", readTab);
    return () => window.removeEventListener("popstate", readTab);
  }, []);
  const selectTab = (tab: AdminTab) => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.pushState(null, "", url);
    setActiveTab(tab);
  };
  const [currentUser, setCurrentUser] = useState<{
    username: string; displayName: string; role: "admin" | "user";
    avatar?: string; email?: string; bio?: string;
  } | null>(null);

  const [showAdminNotifications, setShowAdminNotifications] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState<NotificationItem[]>([]);
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);
  const [showAdminUserMenu, setShowAdminUserMenu] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const adminNotifRef = useRef<HTMLDivElement>(null);

  const adminUnread = adminUnreadCount > 0;

  const { notice, notify } = useToast();

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
        {tx("loading_4927a53b")}</div>
    );
  }

  const adminNavItems: AdminNavItem[] = [
    { id: "links", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 10a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>, label: tx("link_management_09f9a1cb"), badge: links.length },
    { id: "categories", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg>, label: tx("category_management_49243080"), badge: categories.length },
    { id: "quickAccess", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>, label: tx("quick_access_0a704163"), badge: links.filter((l) => l.isQuickAccess).length },
    { id: "projects", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h6v8h-6z" /><path d="M14 4h6v4h-6z" /><path d="M14 12h6v8h-6z" /><path d="M4 16h6v4h-6z" /></svg>, label: tx("projects_a049dca9") },
    { id: "schedules", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>, label: tx("schedules_de72966b") },
    ...(currentUser?.role === "admin"
      ? [{ id: "users" as AdminTab, icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>, label: tx("account_management_eba54690"), badge: users.length || 1 }]
      : []),
    ...(currentUser?.role === "admin"
      ? [{ id: "auditLogs" as AdminTab, icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 14l2 2 4-4" /></svg>, label: tx("audit_logs_a0f79e91") }]
      : []),
    ...(currentUser?.role === "admin" ? [{ id: "pro" as AdminTab, icon: <span>💎</span>, label: tx("pro_features_f1c252c0"), badge: "PRO" }] : []),
    ...(currentUser?.role === "admin" ? getSystemSettingsNav(config.showProMenus !== false).map(item => ({ ...item, badge: item.pro ? "PRO" : undefined, icon: <span>⚙</span> })) : []),
    ...getUserSettingsNav(config.showProMenus !== false).map(item => ({ ...item, badge: "pro" in item && item.pro ? "PRO" : undefined, icon: <span>·</span> })),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F8FA] dark:bg-[#151218] text-gray-900 dark:text-slate-100 font-sans antialiased transition-colors duration-200 lg:flex-row">
      <AdminSidebar activeTab={activeTab} setActiveTab={selectTab} adminNavItems={adminNavItems} currentUser={currentUser} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-20 backdrop-blur-md transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <button className="text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5 truncate">
                {tx("welcome_back_1bc95b8b")}{currentUser?.displayName || currentUser?.username || "Admin"} 👋
              </h1>
              <p className="hidden sm:block text-xs text-gray-400 dark:text-slate-400">
                {tx("a_new_day_to_keep_your_workspace_organized_e4cfd392")}</p>
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
              title={config.theme === "system" ? tx("system_theme_217cfe7d") : config.theme === "dark" ? tx("switch_to_light_mode_fe05df6e") : tx("switch_to_dark_mode_65ec2b0d")}
            >
              {config.theme === "system" ? (
                <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></svg>
              ) : config.theme === "dark" ? (
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>

            <button
              onClick={handleOpenAdminNotifications}
              className={`relative p-2 rounded-xl transition-colors cursor-pointer ${
                showAdminNotifications ? "bg-brand/10 text-brand" : "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
              }`} title={tx("notifications_4cfc2a36")}
            >
              🔔
              {adminUnread && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />}
              {adminUnread && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-rose-500" />}
            </button>

            {showAdminNotifications && (
              <div ref={adminNotifRef} className="absolute top-12 right-24 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-3.5 z-50 animate-fadeIn text-left">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-slate-700">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{tx("admin_notifications_81f3f9ab")}</span>
                    {adminUnread && <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600 text-[10px] font-bold">{adminUnreadCount > 99 ? "99+" : adminUnreadCount}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {adminUnread && (
                      <button onClick={() => { fetch("/api/notifications/read", { method: "POST" }).catch(() => {}); setAdminNotifications((prev) => prev.map((n) => ({ ...n, read: true }))); setShowAdminNotifications(false); }} className="text-[10px] text-brand hover:underline cursor-pointer">{tx("mark_all_as_read_231cbc43")}</button>
                    )}
                    <button onClick={() => setShowAdminNotifications(false)} className="w-5 h-5 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-xs" title={tx("close_notifications_ed9af108")}>✕</button>
                  </div>
                </div>
                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                  {adminNotifications.length === 0 ? (
                    <div className="py-6 text-center text-[11px] text-gray-400 dark:text-slate-400">{tx("no_activity_records_68c16d82")}</div>
                  ) : (
                    adminNotifications.map((n) => (
                      <div key={n.id} className={`p-2 rounded-xl text-xs ${!n.read ? "bg-teal-50/60 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900" : "bg-gray-50/60 dark:bg-slate-700/40"}`}>
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="font-bold text-gray-900 dark:text-white truncate">{n.title}</p>
                          <span className="text-[9px] text-gray-400 shrink-0 ml-2">{formatRelativeTime(n.createdAt, { locale })}</span>
                        </div>
                        <p className="text-[11px] text-gray-600 dark:text-slate-300 break-all">{n.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div onClick={() => { setShowAdminUserMenu(!showAdminUserMenu); setShowAdminNotifications(false); }} className="flex items-center gap-2 px-2.5 py-1 bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-gray-100 dark:border-slate-700 rounded-xl cursor-pointer select-none transition-colors">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#3B82F6] to-brand text-white text-[10px] font-bold flex items-center justify-center overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- 头像可能是任意图片地址或 data URL */}
                <img src={resolveAvatar(currentUser?.avatar, currentUser?.username)} alt={currentUser?.displayName || "User"} className="w-full h-full object-cover" />
              </div>
              <span className="text-xs font-bold text-gray-800 dark:text-white truncate max-w-[100px]">{currentUser?.displayName || currentUser?.username || "Admin"}</span>
              <span className="text-[10px] text-gray-400">v</span>
            </div>

            {showAdminUserMenu && (
              <div className="absolute top-12 right-0 w-44 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-1.5 z-50 animate-fadeIn flex flex-col gap-1 text-xs font-semibold text-gray-700 dark:text-slate-200">
                <button onClick={() => { setShowAdminUserMenu(false); selectTab("profile"); }} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 text-left transition-colors cursor-pointer"><span>👤</span><span>{tx("my_account_5a2cac68")}</span></button>
                <div className="my-1 border-t border-gray-100 dark:border-slate-700" />
                <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }} className="flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left transition-colors cursor-pointer"><span>🚪</span><span>{tx("sign_out_cf3d59d7")}</span></button>
              </div>
            )}
          </div>
        </header>

        <div className="lg:hidden sticky top-16 z-10 flex gap-1.5 overflow-x-auto border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
          {adminNavItems.map((item) => (
            <button key={item.id} onClick={() => selectTab(item.id)} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${activeTab === item.id ? "bg-brand text-white" : "bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300"}`}>
              <span>{item.icon}</span><span>{text(item.label)}</span>
              {typeof item.badge !== "undefined" && <span className="text-[10px] opacity-70">{item.badge}</span>}
            </button>
          ))}
        </div>

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <Toast message={notice} className="mb-4" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100/90 dark:border-slate-700 shadow-2xs flex items-start justify-between transition-colors">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-400 dark:text-slate-400 mb-1">{tx("total_links_28cf726e")}</span>
                <div className="flex items-baseline gap-1"><span className="text-2xl font-extrabold text-gray-900 dark:text-white">{links.length}</span></div>
                <span className="text-[11px] text-gray-400 dark:text-slate-400 mt-2">{tx("live_statistics_5f8faa43")}</span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-brand text-lg font-bold">🔗</div>
            </div>
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100/90 dark:border-slate-700 shadow-2xs flex items-start justify-between transition-colors">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-400 dark:text-slate-400 mb-1">{tx("total_categories_bd12dda8")}</span>
                <div className="flex items-baseline gap-1"><span className="text-2xl font-extrabold text-gray-900 dark:text-white">{categories.length}</span></div>
                <span className="text-[11px] text-gray-400 dark:text-slate-400 mt-2">{tx("live_statistics_5f8faa43")}</span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-500 text-lg font-bold">🗂️</div>
            </div>
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100/90 dark:border-slate-700 shadow-2xs flex items-start justify-between transition-colors">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-400 dark:text-slate-400 mb-1">{tx("registered_users_ed322a5e")}</span>
                <div className="flex items-baseline gap-1"><span className="text-2xl font-extrabold text-gray-900 dark:text-white">{currentUser?.role === "admin" ? users.length : "—"}</span></div>
                <span className="text-[11px] text-gray-400 dark:text-slate-400 mt-2">{currentUser?.role === "admin" ? tx("all_accounts_in_this_instance_b6bf3fc9") : tx("administrators_only_fc66e66e")}</span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-500 text-lg font-bold">👤</div>
            </div>
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100/90 dark:border-slate-700 shadow-2xs flex items-start justify-between transition-colors">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-400 dark:text-slate-400 mb-1">{tx("content_width_c060d93e")}</span>
                <div className="flex items-baseline gap-1"><span className="text-2xl font-extrabold text-gray-900 dark:text-white">{config.maxWidth}</span></div>
                <span className="text-[11px] text-gray-400 dark:text-slate-400 mt-2">{tx("current_setting_a99f56d8")}</span>
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
          {/* TAB 6.5: 🧾 审计日志（仅管理员） */}
          {activeTab === "auditLogs" && currentUser?.role === "admin" && <AdminAuditLogsPanel />}
          {/* TAB 7: ⚙️ 系统与数据管理 */}
          {(SYSTEM_SETTINGS_NAV.some(item => item.id === activeTab) || USER_SETTINGS_NAV.some(item => item.id === activeTab)) &&
            (!isSystemSettingsTab(activeTab) || currentUser?.role === "admin") &&
            <AdminSettingsTab key={activeTab} tab={activeTab} isAdmin={currentUser?.role === "admin"} />}
          {/* TAB 7.5: 💎 Pro 商业特权 */}
          {activeTab === "pro" && currentUser?.role === "admin" && <AdminProTab />}
          {/* TAB 8: 🎨 界面与功能偏好 */}
          {/* TAB 9: 👤 个人账号与安全 */}
        </main>
      </div>

      {/* Modals */}
      <ConfirmDialog
        open={showReset}
        title={tx("reset_to_defaults_0409c0da")}
        message={tx("reset_all_categories_links_and_customization_set_7cf3278c")}
        confirmLabel={tx("confirm_reset_d7cf94d8")}
        onConfirm={() => { resetData(); resetConfig(); notify(tx("system_settings_68ea5dd4"), tx("all_settings_reset_successfully_34b5dd01")); }}
        onClose={() => setShowReset(false)}
      />
    </div>
  );
}
