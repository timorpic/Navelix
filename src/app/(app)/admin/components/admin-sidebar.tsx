"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LogoMark from "@/components/logo-mark";
import { resolveAvatar } from "@/lib/avatars";

export type AdminTab =
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

export interface AdminNavItem {
  id: AdminTab;
  icon: React.ReactNode;
  label: string;
  badge?: number | string;
}

interface AdminSidebarProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  adminNavItems: AdminNavItem[];
  currentUser: {
    username: string;
    displayName: string;
    role: "admin" | "user";
    avatar?: string;
  } | null;
}

export default function AdminSidebar({
  activeTab,
  setActiveTab,
  adminNavItems,
  currentUser,
}: AdminSidebarProps) {
  const router = useRouter();
  const [systemOpen, setSystemOpen] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isSystemChildActive =
    activeTab === "system" || activeTab === "personalization" || activeTab === "profile";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
          <span className="text-sm flex items-center justify-center">{item.icon}</span>
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

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col justify-between h-screen sticky top-0 border-r border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 select-none z-30 transition-colors">
      <div className="flex flex-col gap-6">
        {/* Brand Logo Header */}
        <div className="flex items-center gap-3 px-1">
          <LogoMark size="md" />
          <div className="flex flex-col min-w-0">
            <span className="text-base font-bold tracking-tight text-gray-900 dark:text-white truncate">
              Navelix
            </span>
            <span className="text-[10px] font-medium text-gray-400 dark:text-slate-400">
              后台管理控制台
            </span>
          </div>
        </div>

        {/* Admin Navigation Menu Items */}
        <nav className="flex flex-col gap-1.5">
          {adminNavItems
            .filter((i) => i.id !== "system" && i.id !== "personalization" && i.id !== "profile")
            .map(renderNavButton)}

          {/* ⚙️ 系统设置（二级目录分组） */}
          <div className="flex flex-col gap-1 pt-2 border-t border-gray-100 dark:border-slate-800/80 mt-1">
            <button
              onClick={() => setSystemOpen((prev) => !prev)}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                isSystemChildActive
                  ? "text-gray-900 dark:text-white font-bold bg-gray-50 dark:bg-slate-800/60"
                  : "text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm">⚙️</span>
                <span className="truncate">系统设置</span>
              </div>
              <svg
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  systemOpen || isSystemChildActive ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* 二级目录下 3 个各自独立的页面 */}
            {(systemOpen || isSystemChildActive) && (
              <div className="pl-3 pr-1 py-1 flex flex-col gap-1 border-l-2 border-gray-200 dark:border-slate-700 ml-4 my-0.5 animate-fadeIn">
                <button
                  onClick={() => setActiveTab("system")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === "system"
                      ? "bg-[#00C776] text-white font-bold shadow-xs"
                      : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <span className="text-xs">⚙️</span>
                  <span>全局与数据</span>
                </button>

                <button
                  onClick={() => setActiveTab("personalization")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === "personalization"
                      ? "bg-[#00C776] text-white font-bold shadow-xs"
                      : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <span className="text-xs">🎨</span>
                  <span>个性化外观</span>
                </button>

                <button
                  onClick={() => setActiveTab("profile")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === "profile"
                      ? "bg-[#00C776] text-white font-bold shadow-xs"
                      : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <span className="text-xs">👤</span>
                  <span>个人中心</span>
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Bottom Profile Card */}
      <div className="pt-4 border-t border-gray-100 dark:border-slate-800 relative" ref={userMenuRef}>
        {/* User Popover Menu */}
        {showUserMenu && (
          <div className="absolute bottom-16 left-0 right-0 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-1.5 z-50 animate-fadeIn flex flex-col gap-1 text-xs font-semibold text-gray-700 dark:text-slate-200">
            <Link
              href="/"
              onClick={() => setShowUserMenu(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              <span>🏠</span>
              <span>返回前台主页</span>
            </Link>
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

        <div
          onClick={() => setShowUserMenu((prev) => !prev)}
          className="flex items-center justify-between p-2.5 bg-gray-50/80 dark:bg-slate-800/80 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 transition-colors cursor-pointer group select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00C776] to-[#009a5a] flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden shadow-2xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
          <svg className={`w-3.5 h-3.5 text-gray-400 dark:text-slate-400 group-hover:text-gray-700 dark:group-hover:text-white transition-transform duration-200 shrink-0 ${showUserMenu ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
          </svg>
        </div>
      </div>
    </aside>
  );
}
