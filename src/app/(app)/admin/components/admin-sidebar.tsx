"use client";

import { useText } from "@/hooks/use-text";
import { useTranslations } from "next-intl";
import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { USER_SETTINGS_NAV, isSystemSettingsTab, type SettingsTab } from "@/lib/admin-settings-nav";
import LogoMark from "@/components/logo-mark";
import BrandLogoText from "@/components/brand-logo-text";
import { resolveAvatar } from "@/lib/avatars";

export type AdminTab =
  | "links"
  | "categories"
  | "quickAccess"
  | "projects"
  | "schedules"
  | "users"
  | "auditLogs"
  | "system"
  | "pro"
  | "personalization"
  | "profile"
  | SettingsTab;

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
  const text = useText();
  const tx = useTranslations();
  const router = useRouter();
  const [systemOpen, setSystemOpen] = useState(true);
  const [userOpen, setUserOpen] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

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
          <span className="truncate">{text(item.label)}</span>
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
    <aside className="hidden lg:flex w-60 shrink-0 flex-col justify-between h-screen overflow-y-auto sticky top-0 border-r rounded-r-2xl border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 select-none z-30 transition-colors">
      <div className="flex flex-col gap-6">
        {/* Brand Logo Header */}
        <div className="flex items-center gap-3 px-1">
          <LogoMark size="md" />
          <div className="flex flex-col min-w-0">
            <span className="text-base font-bold tracking-tight text-gray-900 dark:text-white truncate">
              <BrandLogoText />
            </span>
            <span className="text-[10px] font-medium text-gray-400 dark:text-slate-400">
              {tx("administration_console_ceb0c289")}</span>
          </div>
        </div>

        {/* Admin Navigation Menu Items */}
        <nav className="flex flex-col gap-1.5">
          {adminNavItems.filter(item => !isSystemSettingsTab(item.id) && !USER_SETTINGS_NAV.some(child => child.id === item.id)).map(renderNavButton)}
          {[
            ...(currentUser?.role === "admin" ? [{ label: tx("system_settings_68ea5dd4"), items: adminNavItems.filter(item => isSystemSettingsTab(item.id)), open: systemOpen, toggle: () => setSystemOpen(v => !v) }] : []),
            { label: tx("user_settings_7ce710f6"), items: adminNavItems.filter(item => USER_SETTINGS_NAV.some(child => child.id === item.id)), open: userOpen, toggle: () => setUserOpen(v => !v) },
          ].map(group => (
            <div key={text(group.label)} className="flex flex-col gap-1 pt-2 border-t border-gray-100 dark:border-slate-800 mt-1">
              <button type="button" aria-expanded={group.open} onClick={group.toggle} className="flex justify-between px-3.5 py-2.5 text-xs font-semibold text-gray-700 dark:text-slate-200 cursor-pointer">
                <span>{text(group.label)}</span><span aria-hidden="true">{group.open ? "⌃" : "⌄"}</span>
              </button>
              {group.open && <div className="pl-3 flex flex-col gap-1 border-l border-gray-200 dark:border-slate-700 ml-4">
                {group.items.map(item => renderNavButton({ ...item, badge: "badge" in item ? item.badge : undefined, icon: <span aria-hidden="true">·</span> }))}
              </div>}
            </div>
          ))}
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
              <span>{tx("back_to_home_d3886609")}</span>
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
              <span>{tx("sign_out_cf3d59d7")}</span>
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
                {currentUser?.role === "admin" ? tx("administrator_56db2484") : tx("user_f6a2faaa")}
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
