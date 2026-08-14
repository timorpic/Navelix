"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resolveAvatar } from "@/lib/avatars";
import { formatRelativeTime, type NotificationItem } from "@/lib/notifications";

interface AdminHeaderProps {
  currentUser: {
    username: string;
    displayName: string;
    role: "admin" | "user";
    avatar?: string;
  } | null;
  config: { theme?: string; logoText?: string };
  updateConfig: (cfg: Partial<{ theme: string; logoText: string }>) => void;
  showAdminNotifications: boolean;
  setShowAdminNotifications: (show: boolean) => void;
  adminNotifications: NotificationItem[];
  setAdminNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
  showAdminUserMenu: boolean;
  setShowAdminUserMenu: (show: boolean) => void;
  setShowProfileModal: (show: boolean) => void;
  adminNotifRef: React.RefObject<HTMLDivElement | null>;
  handleOpenAdminNotifications: () => void;
  onNavigateToProfile?: () => void;
}

export default function AdminHeader({
  currentUser,
  config,
  updateConfig,
  showAdminNotifications,
  setShowAdminNotifications,
  adminNotifications,
  setAdminNotifications,
  showAdminUserMenu,
  setShowAdminUserMenu,
  setShowProfileModal,
  adminNotifRef,
  handleOpenAdminNotifications,
  onNavigateToProfile,
}: AdminHeaderProps) {
  const router = useRouter();
  const adminUnread = adminNotifications.some((n) => !n.read);

  return (
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
            const currentTheme = (config.theme as "light" | "dark" | "system") || "system";
            const idx = order.indexOf(currentTheme);
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
                if (onNavigateToProfile) {
                  onNavigateToProfile();
                } else {
                  setShowProfileModal(true);
                }
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
  );
}
