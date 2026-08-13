"use client";

import React from "react";
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
  | "system";

export interface AdminNavItem {
  id: AdminTab;
  icon: string;
  label: string;
  badge?: number | string;
}

interface AdminSidebarProps {
  logoText: string;
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  systemSubMenuOpen: boolean;
  setSystemSubMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  systemSubTab: "global" | "personalization";
  setSystemSubTab: (tab: "global" | "personalization") => void;
  adminNavItems: AdminNavItem[];
  currentUser: {
    username: string;
    displayName: string;
    role: "admin" | "user";
    avatar?: string;
  } | null;
  setShowProfileModal: (show: boolean) => void;
}

export default function AdminSidebar({
  logoText,
  activeTab,
  setActiveTab,
  systemSubMenuOpen,
  setSystemSubMenuOpen,
  systemSubTab,
  setSystemSubTab,
  adminNavItems,
  currentUser,
  setShowProfileModal,
}: AdminSidebarProps) {
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

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col justify-between h-screen sticky top-0 border-r border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 select-none z-30 transition-colors">
      <div className="flex flex-col gap-6">
        {/* Brand Logo Header */}
        <div className="flex items-center gap-3 px-1">
          <LogoMark size="md" />
          <div className="flex flex-col min-w-0">
            <span className="text-base font-bold tracking-tight text-gray-900 dark:text-white truncate">
              _{logoText.toLowerCase() || "navelix"} Navelix
            </span>
            <span className="text-[10px] font-medium text-gray-400 dark:text-slate-400">
              后台管理控制台
            </span>
          </div>
        </div>

        {/* Admin Navigation Menu Items with Badge Counters */}
        <nav className="flex flex-col gap-1.5">
          {adminNavItems.map((item) => {
            if (item.id === "system") {
              const isSystemActive = activeTab === "system";
              return (
                <div key="system-menu" className="flex flex-col gap-1">
                  <button
                    onClick={() => {
                      setActiveTab("system");
                      setSystemSubMenuOpen((prev) => (isSystemActive ? !prev : true));
                    }}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                      isSystemActive
                        ? "bg-[#00C776] text-white shadow-sm shadow-[#00C776]/20"
                        : "text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm">⚙️</span>
                      <span className="truncate">系统设置</span>
                    </div>
                    <svg
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        systemSubMenuOpen || isSystemActive ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Sub-menu Items */}
                  {(systemSubMenuOpen || isSystemActive) && (
                    <div className="pl-4 pr-1 py-1 flex flex-col gap-1 border-l-2 border-gray-200 dark:border-slate-700/60 ml-4 my-0.5 animate-fadeIn">
                      <button
                        onClick={() => {
                          setActiveTab("system");
                          setSystemSubTab("global");
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isSystemActive && systemSubTab === "global"
                            ? "bg-teal-50 dark:bg-teal-950/60 text-[#00C776] font-bold"
                            : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-800/60"
                        }`}
                      >
                        <span className="text-xs">⚙️</span>
                        <span>全局与数据</span>
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab("system");
                          setSystemSubTab("personalization");
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isSystemActive && systemSubTab === "personalization"
                            ? "bg-teal-50 dark:bg-teal-950/60 text-[#00C776] font-bold"
                            : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-800/60"
                        }`}
                      >
                        <span className="text-xs">🎨</span>
                        <span>个性化外观</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            }
            return renderNavButton(item);
          })}
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
          <svg className="w-3.5 h-3.5 text-gray-400 dark:text-slate-400 group-hover:text-gray-700 dark:group-hover:text-white transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </aside>
  );
}
